-- =====================================================================
-- Studio Lais Vettore — Esquema do banco
-- Regras de ouro:
--   * Toda tabela tem RLS ativado (ver arquivo _rls.sql).
--   * Dados pessoais das clientes só são lidos pela admin (com MFA) ou
--     pela própria cliente através de funções seguras (RPC).
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.hair_length as enum ('curto', 'medio', 'longo', 'extra_longo');

create type public.appointment_status as enum (
  'pendente', 'confirmado', 'recusado', 'cancelado', 'concluido', 'faltou'
);

create type public.exception_kind as enum ('fechado', 'horario_especial', 'bloqueio');

-- ---------------------------------------------------------------------
-- Administradoras (só pode ser alterada via SQL no painel do Supabase)
-- ---------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clientes
--   user_id é opcional: a Laís pode cadastrar quem ainda não tem conta.
-- ---------------------------------------------------------------------
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users (id) on delete set null,
  full_name       text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone           text check (phone is null or char_length(phone) <= 30),
  email           text check (email is null or char_length(email) <= 254),
  birth_date      date,
  photo_path      text check (photo_path is null or char_length(photo_path) <= 300),
  lgpd_consent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index clients_name_idx on public.clients (lower(full_name));

-- Ficha técnica — SOMENTE a admin
create table public.client_records (
  client_id        uuid primary key references public.clients (id) on delete cascade,
  hair_type        text check (char_length(hair_type) <= 200),
  hair_length      public.hair_length,
  allergies        text check (char_length(allergies) <= 2000),
  chemical_history text check (char_length(chemical_history) <= 4000),
  notes            text check (char_length(notes) <= 8000),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Serviços e preços
-- ---------------------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(btrim(name)) between 2 and 80),
  description       text check (char_length(description) <= 600),
  category          text not null default 'Cabelo' check (char_length(category) <= 40),
  price_mode        text not null default 'unico' check (price_mode in ('unico', 'por_comprimento')),
  duration_min      int  not null default 60 check (duration_min between 15 and 720),
  -- 0 = domingo ... 6 = sábado
  allowed_weekdays  int[] not null default '{2,3,4,5,6}'
                    check (allowed_weekdays <@ '{0,1,2,3,4,5,6}'::int[]),
  start_window_from time,   -- null = segue horário do salão
  start_window_to   time,
  bookable_online   boolean not null default true,
  active            boolean not null default true,
  featured          boolean not null default false,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (start_window_from is null or start_window_to is null or start_window_from <= start_window_to)
);

create table public.service_prices (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services (id) on delete cascade,
  hair_length   public.hair_length,          -- null = preço único
  price         numeric(10,2) check (price is null or price >= 0),  -- null = a definir
  duration_min  int check (duration_min is null or duration_min between 15 and 720),
  unavailable   boolean not null default false,
  promo_price   numeric(10,2) check (promo_price is null or promo_price >= 0),
  promo_from    date,
  promo_until   date,
  check (promo_from is null or promo_until is null or promo_from <= promo_until),
  unique nulls not distinct (service_id, hair_length)
);

-- ---------------------------------------------------------------------
-- Horários
-- ---------------------------------------------------------------------
create table public.business_hours (
  weekday     int primary key check (weekday between 0 and 6),
  is_open     boolean not null default false,
  first_start time not null default '09:00',
  last_start  time not null default '16:00',
  check (first_start <= last_start)
);

create table public.schedule_exceptions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  kind        public.exception_kind not null,
  first_start time,   -- horario_especial
  last_start  time,
  block_from  time,   -- bloqueio
  block_to    time,
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  check (kind <> 'horario_especial' or (first_start is not null and last_start is not null and first_start <= last_start)),
  check (kind <> 'bloqueio' or (block_from is not null and block_to is not null and block_from < block_to))
);
create index schedule_exceptions_date_idx on public.schedule_exceptions (date);

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  service_name text not null check (char_length(service_name) between 2 and 120),
  hair_length  public.hair_length,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       public.appointment_status not null default 'pendente',
  price        numeric(10,2) check (price is null or price >= 0),
  price_note   text check (char_length(price_note) <= 200),
  client_note  text check (char_length(client_note) <= 500),
  admin_note   text check (char_length(admin_note) <= 2000),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_client_idx on public.appointments (client_id);
create index appointments_range_idx on public.appointments using gist (tstzrange(starts_at, ends_at));

-- ---------------------------------------------------------------------
-- Procedimentos realizados (histórico / ficha) — escrita SOMENTE admin
-- ---------------------------------------------------------------------
create table public.service_history (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  performed_on   date not null default current_date,
  service_name   text not null check (char_length(service_name) between 2 and 120),
  hair_length    public.hair_length,
  price          numeric(10,2) check (price is null or price >= 0),
  formula        text check (char_length(formula) <= 4000),   -- interno
  products       text check (char_length(products) <= 2000),  -- interno
  internal_notes text check (char_length(internal_notes) <= 4000),
  client_notes   text check (char_length(client_notes) <= 1000), -- visível à cliente
  photo_paths    text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index service_history_client_idx on public.service_history (client_id, performed_on desc);

-- ---------------------------------------------------------------------
-- Conteúdo público do site
-- ---------------------------------------------------------------------
create table public.gallery_items (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null check (char_length(image_url) <= 600),
  storage_path text check (char_length(storage_path) <= 300),
  caption    text check (char_length(caption) <= 160),
  category   text not null default 'Cabelo' check (char_length(category) <= 40),
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  key        text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Auditoria (somente inserção via trigger)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  table_name text not null,
  row_id     text,
  at         timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger clients_touch        before update on public.clients         for each row execute function public.touch_updated_at();
create trigger client_records_touch before update on public.client_records  for each row execute function public.touch_updated_at();
create trigger services_touch       before update on public.services        for each row execute function public.touch_updated_at();
create trigger appointments_touch   before update on public.appointments    for each row execute function public.touch_updated_at();
create trigger history_touch        before update on public.service_history for each row execute function public.touch_updated_at();
create trigger settings_touch       before update on public.site_settings   for each row execute function public.touch_updated_at();
