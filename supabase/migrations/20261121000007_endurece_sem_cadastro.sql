-- =====================================================================
-- Endurecimento do fluxo sem cadastro (auditoria do agente de segurança)
--
--  * Celular já cadastrado + nascimento que não confere (ou cadastro ainda
--    não confirmado) => o pedido entra como "não conferido": NÃO confirma,
--    NÃO altera o cadastro, NÃO cria sessão e NÃO aparece em "Meus
--    horários". A Laís vê o nome digitado e resolve pelo WhatsApp.
--  * Cliente cadastrada pela Laís só confirma pelo convite.
--  * Limites de tentativa com trava (sem corrida) e limite diário;
--    celular guardado só como hash nas tentativas.
--  * Conta admin não usa as funções de cliente.
-- =====================================================================

alter table public.appointments
  add column unverified boolean not null default false,
  add column guest_name text check (guest_name is null or char_length(guest_name) <= 120);

-- clientes antigas confirmadas mas sem nascimento passam a entrar só por convite
update public.clients set confirmed_at = null
 where confirmed_at is not null and birth_date is null;

-- ---------------------------------------------------------------------
-- Limites de tentativa: verificar (com trava) e registrar separadamente
-- ---------------------------------------------------------------------
create or replace function public._throttle_check(p_kind text, p_key text, p_max int, p_window interval)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('throttle:' || p_kind || ':' || p_key));
  if (select count(*) from public.guest_attempts
       where kind = p_kind and key = p_key and at > now() - p_window) >= p_max then
    raise exception 'too_many_attempts' using errcode = '22023';
  end if;
end $$;

create or replace function public._throttle_hit(p_kind text, p_key text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.guest_attempts (kind, key) values (p_kind, p_key);
  delete from public.guest_attempts where at < now() - interval '2 days';
end $$;

create or replace function public._throttle(p_kind text, p_key text, p_max int, p_window interval)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._throttle_check(p_kind, p_key, p_max, p_window);
  perform public._throttle_hit(p_kind, p_key);
end $$;

-- celulares nas tentativas antigas viram hash
update public.guest_attempts set key = public._hash(key) where key ~ '^[0-9]{10,11}$';

-- ---------------------------------------------------------------------
-- Reserva interna (agora sabe se o pedido é conferido)
-- ---------------------------------------------------------------------
drop function if exists public._book(uuid, uuid, public.hair_length, timestamptz, text);

create or replace function public._book(
  p_client uuid, p_service uuid, p_length public.hair_length, p_starts_at timestamptz,
  p_note text, p_unverified boolean default false, p_guest_name text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tz constant text := 'America/Sao_Paulo';
  s  public.services%rowtype;
  pr public.service_prices%rowtype;
  v_len public.hair_length;
  v_date date;
  v_dur int;
  v_price numeric;
  v_id uuid;
begin
  select * into s from public.services where id = p_service and active and bookable_online;
  if not found then raise exception 'service_unavailable' using errcode = '22023'; end if;

  v_len := case when s.price_mode = 'unico' then null else p_length end;
  v_date := (p_starts_at at time zone tz)::date;

  perform pg_advisory_xact_lock(hashtext('studio_lv_booking'));

  -- limite de pendentes conta só pedidos conferidos (um estranho não esgota o da cliente)
  if not p_unverified and (select count(*) from public.appointments a
       where a.client_id = p_client and a.status = 'pendente' and not a.unverified and a.starts_at > now())
     >= public.booking_int('max_pending_per_client', 3) then
    raise exception 'too_many_pending' using errcode = '22023';
  end if;

  if not exists (select 1 from public.get_available_slots(v_date, p_service, v_len) g
                  where g.starts_at = p_starts_at) then
    raise exception 'slot_unavailable' using errcode = '22023';
  end if;

  select * into pr from public.service_prices
   where service_id = s.id and hair_length is not distinct from v_len;
  v_dur := coalesce(pr.duration_min, s.duration_min);
  v_price := case when pr.id is null then null else public.effective_price(pr.id, v_date) end;

  insert into public.appointments
    (client_id, service_id, service_name, hair_length, starts_at, ends_at,
     status, price, price_note, client_note, unverified, guest_name)
  values
    (p_client, s.id, s.name, v_len, p_starts_at, p_starts_at + make_interval(mins => v_dur),
     'pendente', v_price,
     case when v_price is null then 'Valor final confirmado no salão' end,
     nullif(left(btrim(coalesce(p_note, '')), 500), ''),
     coalesce(p_unverified, false),
     case when p_unverified then left(btrim(coalesce(p_guest_name, '')), 120) end)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Agendar sem cadastro (versão endurecida)
-- ---------------------------------------------------------------------
create or replace function public.book_as_guest(
  p_name text,
  p_phone text,
  p_birth date,
  p_service uuid,
  p_length public.hair_length,
  p_starts_at timestamptz,
  p_note text default null,
  p_consent boolean default false,
  p_token text default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid := public._session_client(p_token);
  c public.clients%rowtype;
  v_phone text := public.norm_phone(p_phone);
  v_token text := null;
  v_unverified boolean := false;
  v_first text;
  v_id uuid;
begin
  if public.is_admin() then raise exception 'admin_cannot_act_as_client' using errcode = '42501'; end if;

  if v_client is not null then
    -- cliente lembrada no aparelho: sem limites globais
    select * into c from public.clients where id = v_client;
    v_first := split_part(c.full_name, ' ', 1);
  else
    if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
      raise exception 'invalid_name' using errcode = '22023';
    end if;
    if char_length(v_phone) not in (10, 11) then
      raise exception 'invalid_phone' using errcode = '22023';
    end if;
    if p_birth is null or p_birth > current_date or p_birth < date '1900-01-01' then
      raise exception 'invalid_birth' using errcode = '22023';
    end if;
    if not coalesce(p_consent, false) then
      raise exception 'consent_required' using errcode = '22023';
    end if;
    -- contra robôs: limite geral e por celular (só para quem não está lembrada)
    perform public._throttle('book_global', 'all', 30, interval '10 minutes');
    perform public._throttle('book_day', 'all', 150, interval '1 day');
    perform public._throttle('book_phone', public._hash(v_phone), 6, interval '1 hour');

    perform pg_advisory_xact_lock(hashtext('studio_lv_client:' || v_phone));
    select * into c from public.clients where phone_norm = v_phone;
    v_first := split_part(btrim(p_name), ' ', 1);   -- nunca o nome salvo no banco

    if c.id is null then
      insert into public.clients (full_name, phone, birth_date, lgpd_consent_at, confirmed_at)
      values (btrim(p_name), btrim(p_phone), p_birth, now(), now())
      returning * into c;
      v_token := public._new_session(c.id);
    elsif c.confirmed_at is not null and c.birth_date = p_birth then
      v_token := public._new_session(c.id);
    else
      -- celular já existe e (nascimento não confere OU cadastro aguardando convite):
      -- registra o pedido para a Laís conferir, sem dar acesso e sem mexer no cadastro
      v_unverified := true;
    end if;
  end if;

  v_id := public._book(c.id, p_service, p_length, p_starts_at, p_note, v_unverified, p_name);

  return jsonb_build_object(
    'appointment_id', v_id,
    'token', coalesce(v_token, case when v_client is not null then p_token end),
    'first_name', v_first
  );
end $$;

-- ---------------------------------------------------------------------
-- Login em outro aparelho: limite por celular (5/dia) e falhas globais
-- ---------------------------------------------------------------------
create or replace function public.guest_login(p_phone text, p_birth date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := public.norm_phone(p_phone);
  v_key text := public._hash(v_phone);
  c public.clients%rowtype;
begin
  if public.is_admin() then raise exception 'admin_cannot_act_as_client' using errcode = '42501'; end if;
  perform public._throttle_check('login_fail_phone', v_key, 5, interval '1 day');
  perform public._throttle_check('login_fail_global', 'all', 200, interval '1 hour');
  select * into c from public.clients
   where phone_norm = v_phone and confirmed_at is not null
     and birth_date is not null and birth_date = p_birth;
  if c.id is null then
    -- só falhas contam; sem exceção para o registro não ser desfeito
    perform public._throttle_hit('login_fail_phone', v_key);
    perform public._throttle_hit('login_fail_global', 'all');
    return null;
  end if;
  return jsonb_build_object('token', public._new_session(c.id), 'first_name', split_part(c.full_name, ' ', 1));
end $$;

-- ---------------------------------------------------------------------
-- "Meus horários" mostra só pedidos conferidos
-- ---------------------------------------------------------------------
create or replace function public.guest_appointments(p_token text)
returns table (
  id uuid, service_name text, hair_length public.hair_length,
  starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  price numeric, price_note text
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.service_name, a.hair_length, a.starts_at, a.ends_at, a.status, a.price, a.price_note
    from public.appointments a
   where a.client_id = public._session_client(p_token) and not a.unverified
   order by a.starts_at desc limit 100;
$$;

create or replace function public.guest_cancel(p_token text, p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare a public.appointments%rowtype;
begin
  select * into a from public.appointments
   where id = p_id and client_id = public._session_client(p_token) and not unverified;
  if a.id is null then raise exception 'not_found' using errcode = '22023'; end if;
  if a.status not in ('pendente', 'confirmado') or a.starts_at <= now() then
    raise exception 'not_cancellable' using errcode = '22023';
  end if;
  if a.status = 'confirmado'
     and a.starts_at < now() + make_interval(hours => public.booking_int('cancel_hours', 24)) then
    raise exception 'too_late_to_cancel' using errcode = '22023';
  end if;
  update public.appointments set status = 'cancelado' where id = p_id;
end $$;

-- exportação inclui também o e-mail (se o studio cadastrou) e se há foto
create or replace function public.guest_export(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_client uuid := public._session_client(p_token);
begin
  if v_client is null then raise exception 'not_found' using errcode = '22023'; end if;
  return jsonb_build_object(
    'perfil', (select to_jsonb(x) from (select full_name, phone, email, birth_date, lgpd_consent_at, created_at,
                                               (photo_path is not null) as tem_foto
                                          from public.clients where id = v_client) x),
    'ficha_tecnica', (select to_jsonb(r) - 'notes' - 'client_id' from public.client_records r where r.client_id = v_client),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(a)) from public.guest_appointments(p_token) a), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(to_jsonb(h)) from public.guest_history(p_token) h), '[]'::jsonb),
    'gerado_em', now()
  );
end $$;

-- ---------------------------------------------------------------------
-- Convite: conta admin não confirma no lugar da cliente
-- ---------------------------------------------------------------------
create or replace function public.confirm_invite(p_invite uuid, p_birth date, p_consent boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clients%rowtype;
begin
  if public.is_admin() then raise exception 'admin_cannot_act_as_client' using errcode = '42501'; end if;
  perform public._throttle('invite', public._hash(coalesce(p_invite::text, '')), 10, interval '1 hour');
  select * into c from public.clients
   where invite_token = p_invite and confirmed_at is null and invite_expires_at > now();
  if c.id is null then return jsonb_build_object('error', 'invite_invalid'); end if;
  if not coalesce(p_consent, false) then return jsonb_build_object('error', 'consent_required'); end if;
  if p_birth is null or p_birth > current_date or p_birth < date '1900-01-01'
     or (c.birth_date is not null and c.birth_date <> p_birth) then
    return jsonb_build_object('error', 'invalid_birth');
  end if;
  update public.clients
     set confirmed_at = now(), lgpd_consent_at = now(), birth_date = p_birth
   where id = c.id;
  return jsonb_build_object('token', public._new_session(c.id), 'first_name', split_part(c.full_name, ' ', 1));
end $$;

-- ---------------------------------------------------------------------
-- Admin: resetar acesso (encerra sessões e exige novo convite)
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_access(p_client uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid := gen_random_uuid();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.client_sessions where client_id = p_client;
  update public.clients
     set confirmed_at = null, invite_token = v, invite_expires_at = now() + interval '30 days'
   where id = p_client;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Unir cadastros: nunca herda consentimento de outro cadastro
-- ---------------------------------------------------------------------
create or replace function public.admin_merge_clients(p_keep uuid, p_remove uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.clients%rowtype;
  k public.clients%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_keep = p_remove then raise exception 'same_client' using errcode = '22023'; end if;
  select * into k from public.clients where id = p_keep;
  select * into r from public.clients where id = p_remove;
  if k.id is null or r.id is null then raise exception 'not_found' using errcode = '22023'; end if;

  update public.appointments    set client_id = p_keep where client_id = p_remove;
  update public.service_history set client_id = p_keep where client_id = p_remove;
  if not exists (select 1 from public.client_records where client_id = p_keep) then
    update public.client_records set client_id = p_keep where client_id = p_remove;
  end if;

  delete from public.clients where id = p_remove;

  update public.clients set
    user_id    = coalesce(k.user_id, r.user_id),
    phone      = coalesce(k.phone, r.phone),
    email      = coalesce(k.email, r.email),
    birth_date = coalesce(k.birth_date, r.birth_date),
    photo_path = coalesce(k.photo_path, r.photo_path)
  where id = p_keep;
end $$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_available_slots(date, uuid, public.hair_length) to anon, authenticated;
grant execute on function public.get_available_days(uuid, public.hair_length, date, int) to anon, authenticated;
grant execute on function public.book_as_guest(text, text, date, uuid, public.hair_length, timestamptz, text, boolean, text) to anon, authenticated;
grant execute on function public.guest_login(text, date) to anon, authenticated;
grant execute on function public.guest_profile(text) to anon, authenticated;
grant execute on function public.guest_appointments(text) to anon, authenticated;
grant execute on function public.guest_history(text) to anon, authenticated;
grant execute on function public.guest_cancel(text, uuid) to anon, authenticated;
grant execute on function public.guest_logout(text) to anon, authenticated;
grant execute on function public.guest_export(text) to anon, authenticated;
grant execute on function public.guest_delete(text) to anon, authenticated;
grant execute on function public.invite_info(uuid) to anon, authenticated;
grant execute on function public.confirm_invite(uuid, date, boolean) to anon, authenticated;
grant execute on function public.norm_phone(text) to anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.whoami() to authenticated;
grant execute on function public.admin_merge_clients(uuid, uuid) to authenticated;
grant execute on function public.admin_new_invite(uuid) to authenticated;
grant execute on function public.admin_reset_access(uuid) to authenticated;
