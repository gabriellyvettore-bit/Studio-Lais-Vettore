-- =====================================================================
-- Funções seguras (RPC). Todas com search_path vazio e nomes qualificados.
-- O navegador NUNCA decide preço, status ou duração: tudo é calculado aqui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------
-- Admin "forte": precisa estar na tabela admins E ter feito MFA (aal2).
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Informação para a própria sessão (mostrar "configure o MFA")
create or replace function public.whoami()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'is_admin_account', exists (select 1 from public.admins a where a.user_id = auth.uid()),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
  );
$$;

-- ---------------------------------------------------------------------
-- Configurações de agendamento
-- ---------------------------------------------------------------------
create or replace function public.booking_int(p_key text, p_default int)
returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (s.value ->> p_key)::int from public.site_settings s where s.key = 'booking'),
    p_default
  );
$$;

-- ---------------------------------------------------------------------
-- Horários disponíveis — devolve SÓ horários livres, nenhum dado pessoal
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_date date,
  p_service uuid,
  p_length public.hair_length default null
)
returns table (starts_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  tz constant text := 'America/Sao_Paulo';
  s   public.services%rowtype;
  pr  public.service_prices%rowtype;
  bh  public.business_hours%rowtype;
  ex  public.schedule_exceptions%rowtype;
  v_today   date := (now() at time zone tz)::date;
  v_first   time;
  v_last    time;
  v_dur     int;
  v_step    int := greatest(public.booking_int('slot_step_min', 30), 15);
  v_cap     int := greatest(public.booking_int('max_simultaneous', 1), 1);
  v_adv     int := greatest(public.booking_int('min_advance_hours', 12), 0);
  v_horizon int := least(greatest(public.booking_int('horizon_days', 60), 1), 365);
  t         time;
  v_start   timestamptz;
  v_end     timestamptz;
begin
  if p_date is null or p_service is null then return; end if;
  if p_date < v_today or p_date > v_today + v_horizon then return; end if;

  select * into s from public.services
   where id = p_service and active and bookable_online;
  if not found then return; end if;

  if not (extract(dow from p_date)::int = any (s.allowed_weekdays)) then return; end if;

  if s.price_mode = 'unico' then
    select * into pr from public.service_prices
     where service_id = s.id and hair_length is null;
  else
    if p_length is null then return; end if;
    select * into pr from public.service_prices
     where service_id = s.id and hair_length = p_length;
  end if;
  if pr.id is not null and pr.unavailable then return; end if;

  v_dur := coalesce(pr.duration_min, s.duration_min);

  -- Exceções do dia têm prioridade
  if exists (select 1 from public.schedule_exceptions e
              where e.date = p_date and e.kind = 'fechado') then
    return;
  end if;

  select * into ex from public.schedule_exceptions e
   where e.date = p_date and e.kind = 'horario_especial'
   order by e.created_at desc limit 1;

  if ex.id is not null then
    v_first := ex.first_start;
    v_last  := ex.last_start;
  else
    select * into bh from public.business_hours b where b.weekday = extract(dow from p_date)::int;
    if not found or not bh.is_open then return; end if;
    v_first := bh.first_start;
    v_last  := bh.last_start;
  end if;

  -- Janela específica do serviço (ex.: mechas só das 9h às 12h)
  if s.start_window_from is not null then v_first := greatest(v_first, s.start_window_from); end if;
  if s.start_window_to   is not null then v_last  := least(v_last, s.start_window_to); end if;
  if v_first > v_last then return; end if;

  t := v_first;
  loop
    exit when t > v_last;
    v_start := (p_date + t) at time zone tz;
    v_end   := v_start + make_interval(mins => v_dur);

    if v_start >= now() + make_interval(hours => v_adv)
       and not exists (
         select 1 from public.schedule_exceptions e
          where e.date = p_date and e.kind = 'bloqueio'
            and tstzrange((p_date + e.block_from) at time zone tz,
                          (p_date + e.block_to)   at time zone tz)
                && tstzrange(v_start, v_end))
       and (select count(*) from public.appointments a
             where a.status in ('pendente', 'confirmado')
               and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end)) < v_cap
    then
      starts_at := v_start;
      return next;
    end if;

    exit when t + make_interval(mins => v_step) <= t;  -- proteção contra virada de dia
    t := t + make_interval(mins => v_step);
  end loop;
end $$;

-- Dias com pelo menos um horário livre (para o calendário da cliente)
create or replace function public.get_available_days(
  p_service uuid,
  p_length public.hair_length default null,
  p_from date default null,
  p_days int default 42
)
returns table (day date)
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := coalesce(p_from, (now() at time zone 'America/Sao_Paulo')::date);
  i int;
begin
  for i in 0 .. least(greatest(p_days, 1), 62) - 1 loop
    if exists (select 1 from public.get_available_slots(d + i, p_service, p_length)) then
      day := d + i;
      return next;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Preço vigente (considera promoção na data do atendimento)
-- ---------------------------------------------------------------------
create or replace function public.effective_price(p_price_id uuid, p_on date)
returns numeric
language sql stable security definer set search_path = '' as $$
  select case
           when p.promo_price is not null
            and (p.promo_from  is null or p_on >= p.promo_from)
            and (p.promo_until is null or p_on <= p.promo_until)
           then p.promo_price
           else p.price
         end
    from public.service_prices p where p.id = p_price_id;
$$;

-- ---------------------------------------------------------------------
-- Perfil da cliente
-- ---------------------------------------------------------------------
create or replace function public.get_my_profile()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(x) from (
    select c.id, c.full_name, c.phone, c.email, c.birth_date, c.lgpd_consent_at
      from public.clients c where c.user_id = auth.uid()
  ) x;
$$;

create or replace function public.upsert_my_profile(
  p_full_name text,
  p_phone text,
  p_birth_date date default null,
  p_consent boolean default false
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) < 2 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_phone is null or char_length(regexp_replace(p_phone, '\D', '', 'g')) not between 10 and 13 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  select id into v_id from public.clients where user_id = v_uid;

  if v_id is null then
    if not coalesce(p_consent, false) then
      raise exception 'consent_required' using errcode = '22023';
    end if;
    insert into public.clients (user_id, full_name, phone, email, birth_date, lgpd_consent_at)
    values (v_uid, btrim(p_full_name), btrim(p_phone), v_email, p_birth_date, now())
    returning id into v_id;
  else
    update public.clients
       set full_name  = btrim(p_full_name),
           phone      = btrim(p_phone),
           birth_date = p_birth_date,
           email      = coalesce(v_email, email),
           lgpd_consent_at = coalesce(lgpd_consent_at, case when p_consent then now() end)
     where id = v_id;
  end if;

  return public.get_my_profile();
end $$;

-- ---------------------------------------------------------------------
-- Agendar (cliente)
-- ---------------------------------------------------------------------
create or replace function public.book_appointment(
  p_service uuid,
  p_length public.hair_length,
  p_starts_at timestamptz,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tz constant text := 'America/Sao_Paulo';
  v_uid uuid := auth.uid();
  v_client uuid;
  s  public.services%rowtype;
  pr public.service_prices%rowtype;
  v_len public.hair_length;
  v_date date;
  v_dur int;
  v_price numeric;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select id into v_client from public.clients
   where user_id = v_uid and lgpd_consent_at is not null;
  if v_client is null then raise exception 'profile_required' using errcode = '22023'; end if;

  select * into s from public.services where id = p_service and active and bookable_online;
  if not found then raise exception 'service_unavailable' using errcode = '22023'; end if;

  v_len := case when s.price_mode = 'unico' then null else p_length end;
  v_date := (p_starts_at at time zone tz)::date;

  -- serializa reservas para evitar dois agendamentos no mesmo horário
  perform pg_advisory_xact_lock(hashtext('studio_lv_booking'));

  -- limite de pedidos pendentes (contado DEPOIS do lock para resistir a pedidos simultâneos)
  perform 1 from public.clients where id = v_client for update;
  if (select count(*) from public.appointments a
       where a.client_id = v_client and a.status = 'pendente' and a.starts_at > now())
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
     status, price, price_note, client_note, created_by)
  values
    (v_client, s.id, s.name, v_len, p_starts_at, p_starts_at + make_interval(mins => v_dur),
     'pendente', v_price,
     case when v_price is null then 'Valor final confirmado no salão' end,
     nullif(left(btrim(coalesce(p_note, '')), 500), ''),
     v_uid)
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.cancel_my_appointment(p_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.appointments%rowtype;
begin
  select ap.* into a from public.appointments ap
    join public.clients c on c.id = ap.client_id
   where ap.id = p_id and c.user_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  if a.status not in ('pendente', 'confirmado') or a.starts_at <= now() then
    raise exception 'not_cancellable' using errcode = '22023';
  end if;
  if a.status = 'confirmado'
     and a.starts_at < now() + make_interval(hours => public.booking_int('cancel_hours', 24)) then
    raise exception 'too_late_to_cancel' using errcode = '22023';
  end if;
  update public.appointments set status = 'cancelado' where id = p_id;
end $$;

create or replace function public.get_my_appointments()
returns table (
  id uuid, service_name text, hair_length public.hair_length,
  starts_at timestamptz, ends_at timestamptz, status public.appointment_status,
  price numeric, price_note text, client_note text
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.service_name, a.hair_length, a.starts_at, a.ends_at, a.status,
         a.price, a.price_note, a.client_note
    from public.appointments a
    join public.clients c on c.id = a.client_id
   where c.user_id = auth.uid()
   order by a.starts_at desc
   limit 200;
$$;

-- Histórico: só leitura e SEM fórmulas/anotações internas
create or replace function public.get_my_history()
returns table (
  id uuid, performed_on date, service_name text, hair_length public.hair_length,
  price numeric, client_notes text
)
language sql stable security definer set search_path = '' as $$
  select h.id, h.performed_on, h.service_name, h.hair_length, h.price, h.client_notes
    from public.service_history h
    join public.clients c on c.id = h.client_id
   where c.user_id = auth.uid()
   order by h.performed_on desc
   limit 500;
$$;

-- LGPD: exportar meus dados
create or replace function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'perfil', public.get_my_profile(),
    'ficha_tecnica', (select to_jsonb(r) - 'notes' - 'client_id'
                        from public.client_records r
                        join public.clients c on c.id = r.client_id
                       where c.user_id = auth.uid()),
    'fotos_registradas', coalesce((select jsonb_agg(p)
                        from public.service_history h
                        join public.clients c on c.id = h.client_id,
                             unnest(h.photo_paths) p
                       where c.user_id = auth.uid()), '[]'::jsonb),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(x)) from public.get_my_appointments() x), '[]'::jsonb),
    'procedimentos', coalesce((select jsonb_agg(to_jsonb(y)) from public.get_my_history() y), '[]'::jsonb),
    'gerado_em', now()
  );
$$;

-- LGPD: excluir minha conta e meus dados
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.admins where user_id = v_uid) then
    raise exception 'admin_cannot_self_delete' using errcode = '22023';
  end if;
  -- fotos no Storage não podem ser apagadas por SQL: entram na fila de limpeza,
  -- que o painel da admin esvazia automaticamente.
  insert into public.storage_purge (path)
  select x.path from (
    select c.photo_path as path from public.clients c where c.user_id = v_uid and c.photo_path is not null
    union all
    select unnest(h.photo_paths) from public.service_history h
      join public.clients c on c.id = h.client_id where c.user_id = v_uid
  ) x
  on conflict do nothing;

  delete from public.clients where user_id = v_uid;
  delete from auth.users where id = v_uid;
end $$;

-- ---------------------------------------------------------------------
-- Admin: unir cadastros duplicados (ex.: cadastrada pelo WhatsApp e depois
-- criou conta no site)
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
    user_id         = coalesce(k.user_id, r.user_id),
    phone           = coalesce(k.phone, r.phone),
    email           = coalesce(k.email, r.email),
    birth_date      = coalesce(k.birth_date, r.birth_date),
    photo_path      = coalesce(k.photo_path, r.photo_path),
    lgpd_consent_at = coalesce(k.lgpd_consent_at, r.lgpd_consent_at)
  where id = p_keep;
end $$;

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old) ->> coalesce(tg_argv[0], 'id');
  else
    v_row := to_jsonb(new) ->> coalesce(tg_argv[0], 'id');
  end if;
  insert into public.audit_log (actor, action, table_name, row_id)
  values (auth.uid(), tg_op, tg_table_name, v_row);
  return coalesce(new, old);
end $$;

create trigger audit_clients        after insert or update or delete on public.clients         for each row execute function public.audit_trigger();
create trigger audit_client_records after insert or update or delete on public.client_records  for each row execute function public.audit_trigger('client_id');
create trigger audit_history        after insert or update or delete on public.service_history for each row execute function public.audit_trigger();
create trigger audit_appointments   after insert or update or delete on public.appointments    for each row execute function public.audit_trigger();
create trigger audit_services       after insert or update or delete on public.services        for each row execute function public.audit_trigger();
create trigger audit_prices         after insert or update or delete on public.service_prices  for each row execute function public.audit_trigger();
create trigger audit_admins         after insert or update or delete on public.admins          for each row execute function public.audit_trigger('user_id');

-- ---------------------------------------------------------------------
-- Permissões de execução: nega tudo e libera só o necessário
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_available_slots(date, uuid, public.hair_length) to anon, authenticated;
grant execute on function public.get_available_days(uuid, public.hair_length, date, int) to anon, authenticated;

grant execute on function public.is_admin()                  to authenticated;
grant execute on function public.whoami()                    to authenticated;
grant execute on function public.get_my_profile()            to authenticated;
grant execute on function public.upsert_my_profile(text, text, date, boolean) to authenticated;
grant execute on function public.book_appointment(uuid, public.hair_length, timestamptz, text) to authenticated;
grant execute on function public.cancel_my_appointment(uuid) to authenticated;
grant execute on function public.get_my_appointments()       to authenticated;
grant execute on function public.get_my_history()            to authenticated;
grant execute on function public.export_my_data()            to authenticated;
grant execute on function public.delete_my_account()         to authenticated;
grant execute on function public.admin_merge_clients(uuid, uuid) to authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
