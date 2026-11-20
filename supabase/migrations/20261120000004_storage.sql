-- =====================================================================
-- Storage
--   galeria  -> público para leitura (fotos do site); escrita só admin
--   clientes -> PRIVADO (fotos das clientes, antes/depois); só admin
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('galeria',  'galeria',  true,  8 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('clientes', 'clientes', false, 8 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy galeria_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'galeria' and (select public.is_admin()));
create policy galeria_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'galeria' and (select public.is_admin()))
  with check (bucket_id = 'galeria' and (select public.is_admin()));
create policy galeria_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'galeria' and (select public.is_admin()));

create policy clientes_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'clientes' and (select public.is_admin()));
create policy clientes_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clientes' and (select public.is_admin()));
create policy clientes_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'clientes' and (select public.is_admin()))
  with check (bucket_id = 'clientes' and (select public.is_admin()));
create policy clientes_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'clientes' and (select public.is_admin()));
