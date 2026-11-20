-- =====================================================================
-- Agendamento SEM cadastro (só nome, celular e nascimento) + convite
-- pelo WhatsApp para clientes cadastradas pela Laís.
--
-- Regras:
--  * A cliente agenda sem login. O pedido fica "pendente" e a Laís
--    confirma pelo WhatsApp.
--  * "Meus horários": a cliente fica lembrada no celular por um token
--    aleatório (guardamos só o hash). Para entrar em outro aparelho:
--    celular + data de nascimento (com limite de tentativas).
--  * A Laís NÃO consegue confirmar uma cliente sozinha: só a própria
--    cliente confirma (pelo link do convite ou agendando). Isso é
--    garantido por gatilho no banco.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Celular normalizado (só dígitos, sem +55)
-- ---------------------------------------------------------------------
create or replace function public.norm_phone(p text)
returns text
language sql immutable set search_path = '' as $$
  select case
           when d ~ '^55[0-9]{10,11}$' then substr(d, 3)
           else d
         end
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;

alter table public.clients
  add column phone_norm text generated always as (nullif(public.norm_phone(phone), '')) stored,
  add column confirmed_at timestamptz,
  add column invite_token uuid unique,
  add column invite_expires_at timestamptz;

create unique index clients_phone_norm_uniq on public.clients (phone_norm) where phone_norm is not null;

-- quem já tinha conta e aceitou a política conta como confirmada
update public.clients set confirmed_at = coalesce(lgpd_consent_at, created_at)
 where lgpd_consent_at is not null and confirmed_at is null;

-- ---------------------------------------------------------------------
-- Guarda: só a própria cliente confirma o cadastro.
-- Acesso direto pela API (papéis anon/authenticated, incluindo a admin)
-- não pode marcar confirmed_at nem lgpd_consent_at. As funções seguras
-- abaixo rodam como dona do banco e podem.
-- ---------------------------------------------------------------------
create or replace function public.clients_guard()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.confirmed_at is not null or new.lgpd_consent_at is not null then
        raise exception 'confirmation_requires_client' using errcode = '42501';
      end if;
    elsif new.confirmed_at is distinct from old.confirmed_at
       or new.lgpd_consent_at is distinct from old.lgpd_consent_at then
      raise exception 'confirmation_requires_client' using errcode = '42501';
    end if;
  end if;

  if new.confirmed_at is not null then
    new.invite_token := null;
    new.invite_expires_at := null;
  elsif new.invite_token is null then
    new.invite_token := gen_random_uuid();
    new.invite_expires_at := now() + interval '30 days';
  end if;
  return new;
end $$;

create trigger clients_guard before insert or update on public.clients
  for each row execute function public.clients_guard();

-- ---------------------------------------------------------------------
-- Sessões das clientes (lembrar no celular) e limites de tentativas
-- ---------------------------------------------------------------------
create table public.client_sessions (
  token_hash text primary key,
  client_id  uuid not null references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);
create index client_sessions_client_idx on public.client_sessions (client_id);

create table public.guest_attempts (
  id   bigint generated always as identity primary key,
  kind text not null,
  key  text not null,
  at   timestamptz not null default now()
);
create index guest_attempts_idx on public.guest_attempts (kind, key, at desc);

alter table public.client_sessions enable row level security;
alter table public.guest_attempts  enable row level security;
revoke all on public.client_sessions, public.guest_attempts from anon, authenticated;

-- ---------------------------------------------------------------------
-- Funções internas (não expostas)
-- ---------------------------------------------------------------------
create or replace function public._hash(p text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p, 'sha256'), 'hex');
$$;

create or replace function public._new_session(p_client uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare v text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.client_sessions (token_hash, client_id) values (public._hash(v), p_client);
  -- no máximo 10 aparelhos lembrados por cliente
  delete from public.client_sessions
   where client_id = p_client
     and token_hash not in (select token_hash from public.client_sessions
                             where client_id = p_client order by created_at desc limit 10);
  return v;
end $$;

create or replace function public._session_client(p_token text)
returns uuid
language sql stable security definer set search_path = '' as $$
  select s.client_id from public.client_sessions s
   where p_token is not null and char_length(p_token) = 64
     and s.token_hash = public._hash(p_token) and s.expires_at > now();
$$;

-- registra uma tentativa e bloqueia se passou do limite na janela
create or replace function public._throttle(p_kind text, p_key text, p_max int, p_window interval)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.guest_attempts
       where kind = p_kind and key = p_key and at > now() - p_window) >= p_max then
    raise exception 'too_many_attempts' using errcode = '22023';
  end if;
  insert into public.guest_attempts (kind, key) values (p_kind, p_key);
  -- faxina ocasional
  if random() < 0.02 then
    delete from public.guest_attempts where at < now() - interval '2 days';
  end if;
end $$;

-- reserva (mesmas regras do agendamento online: capacidade, janela, preço)
create or replace function public._book(
  p_client uuid, p_service uuid, p_length public.hair_length, p_starts_at timestamptz, p_note text
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

  if (select count(*) from public.appointments a
       where a.client_id = p_client and a.status = 'pendente' and a.starts_at > now())
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
     status, price, price_note, client_note)
  values
    (p_client, s.id, s.name, v_len, p_starts_at, p_starts_at + make_interval(mins => v_dur),
     'pendente', v_price,
     case when v_price is null then 'Valor final confirmado no salão' end,
     nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- RPCs públicas (sem login)
-- ---------------------------------------------------------------------

-- Agendar sem cadastro
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
  v_id uuid;
begin
  -- limite geral contra robôs (bem acima do movimento real do salão)
  perform public._throttle('book_global', 'all', 15, interval '10 minutes');
  perform public._throttle('book_day', 'all', 80, interval '1 day');

  if v_client is not null then
    select * into c from public.clients where id = v_client;
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
    perform public._throttle('book_phone', v_phone, 6, interval '1 hour');

    perform pg_advisory_xact_lock(hashtext('studio_lv_client:' || v_phone));
    select * into c from public.clients where phone_norm = v_phone;

    if c.id is null then
      insert into public.clients (full_name, phone, birth_date, lgpd_consent_at, confirmed_at)
      values (btrim(p_name), btrim(p_phone), p_birth, now(), now())
      returning * into c;
      v_token := public._new_session(c.id);
    elsif c.confirmed_at is null then
      -- cadastrada pela Laís: a própria cliente confirma agora
      update public.clients
         set confirmed_at = now(), lgpd_consent_at = coalesce(lgpd_consent_at, now()),
             birth_date = coalesce(birth_date, p_birth)
       where id = c.id
      returning * into c;
      if c.birth_date = p_birth then v_token := public._new_session(c.id); end if;
    elsif c.birth_date is null then
      update public.clients set birth_date = p_birth where id = c.id returning * into c;
      v_token := public._new_session(c.id);
    elsif c.birth_date = p_birth then
      v_token := public._new_session(c.id);
    end if;
    -- se a data não confere, o pedido é registrado mesmo assim (a Laís
    -- confirma pelo WhatsApp), mas o celular não fica "lembrado".
  end if;

  v_id := public._book(c.id, p_service, p_length, p_starts_at, p_note);

  return jsonb_build_object(
    'appointment_id', v_id,
    'token', coalesce(v_token, case when v_client is not null then p_token end),
    'first_name', split_part(c.full_name, ' ', 1)
  );
end $$;

-- Entrar em "Meus horários" em outro aparelho (retorna null se não conferir)
create or replace function public.guest_login(p_phone text, p_birth date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := public.norm_phone(p_phone);
  c public.clients%rowtype;
begin
  perform public._throttle('login_global', 'all', 300, interval '1 hour');
  perform public._throttle('login_phone', v_phone, 8, interval '1 hour');
  select * into c from public.clients
   where phone_norm = v_phone and confirmed_at is not null
     and birth_date is not null and birth_date = p_birth;
  -- não lança erro: assim a tentativa errada fica registrada (limite funciona)
  if c.id is null then return null; end if;
  return jsonb_build_object('token', public._new_session(c.id), 'first_name', split_part(c.full_name, ' ', 1));
end $$;

create or replace function public.guest_profile(p_token text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'first_name', split_part(c.full_name, ' ', 1),
    'full_name', c.full_name,
    'phone', c.phone,
    'birth_date', c.birth_date
  ) from public.clients c where c.id = public._session_client(p_token);
$$;

create or replace function public.guest_appointments(p_token text)
returns table (
  id uuid, service_name text, hair_length public.hair_length,
  starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  price numeric, price_note text
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.service_name, a.hair_length, a.starts_at, a.ends_at, a.status, a.price, a.price_note
    from public.appointments a
   where a.client_id = public._session_client(p_token)
   order by a.starts_at desc limit 100;
$$;

create or replace function public.guest_history(p_token text)
returns table (id uuid, performed_on date, service_name text, hair_length public.hair_length, client_notes text)
language sql stable security definer set search_path = '' as $$
  select h.id, h.performed_on, h.service_name, h.hair_length, h.client_notes
    from public.service_history h
   where h.client_id = public._session_client(p_token)
   order by h.performed_on desc limit 200;
$$;

create or replace function public.guest_cancel(p_token text, p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare a public.appointments%rowtype;
begin
  select * into a from public.appointments
   where id = p_id and client_id = public._session_client(p_token);
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

create or replace function public.guest_logout(p_token text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.client_sessions where token_hash = public._hash(coalesce(p_token, ''));
$$;

-- LGPD: baixar meus dados
create or replace function public.guest_export(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_client uuid := public._session_client(p_token);
begin
  if v_client is null then raise exception 'not_found' using errcode = '22023'; end if;
  return jsonb_build_object(
    'perfil', (select to_jsonb(x) from (select full_name, phone, birth_date, lgpd_consent_at, created_at
                                          from public.clients where id = v_client) x),
    'ficha_tecnica', (select to_jsonb(r) - 'notes' - 'client_id' from public.client_records r where r.client_id = v_client),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(a)) from public.guest_appointments(p_token) a), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(to_jsonb(h)) from public.guest_history(p_token) h), '[]'::jsonb),
    'gerado_em', now()
  );
end $$;

-- LGPD: excluir meus dados
create or replace function public.guest_delete(p_token text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_client uuid := public._session_client(p_token);
begin
  if v_client is null then raise exception 'not_found' using errcode = '22023'; end if;
  insert into public.storage_purge (path)
  select x.path from (
    select c.photo_path as path from public.clients c where c.id = v_client and c.photo_path is not null
    union all
    select unnest(h.photo_paths) from public.service_history h where h.client_id = v_client
  ) x on conflict do nothing;
  delete from public.clients where id = v_client;
end $$;

-- ---------------------------------------------------------------------
-- Convite (cliente cadastrada pela Laís confirma pelo link)
-- ---------------------------------------------------------------------
create or replace function public.invite_info(p_invite uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('first_name', split_part(c.full_name, ' ', 1),
                            'has_birth', c.birth_date is not null)
    from public.clients c
   where c.invite_token = p_invite and c.confirmed_at is null and c.invite_expires_at > now();
$$;

create or replace function public.confirm_invite(p_invite uuid, p_birth date, p_consent boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clients%rowtype;
begin
  perform public._throttle('invite', coalesce(p_invite::text, ''), 10, interval '1 hour');
  select * into c from public.clients
   where invite_token = p_invite and confirmed_at is null and invite_expires_at > now();
  -- erros voltam no resultado (sem exceção) para a tentativa ficar registrada
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

-- Admin: gerar um novo link de convite (o anterior deixa de valer)
create or replace function public.admin_new_invite(p_client uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid := gen_random_uuid();
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.clients set invite_token = v, invite_expires_at = now() + interval '30 days'
   where id = p_client and confirmed_at is null;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Auditoria e permissões
-- ---------------------------------------------------------------------
create trigger audit_client_sessions after insert or delete on public.client_sessions
  for each row execute function public.audit_trigger('client_id');

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

-- admin (autenticada) — cada função confere is_admin()
grant execute on function public.is_admin() to authenticated;
grant execute on function public.whoami() to authenticated;
grant execute on function public.admin_merge_clients(uuid, uuid) to authenticated;
grant execute on function public.admin_new_invite(uuid) to authenticated;
-- norm_phone é usada pela coluna gerada; inofensiva
grant execute on function public.norm_phone(text) to anon, authenticated;
