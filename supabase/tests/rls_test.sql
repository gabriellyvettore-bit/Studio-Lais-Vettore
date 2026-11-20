-- =====================================================================
-- Testes de segurança (RLS + RPC)
-- Rodar contra um banco de TESTE já com as migrações aplicadas.
-- Qualquer falha interrompe com "FALHOU: ...".
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- Usuários de teste --------------------------------------------------
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'cliente.a@teste.com'),
  ('00000000-0000-0000-0000-00000000000b', 'cliente.b@teste.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@teste.com');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

create or replace function pg_temp.as_user(p_sub text, p_aal text default 'aal1') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'aal', p_aal, 'email', p_sub || '@t', 'role', 'authenticated')::text, false);
end $$;

-- ---------------------------------------------------------------------
-- 1. Anônimo não lê nada pessoal
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '', false);
set role anon;
do $$
declare t text;
begin
  foreach t in array array['clients','client_records','appointments','service_history','audit_log','admins','schedule_exceptions'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FALHOU: anon conseguiu ler %', t;
    exception when insufficient_privilege then
      raise notice 'OK  anon bloqueado em %', t;
    end;
  end loop;
end $$;

do $$
begin
  begin
    perform public.get_my_profile();
    raise exception 'FALHOU: anon executou get_my_profile';
  exception when insufficient_privilege then raise notice 'OK  anon não executa RPC de cliente'; end;
  begin
    insert into public.services (name) values ('hack');
    raise exception 'FALHOU: anon inseriu serviço';
  exception when insufficient_privilege then raise notice 'OK  anon não escreve em services'; end;
  if (select count(*) from public.services) = 0 then raise exception 'FALHOU: anon deveria ver serviços'; end if;
  raise notice 'OK  anon lê serviços públicos';
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 2. Cliente A cria perfil e agenda
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
begin
  begin
    perform public.upsert_my_profile('Ana Teste', '(11) 99999-0000', null, false);
    raise exception 'FALHOU: criou perfil sem consentimento LGPD';
  exception when sqlstate '22023' then raise notice 'OK  exige consentimento LGPD'; end;
  perform public.upsert_my_profile('Ana Teste', '(11) 99999-0000', null, true);
  raise notice 'OK  cliente A criou perfil';
end $$;

-- descobre um horário livre de corte
do $$
declare v_service uuid; v_day date; v_slot timestamptz; v_id uuid;
begin
  select id into v_service from public.services where name = 'Corte + Escova';
  select day into v_day from public.get_available_days(v_service, null, null, 30) limit 1;
  if v_day is null then raise exception 'FALHOU: nenhum dia disponível'; end if;
  select starts_at into v_slot from public.get_available_slots(v_day, v_service, null) limit 1;
  v_id := public.book_appointment(v_service, null, v_slot, 'primeira vez');
  perform set_config('test.slot', v_slot::text, false);
  perform set_config('test.service', v_service::text, false);
  raise notice 'OK  cliente A agendou % (status pendente)', v_slot;
  if (select status from public.get_my_appointments() limit 1) <> 'pendente' then
    raise exception 'FALHOU: status deveria ser pendente';
  end if;
  if (select price from public.get_my_appointments() limit 1) <> 120 then
    raise exception 'FALHOU: preço deveria vir do servidor (120)';
  end if;
  raise notice 'OK  preço calculado no servidor';
end $$;

-- Cliente não lê tabelas diretamente
do $$
begin
  if (select count(*) from public.clients) <> 0 then raise exception 'FALHOU: cliente leu tabela clients'; end if;
  if (select count(*) from public.appointments) <> 0 then raise exception 'FALHOU: cliente leu appointments'; end if;
  if (select count(*) from public.client_records) <> 0 then raise exception 'FALHOU: cliente leu ficha técnica'; end if;
  if (select count(*) from public.service_history) <> 0 then raise exception 'FALHOU: cliente leu service_history'; end if;
  raise notice 'OK  cliente não lê tabelas internas';
  begin
    insert into public.appointments (client_id, service_name, starts_at, ends_at, status)
    select id, 'x', now(), now() + interval '1h', 'confirmado' from public.clients limit 1;
    -- insert vazio não prova nada; tenta com id conhecido
    insert into public.appointments (client_id, service_name, starts_at, ends_at, status)
    values (gen_random_uuid(), 'hack', now(), now() + interval '1h', 'confirmado');
    raise exception 'FALHOU: cliente inseriu agendamento direto';
  exception when insufficient_privilege or foreign_key_violation then
    raise notice 'OK  cliente não insere agendamento direto (RLS)';
  end;
  begin
    insert into public.service_history (client_id, service_name) values (gen_random_uuid(), 'hack');
    raise exception 'FALHOU: cliente escreveu no histórico';
  exception when insufficient_privilege or foreign_key_violation then
    raise notice 'OK  cliente não escreve procedimentos realizados';
  end;
  begin
    insert into public.admins (user_id) values (auth.uid());
    raise exception 'FALHOU: cliente se promoveu a admin';
  exception when insufficient_privilege then raise notice 'OK  cliente não vira admin'; end;
  begin
    perform public.admin_merge_clients(gen_random_uuid(), gen_random_uuid());
    raise exception 'FALHOU: cliente executou função de admin';
  exception when insufficient_privilege then raise notice 'OK  função de admin bloqueada'; end;
  if (select count(*) from storage.objects) <> 0 then raise exception 'FALHOU'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 3. Cliente B não vê nada da cliente A e não pega o mesmo horário
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$
begin
  perform public.upsert_my_profile('Bia Teste', '11988887777', null, true);
  if (select count(*) from public.get_my_appointments()) <> 0 then
    raise exception 'FALHOU: cliente B viu agendamentos da A';
  end if;
  if (public.get_my_profile() ->> 'full_name') <> 'Bia Teste' then
    raise exception 'FALHOU: perfil errado';
  end if;
  raise notice 'OK  cliente B isolada da cliente A';
  -- com Laís e Gabi, cabem 2 clientes no mesmo horário
  perform public.book_appointment(current_setting('test.service')::uuid, null,
                                  current_setting('test.slot')::timestamptz, null);
  raise notice 'OK  segunda cliente no mesmo horário (2 atendentes)';
  begin
    perform public.book_appointment(current_setting('test.service')::uuid, null,
                                    current_setting('test.slot')::timestamptz, null);
    raise exception 'FALHOU: três clientes no mesmo horário com duas atendentes';
  exception when sqlstate '22023' then raise notice 'OK  terceira cliente no mesmo horário bloqueada'; end;
  if exists (select 1 from public.get_available_slots(
              (current_setting('test.slot')::timestamptz at time zone 'America/Sao_Paulo')::date,
              current_setting('test.service')::uuid, null) g
             where g.starts_at = current_setting('test.slot')::timestamptz) then
    raise exception 'FALHOU: horário lotado ainda aparece';
  end if;
end $$;

-- B não consegue cancelar o agendamento de A
do $$
declare v_id uuid;
begin
  reset role;
  select a.id into v_id from public.appointments a join public.clients c on c.id = a.client_id where c.full_name = 'Ana Teste' limit 1;
  perform set_config('test.appt', v_id::text, false);
end $$;
set role authenticated;
do $$
begin
  begin
    perform public.cancel_my_appointment(current_setting('test.appt')::uuid);
    raise exception 'FALHOU: B cancelou agendamento da A';
  exception when sqlstate '22023' then raise notice 'OK  B não cancela agendamento da A'; end;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 4. Admin SEM MFA (aal1) não acessa nada
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal1');
set role authenticated;
do $$
begin
  if (select count(*) from public.clients) <> 0 then raise exception 'FALHOU: admin sem MFA leu clientes'; end if;
  if public.is_admin() then raise exception 'FALHOU: is_admin sem MFA'; end if;
  if not (public.whoami() ->> 'is_admin_account')::boolean then raise exception 'FALHOU: whoami'; end if;
  raise notice 'OK  admin sem MFA é bloqueada';
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 5. Admin COM MFA (aal2) gerencia tudo
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal2');
set role authenticated;
do $$
declare v_client uuid; v_hist uuid;
begin
  if (select count(*) from public.clients) <> 2 then raise exception 'FALHOU: admin deveria ver 2 clientes'; end if;
  update public.appointments set status = 'confirmado' where id = current_setting('test.appt')::uuid;
  insert into public.staff_absences (staff_id, date, note)
  values ((select id from public.staff where name = 'Gabi'), current_date + 40, 'teste');
  delete from public.staff_absences where note = 'teste';
  select client_id into v_client from public.appointments where id = current_setting('test.appt')::uuid;
  insert into public.client_records (client_id, hair_type, allergies) values (v_client, 'Liso fino', 'Nenhuma');
  insert into public.service_history (client_id, service_name, formula, internal_notes, client_notes, price)
  values (v_client, 'Corte sem escova', '7.1 + 20vol', 'cliente prefere franja', 'Hidratar 1x/semana', 90)
  returning id into v_hist;
  -- agendamento manual (pedido pelo WhatsApp), procedimento fora da lista
  insert into public.appointments (client_id, service_name, starts_at, ends_at, status, price)
  values (v_client, 'Corte sem escova', now() + interval '3 days', now() + interval '3 days 40 minutes', 'confirmado', 90);
  insert into public.clients (full_name, phone) values ('Cliente do WhatsApp', '11977776666');
  update public.services set featured = true where name = 'Progressiva';
  insert into public.schedule_exceptions (date, kind, note) values (current_date + 10, 'fechado', 'Feriado');
  if (select count(*) from public.audit_log) = 0 then raise exception 'FALHOU: auditoria vazia'; end if;
  raise notice 'OK  admin com MFA gerencia clientes, ficha, histórico, agenda, serviços e exceções';
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 6. Cliente vê o próprio histórico SEM dados internos e não edita
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
declare j jsonb;
begin
  select to_jsonb(h) into j from public.get_my_history() h limit 1;
  if j is null then raise exception 'FALHOU: cliente não vê o próprio histórico'; end if;
  if j ? 'formula' or j ? 'internal_notes' or j ? 'products' then
    raise exception 'FALHOU: histórico expõe dados internos';
  end if;
  update public.service_history set price = 0;   -- deve afetar 0 linhas
  reset role;
  if exists (select 1 from public.service_history where price = 0) then
    raise exception 'FALHOU: cliente alterou procedimento realizado';
  end if;
  raise notice 'OK  histórico da cliente é somente leitura e sem dados internos';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
declare j jsonb;
begin
  j := public.export_my_data();
  if (j -> 'ficha_tecnica' ->> 'allergies') is distinct from 'Nenhuma' then
    raise exception 'FALHOU: exportação LGPD sem a ficha técnica';
  end if;
  if (j -> 'ficha_tecnica') ? 'notes' then raise exception 'FALHOU: exportação com anotação interna'; end if;
  raise notice 'OK  exportação LGPD inclui a ficha técnica';
end $$;
reset role;

-- agendamento pendente no passado não pode ser cancelado
do $$
declare v_id uuid;
begin
  insert into public.appointments (client_id, service_name, starts_at, ends_at, status)
  select id, 'Antigo', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'pendente'
    from public.clients where full_name = 'Ana Teste' returning id into v_id;
  perform set_config('test.old', v_id::text, false);
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
begin
  begin
    perform public.cancel_my_appointment(current_setting('test.old')::uuid);
    raise exception 'FALHOU: cancelou agendamento no passado';
  exception when sqlstate '22023' then raise notice 'OK  não cancela agendamento que já passou'; end;
end $$;
reset role;

-- limite de pedidos pendentes por cliente
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
declare v_service uuid; d date; v_slot timestamptz; n int := 0;
begin
  select id into v_service from public.services where name = 'Corte + Escova';
  for d in select day from public.get_available_days(v_service, null, null, 40) loop
    select starts_at into v_slot from public.get_available_slots(d, v_service, null) limit 1;
    begin
      perform public.book_appointment(v_service, null, v_slot, null);
      n := n + 1;
    exception when sqlstate '22023' then
      if sqlerrm <> 'too_many_pending' then raise; end if;
      exit;
    end;
  end loop;
  if (select count(*) from public.get_my_appointments() where status = 'pendente' and starts_at > now()) > 3 then
    raise exception 'FALHOU: passou do limite de pendentes';
  end if;
  raise notice 'OK  limite de % pedidos pendentes respeitado', 3;
end $$;
reset role;
reset role;

-- ---------------------------------------------------------------------
-- 7. Regras de agenda: luzes só sexta/sábado das 9h às 12h
-- ---------------------------------------------------------------------
do $$
declare v_service uuid; d date; r record; n int := 0;
begin
  select id into v_service from public.services where name = 'Luzes / Mechas';
  for d in select generate_series(current_date + 1, current_date + 21, interval '1 day')::date loop
    for r in select g.starts_at from public.get_available_slots(d, v_service, 'curto') g loop
      n := n + 1;
      if extract(dow from d) not in (5, 6) then raise exception 'FALHOU: luzes em dia %', d; end if;
      if (r.starts_at at time zone 'America/Sao_Paulo')::time not between '09:00' and '12:00' then
        raise exception 'FALHOU: luzes fora da janela: %', r.starts_at;
      end if;
    end loop;
  end loop;
  if n = 0 then raise exception 'FALHOU: nenhum horário de luzes'; end if;
  -- penteado indisponível no extra longo
  if exists (select 1 from public.get_available_days(
               (select id from public.services where name = 'Penteado'), 'extra_longo', null, 30)) then
    raise exception 'FALHOU: penteado extra longo deveria estar indisponível';
  end if;
  -- nunca domingo/segunda
  if exists (select 1 from public.get_available_days(
               (select id from public.services where name = 'Corte + Escova'), null, null, 30) x
             where extract(dow from x.day) in (0, 1)) then
    raise exception 'FALHOU: agenda aberta em domingo/segunda';
  end if;
  -- dia fechado por exceção
  if exists (select 1 from public.get_available_slots(current_date + 10,
               (select id from public.services where name = 'Corte + Escova'), null)) then
    raise exception 'FALHOU: exceção de dia fechado ignorada';
  end if;
  raise notice 'OK  regras de agenda (luzes sex/sáb 9h–12h, penteado extra longo, ter–sáb, feriado)';
end $$;


-- ---------------------------------------------------------------------
-- 7b. Equipe: Laís + Gabi; Gabi não faz mechas; ausências
-- ---------------------------------------------------------------------
reset role;
do $$
declare
  v_corte uuid := (select id from public.services where name = 'Corte + Escova');
  v_mecha uuid := (select id from public.services where name = 'Luzes / Mechas');
  v_ana uuid := (select id from public.clients where full_name = 'Ana Teste');
  v_laís uuid := (select id from public.staff where name = 'Laís');
  v_gabi uuid := (select id from public.staff where name = 'Gabi');
  d date;  d2 date;  t timestamptz;
  has_slot boolean;
begin
  -- duas sextas livres, a partir de 30 dias
  select x::date into d from generate_series(current_date + 30, current_date + 40, interval '1 day') x where extract(dow from x) = 5 limit 1;
  d2 := d + 7;
  t := (d + time '10:00') at time zone 'America/Sao_Paulo';

  -- mecha às 10h: outra mecha não cabe, corte cabe (Gabi atende)
  insert into public.appointments (client_id, service_id, service_name, hair_length, starts_at, ends_at, status)
  values (v_ana, v_mecha, 'Luzes / Mechas', 'curto', t, t + interval '1 hour', 'confirmado');
  if exists (select 1 from public.get_available_slots(d, v_mecha, 'curto') g where g.starts_at = t) then
    raise exception 'FALHOU: duas mechas no mesmo horário';
  end if;
  if not exists (select 1 from public.get_available_slots(d, v_corte, null) g where g.starts_at = t) then
    raise exception 'FALHOU: corte deveria caber junto com mecha';
  end if;
  raise notice 'OK  nunca duas mechas juntas; mecha + outro serviço cabe';

  -- corte também às 10h: horário lotado
  insert into public.appointments (client_id, service_id, service_name, starts_at, ends_at, status)
  values (v_ana, v_corte, 'Corte + Escova', t, t + interval '1 hour', 'confirmado');
  if exists (select 1 from public.get_available_slots(d, v_corte, null) g where g.starts_at = t) then
    raise exception 'FALHOU: horário com 2 atendimentos deveria lotar';
  end if;
  delete from public.appointments where starts_at = t and client_id = v_ana;

  -- corte atribuído à Laís às 10h bloqueia mecha (ela está ocupada)
  insert into public.appointments (client_id, service_id, service_name, staff_id, starts_at, ends_at, status)
  values (v_ana, v_corte, 'Corte + Escova', v_laís, t, t + interval '1 hour', 'confirmado');
  if exists (select 1 from public.get_available_slots(d, v_mecha, 'curto') g where g.starts_at = t) then
    raise exception 'FALHOU: mecha com a Laís ocupada';
  end if;
  delete from public.appointments where starts_at = t and client_id = v_ana;
  raise notice 'OK  atendimento atribuído à Laís bloqueia mecha no mesmo horário';

  -- só a Laís no dia (Gabi ausente): 1 cliente por horário
  insert into public.staff_absences (staff_id, date) values (v_gabi, d);
  insert into public.appointments (client_id, service_id, service_name, starts_at, ends_at, status)
  values (v_ana, v_corte, 'Corte + Escova', t, t + interval '1 hour', 'confirmado');
  if exists (select 1 from public.get_available_slots(d, v_corte, null) g where g.starts_at = t) then
    raise exception 'FALHOU: com uma atendente, cabe só 1 cliente';
  end if;
  raise notice 'OK  dia com uma atendente: 1 cliente por horário';

  -- só a Gabi (Laís ausente das 9h às 13h): sem mechas, cortes normais
  insert into public.staff_absences (staff_id, date, all_day, from_time, to_time) values (v_laís, d2, false, '09:00', '13:00');
  if exists (select 1 from public.get_available_slots(d2, v_mecha, 'curto')) then
    raise exception 'FALHOU: mecha agendável sem a Laís';
  end if;
  select exists (select 1 from public.get_available_slots(d2, v_corte, null)) into has_slot;
  if not has_slot then raise exception 'FALHOU: Gabi deveria atender cortes'; end if;
  raise notice 'OK  sem a Laís não há mechas; Gabi segue atendendo';

  -- ninguém trabalhando: nenhum horário
  insert into public.staff_absences (staff_id, date) values (v_laís, d + 14), (v_gabi, d + 14);
  if exists (select 1 from public.get_available_slots(d + 14, v_corte, null)) then
    raise exception 'FALHOU: horários sem nenhuma atendente';
  end if;
  raise notice 'OK  sem atendentes, agenda fechada';
end $$;

-- anônimo não vê ausências, mas vê nomes da equipe
set role anon;
do $$
begin
  begin
    perform count(*) from public.staff_absences;
    raise exception 'FALHOU: anon leu ausências';
  exception when insufficient_privilege then raise notice 'OK  anon não vê ausências da equipe'; end;
  if (select count(*) from public.staff) <> 2 then raise exception 'FALHOU: equipe pública'; end if;
end $$;
reset role;

-- cliente e admin sem MFA não mexem na equipe nem chamam slot_has_capacity
do $$
declare who text;
begin
  foreach who in array array['00000000-0000-0000-0000-00000000000a:aal1', '00000000-0000-0000-0000-0000000000ad:aal1'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', split_part(who, ':', 1), 'aal', split_part(who, ':', 2), 'role', 'authenticated')::text, false);
    set local role authenticated;
    if (select count(*) from public.staff_absences) <> 0 then raise exception 'FALHOU: % leu ausências', who; end if;
    update public.staff set active = false;
    begin
      insert into public.staff (name) values ('Intrusa');
      raise exception 'FALHOU: % criou atendente', who;
    exception when insufficient_privilege then null; end;
    begin
      perform public.slot_has_capacity(now(), now() + interval '1 hour', null);
      raise exception 'FALHOU: % executou slot_has_capacity', who;
    exception when insufficient_privilege then null; end;
    reset role;
  end loop;
  if exists (select 1 from public.staff where not active) then raise exception 'FALHOU: equipe alterada sem permissão'; end if;
  raise notice 'OK  cliente e admin sem MFA não alteram a equipe';
end $$;

set role anon;
do $$
begin
  begin
    perform public.slot_has_capacity(now(), now() + interval '1 hour', null);
    raise exception 'FALHOU: anon executou slot_has_capacity';
  exception when insufficient_privilege then raise notice 'OK  anon não executa slot_has_capacity'; end;
  begin
    insert into public.staff (name) values ('Intrusa');
    raise exception 'FALHOU: anon criou atendente';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- excluir atendente limpa os serviços restritos a ela
do $$
declare v_tmp uuid;
begin
  insert into public.staff (name, active) values ('Temporária', false) returning id into v_tmp;
  update public.services set staff_only = array[v_tmp] where name = 'Progressiva';
  delete from public.staff where id = v_tmp;
  if (select staff_only from public.services where name = 'Progressiva') is not null then
    raise exception 'FALHOU: serviço ficou com atendente excluída';
  end if;
  raise notice 'OK  excluir atendente limpa os serviços';
end $$;

-- ---------------------------------------------------------------------
-- 8. LGPD: excluir conta
-- ---------------------------------------------------------------------
update public.clients set photo_path = 'cliente-b/perfil/foto.webp' where full_name = 'Bia Teste';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.delete_my_account();
reset role;
do $$
begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FALHOU: conta não excluída';
  end if;
  if exists (select 1 from public.clients where full_name = 'Bia Teste') then
    raise exception 'FALHOU: dados não excluídos';
  end if;
  if not exists (select 1 from public.storage_purge where path = 'cliente-b/perfil/foto.webp') then
    raise exception 'FALHOU: foto da cliente não entrou na fila de exclusão';
  end if;
  raise notice 'OK  exclusão de conta (LGPD), fotos na fila de limpeza';
end $$;

\echo '==== TODOS OS TESTES DE SEGURANÇA PASSARAM ===='
