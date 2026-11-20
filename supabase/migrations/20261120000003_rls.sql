-- =====================================================================
-- Row Level Security — NEGAR POR PADRÃO
-- Sem política = ninguém acessa pela API. Cada acesso abaixo é explícito.
-- =====================================================================

alter table public.admins              enable row level security;
alter table public.clients             enable row level security;
alter table public.client_records      enable row level security;
alter table public.services            enable row level security;
alter table public.service_prices      enable row level security;
alter table public.business_hours      enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.appointments        enable row level security;
alter table public.service_history     enable row level security;
alter table public.gallery_items       enable row level security;
alter table public.site_settings       enable row level security;
alter table public.audit_log           enable row level security;
alter table public.storage_purge       enable row level security;

-- Força RLS até para o dono da tabela via API
alter table public.clients         force row level security;
alter table public.client_records  force row level security;
alter table public.appointments    force row level security;
alter table public.service_history force row level security;

-- ---------------------------------------------------------------------
-- Defesa em profundidade: o papel anônimo não tem NENHUM privilégio
-- sobre tabelas com dados pessoais ou internos.
-- ---------------------------------------------------------------------
revoke all on public.admins, public.clients, public.client_records,
              public.appointments, public.service_history, public.audit_log,
              public.schedule_exceptions
  from anon;

-- TRUNCATE/TRIGGER/REFERENCES ignoram RLS: ninguém pela API precisa deles
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on public.storage_purge from anon;

-- Ninguém escreve na auditoria nem na tabela de admins pela API
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke all on public.admins from authenticated;

-- Anônimos só leem conteúdo público
revoke insert, update, delete, truncate on public.services, public.service_prices,
       public.business_hours, public.gallery_items, public.site_settings
  from anon;

-- ---------------------------------------------------------------------
-- Dados pessoais: SOMENTE admin (com MFA). Clientes usam as funções RPC.
-- ---------------------------------------------------------------------
create policy clients_admin_all on public.clients
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy client_records_admin_all on public.client_records
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy appointments_admin_all on public.appointments
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy service_history_admin_all on public.service_history
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy schedule_exceptions_admin_all on public.schedule_exceptions
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy storage_purge_admin_all on public.storage_purge
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy audit_log_admin_read on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Conteúdo público: leitura para todos, escrita só admin
-- ---------------------------------------------------------------------
create policy services_public_read on public.services
  for select to anon, authenticated using (active);
create policy services_admin_read on public.services
  for select to authenticated using ((select public.is_admin()));
create policy services_admin_insert on public.services
  for insert to authenticated with check ((select public.is_admin()));
create policy services_admin_update on public.services
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy services_admin_delete on public.services
  for delete to authenticated using ((select public.is_admin()));

create policy prices_public_read on public.service_prices
  for select to anon, authenticated
  using (exists (select 1 from public.services s where s.id = service_id and s.active));
create policy prices_admin_read on public.service_prices
  for select to authenticated using ((select public.is_admin()));
create policy prices_admin_insert on public.service_prices
  for insert to authenticated with check ((select public.is_admin()));
create policy prices_admin_update on public.service_prices
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy prices_admin_delete on public.service_prices
  for delete to authenticated using ((select public.is_admin()));

create policy hours_public_read on public.business_hours
  for select to anon, authenticated using (true);
create policy hours_admin_insert on public.business_hours
  for insert to authenticated with check ((select public.is_admin()));
create policy hours_admin_update on public.business_hours
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy hours_admin_delete on public.business_hours
  for delete to authenticated using ((select public.is_admin()));

create policy gallery_public_read on public.gallery_items
  for select to anon, authenticated using (active);
create policy gallery_admin_read on public.gallery_items
  for select to authenticated using ((select public.is_admin()));
create policy gallery_admin_insert on public.gallery_items
  for insert to authenticated with check ((select public.is_admin()));
create policy gallery_admin_update on public.gallery_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy gallery_admin_delete on public.gallery_items
  for delete to authenticated using ((select public.is_admin()));

create policy settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
create policy settings_admin_insert on public.site_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy settings_admin_update on public.site_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin_delete on public.site_settings
  for delete to authenticated using ((select public.is_admin()));
