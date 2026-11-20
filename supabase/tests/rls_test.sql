-- =====================================================================
-- Testes de segurança (RLS + RPC) — fluxo SEM cadastro
-- Rodar contra um banco de TESTE já com as migrações aplicadas.
-- Qualquer falha interrompe com "FALHOU: ...".
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'intrusa@teste.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@teste.com');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

create or replace function pg_temp.as_user(p_sub text, p_aal text default 'aal1') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'aal', p_aal, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.anon() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '', false); end $$;

-- ---------------------------------------------------------------------
-- 1. Anônimo não lê nada pessoal nem tabelas internas
-- ---------------------------------------------------------------------
select pg_temp.anon();
set role anon;
do $$
declare t text;
begin
  foreach t in array array['clients','client_records','appointments','service_history','audit_log','admins',
                           'schedule_exceptions','staff_absences','client_sessions','guest_attempts','storage_purge'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FALHOU: anon conseguiu ler %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK  anon bloqueado em todas as tabelas internas';
  foreach t in array array['get_my_profile()', 'is_admin()', 'booking_int(''x'',1)', '_new_session(gen_random_uuid())',
                           '_session_client(''x'')', 'slot_has_capacity(now(), now(), null)'] loop
    begin
      execute 'select public.' || t;
      raise exception 'FALHOU: anon executou %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK  anon não executa funções internas';
  if (select count(*) from public.services) = 0 then raise exception 'FALHOU: anon deveria ver serviços'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 2. Ana agenda sem cadastro (nome, celular, nascimento)
-- ---------------------------------------------------------------------
select pg_temp.anon();
set role anon;
do $$
declare v_service uuid; v_day date; v_slot timestamptz; r jsonb;
begin
  select id into v_service from public.services where name = 'Corte + Escova';
  select day into v_day from public.get_available_days(v_service, null, null, 30) limit 1;
  select starts_at into v_slot from public.get_available_slots(v_day, v_service, null) limit 1;
  begin
    perform public.book_as_guest('Ana Teste', '(11) 99999-0000', '1990-05-10', v_service, null, v_slot, null, false);
    raise exception 'FALHOU: agendou sem consentimento LGPD';
  exception when sqlstate '22023' then raise notice 'OK  exige consentimento LGPD'; end;
  begin
    perform public.book_as_guest('Ana Teste', '123', '1990-05-10', v_service, null, v_slot, null, true);
    raise exception 'FALHOU: aceitou celular inválido';
  exception when sqlstate '22023' then raise notice 'OK  valida celular'; end;
  r := public.book_as_guest('Ana Teste', '(11) 99999-0000', '1990-05-10', v_service, null, v_slot, 'primeira vez', true);
  if r ->> 'token' is null or char_length(r ->> 'token') <> 64 then raise exception 'FALHOU: sem token de sessão'; end if;
  perform set_config('test.ana', r ->> 'token', false);
  perform set_config('test.slot', v_slot::text, false);
  perform set_config('test.service', v_service::text, false);
  perform set_config('test.appt', r ->> 'appointment_id', false);
  if (select status from public.guest_appointments(r ->> 'token') limit 1) <> 'pendente' then
    raise exception 'FALHOU: status deveria ser pendente';
  end if;
  if (select price from public.guest_appointments(r ->> 'token') limit 1) <> 120 then
    raise exception 'FALHOU: preço deveria vir do servidor (120)';
  end if;
  raise notice 'OK  Ana agendou sem cadastro; pendente; preço do servidor';
end $$;
reset role;

-- a sessão é guardada só como hash
do $$
begin
  if exists (select 1 from public.client_sessions where token_hash = current_setting('test.ana')) then
    raise exception 'FALHOU: token guardado em texto puro';
  end if;
  raise notice 'OK  token guardado só como hash';
end $$;

-- ---------------------------------------------------------------------
-- 3. Bia e intrusas: isolamento entre clientes
-- ---------------------------------------------------------------------
select pg_temp.anon();
set role anon;
do $$
declare r jsonb;
begin
  -- segunda cliente no mesmo horário (2 atendentes)
  r := public.book_as_guest('Bia Teste', '11988887777', '1985-01-20', current_setting('test.service')::uuid, null,
                            current_setting('test.slot')::timestamptz, null, true);
  perform set_config('test.bia', r ->> 'token', false);
  if (select count(*) from public.guest_appointments(r ->> 'token')) <> 1 then
    raise exception 'FALHOU: Bia vê agendamentos que não são dela';
  end if;
  raise notice 'OK  Bia agendou no mesmo horário (2 atendentes) e só vê o dela';
  begin
    perform public.book_as_guest('Carla Teste', '11977770000', '1980-01-01', current_setting('test.service')::uuid, null,
                                 current_setting('test.slot')::timestamptz, null, true);
    raise exception 'FALHOU: três clientes no mesmo horário';
  exception when sqlstate '22023' then raise notice 'OK  terceira cliente no mesmo horário bloqueada'; end;
  begin
    perform public.guest_cancel(current_setting('test.bia'), current_setting('test.appt')::uuid);
    raise exception 'FALHOU: Bia cancelou agendamento da Ana';
  exception when sqlstate '22023' then raise notice 'OK  Bia não cancela agendamento da Ana'; end;
  if public.guest_profile('0000000000000000000000000000000000000000000000000000000000000000') is not null
     or (select count(*) from public.guest_appointments(null)) <> 0 then
    raise exception 'FALHOU: token falso deu acesso';
  end if;
  raise notice 'OK  token falso ou vazio não dá acesso a nada';
end $$;

-- alguém agenda com o celular da Ana mas sem saber o nascimento:
-- o pedido entra (a Laís confirma pelo WhatsApp), mas NÃO ganha acesso
do $$
declare r jsonb; v_day date; v_slot timestamptz;
begin
  select day into v_day from public.get_available_days(current_setting('test.service')::uuid, null, current_date + 5, 30) limit 1;
  select starts_at into v_slot from public.get_available_slots(v_day, current_setting('test.service')::uuid, null) limit 1;
  r := public.book_as_guest('Intrusa', '11 99999-0000', '2000-01-01', current_setting('test.service')::uuid, null, v_slot, null, true);
  if r ->> 'token' is not null then raise exception 'FALHOU: celular de outra pessoa deu acesso'; end if;
  if (r ->> 'first_name') <> 'Intrusa' then raise exception 'FALHOU: revelou o nome salvo da cliente'; end if;
  if exists (select 1 from public.guest_appointments(current_setting('test.ana')) where starts_at = v_slot) then
    raise exception 'FALHOU: pedido não conferido apareceu para a Ana';
  end if;
  raise notice 'OK  celular de outra pessoa sem o nascimento: pedido não conferido, sem acesso, sem revelar nome';
end $$;

-- login em outro aparelho: celular + nascimento, com limite de tentativas
do $$
declare r jsonb; i int;
begin
  r := public.guest_login('+55 (11) 99999-0000', '1990-05-10');
  if r ->> 'token' is null then raise exception 'FALHOU: login com celular + nascimento'; end if;
  for i in 1..5 loop
    if public.guest_login('11999990000', '1999-01-01') is not null then
      raise exception 'FALHOU: login com nascimento errado';
    end if;
  end loop;
  begin
    perform public.guest_login('11999990000', '1990-05-10');
    raise exception 'FALHOU: sem limite de tentativas';
  exception when sqlstate '22023' then raise notice 'OK  login por celular + nascimento, com limite de tentativas'; end;
end $$;
reset role;

-- cliente não lê tabelas internas nem como usuária autenticada
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a', 'aal2');
set role authenticated;
do $$
begin
  if public.is_admin() then raise exception 'FALHOU: usuária comum virou admin'; end if;
  if (select count(*) from public.clients) <> 0 then raise exception 'FALHOU: usuária leu clientes'; end if;
  if (select count(*) from public.appointments) <> 0 then raise exception 'FALHOU: usuária leu agendamentos'; end if;
  if (select count(*) from public.staff_absences) <> 0 then raise exception 'FALHOU: usuária leu ausências'; end if;
  update public.staff set active = false;
  begin
    insert into public.admins (user_id) values (auth.uid());
    raise exception 'FALHOU: usuária se promoveu a admin';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.appointments (client_id, service_name, starts_at, ends_at, status)
    values (gen_random_uuid(), 'hack', now(), now() + interval '1h', 'confirmado');
    raise exception 'FALHOU: usuária inseriu agendamento direto';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  begin
    perform public.admin_merge_clients(gen_random_uuid(), gen_random_uuid());
    raise exception 'FALHOU: usuária executou função de admin';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_new_invite(gen_random_uuid());
    raise exception 'FALHOU: usuária gerou convite';
  exception when insufficient_privilege then null; end;
  reset role;
  if exists (select 1 from public.staff where not active) then raise exception 'FALHOU: equipe alterada'; end if;
  raise notice 'OK  usuária autenticada comum (mesmo com aal2 forjado) não acessa nada';
end $$;
reset role;

-- ---------------------------------------------------------------------
-- 4. Admin gerencia tudo; convite exige aprovação da cliente
-- ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal1');
set role authenticated;
do $$
declare v_client uuid; v_inv uuid;
begin
  if not public.is_admin() then raise exception 'FALHOU: admin sem acesso'; end if;
  if (select count(*) from public.clients) <> 2 then raise exception 'FALHOU: admin deveria ver 2 clientes'; end if;
  update public.appointments set status = 'confirmado' where id = current_setting('test.appt')::uuid;
  select client_id into v_client from public.appointments where id = current_setting('test.appt')::uuid;
  insert into public.client_records (client_id, hair_type, allergies) values (v_client, 'Liso fino', 'Nenhuma');
  insert into public.service_history (client_id, service_name, formula, internal_notes, client_notes, price)
  values (v_client, 'Corte sem escova', '7.1 + 20vol', 'prefere franja', 'Hidratar 1x/semana', 90);
  insert into public.appointments (client_id, service_name, starts_at, ends_at, status, price)
  values (v_client, 'Corte sem escova', now() + interval '3 days', now() + interval '3 days 40 minutes', 'confirmado', 90);
  insert into public.schedule_exceptions (date, kind, note) values (current_date + 10, 'fechado', 'Feriado');

  -- Laís cadastra cliente do WhatsApp: fica aguardando confirmação
  insert into public.clients (full_name, phone) values ('Dora do WhatsApp', '11966665555')
  returning id, invite_token into v_client, v_inv;
  if v_inv is null then raise exception 'FALHOU: convite não gerado'; end if;
  perform set_config('test.dora', v_client::text, false);
  perform set_config('test.invite', v_inv::text, false);
  begin
    update public.clients set confirmed_at = now() where id = v_client;
    raise exception 'FALHOU: admin confirmou cliente sem aprovação dela';
  exception when insufficient_privilege then raise notice 'OK  Laís não confirma cadastro sem a cliente'; end;
  begin
    insert into public.clients (full_name, phone, confirmed_at, lgpd_consent_at) values ('Falsa', '11911112222', now(), now());
    raise exception 'FALHOU: admin criou cliente já confirmada';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.clients (full_name, phone) values ('Duplicada', '(11) 96666-5555');
    raise exception 'FALHOU: aceitou celular duplicado';
  exception when unique_violation then raise notice 'OK  não aceita dois cadastros com o mesmo celular'; end;
  if (select count(*) from public.audit_log) = 0 then raise exception 'FALHOU: auditoria vazia'; end if;
  raise notice 'OK  admin gerencia clientes, ficha, histórico, agenda e exceções';
end $$;
reset role;

-- Dora confirma pelo link do convite
select pg_temp.anon();
set role anon;
do $$
declare r jsonb;
begin
  if (public.invite_info(current_setting('test.invite')::uuid) ->> 'first_name') <> 'Dora' then
    raise exception 'FALHOU: convite não encontrado';
  end if;
  if public.invite_info(gen_random_uuid()) is not null then raise exception 'FALHOU: convite falso aceito'; end if;
  if (public.confirm_invite(current_setting('test.invite')::uuid, '1970-03-03', false) ->> 'error') is null then
    raise exception 'FALHOU: confirmou sem consentimento';
  end if;
  r := public.confirm_invite(current_setting('test.invite')::uuid, '1970-03-03', true);
  if r ->> 'token' is null then raise exception 'FALHOU: confirmação sem sessão'; end if;
  if (public.confirm_invite(current_setting('test.invite')::uuid, '1970-03-03', true) ->> 'error') is null then
    raise exception 'FALHOU: convite usado duas vezes';
  end if;
  raise notice 'OK  cliente confirma o cadastro pelo convite (uma vez só)';
end $$;
reset role;
do $$
begin
  if (select confirmed_at from public.clients where id = current_setting('test.dora')::uuid) is null then
    raise exception 'FALHOU: Dora não ficou confirmada';
  end if;
end $$;

-- C1: Laís cadastra Carla (sem nascimento); alguém agenda com o celular dela
reset role;
insert into public.clients (full_name, phone) values ('Carla Ficha', '21988881111');
insert into public.client_records (client_id, allergies)
select id, 'alergia a amônia' from public.clients where full_name = 'Carla Ficha';
select pg_temp.anon();
set role anon;
do $$
declare r jsonb; v_day date; v_slot timestamptz;
begin
  select day into v_day from public.get_available_days(current_setting('test.service')::uuid, null, current_date + 6, 30) limit 1;
  select starts_at into v_slot from public.get_available_slots(v_day, current_setting('test.service')::uuid, null) limit 1;
  r := public.book_as_guest('Atacante', '21988881111', '2000-01-01', current_setting('test.service')::uuid, null, v_slot, null, true);
  if r ->> 'token' is not null then raise exception 'FALHOU: estranho pegou a ficha da Carla'; end if;
end $$;
reset role;
do $$
declare c public.clients%rowtype;
begin
  select * into c from public.clients where full_name = 'Carla Ficha';
  if c.confirmed_at is not null or c.lgpd_consent_at is not null or c.birth_date is not null then
    raise exception 'FALHOU: estranho alterou/confirmou o cadastro da Carla';
  end if;
  if not exists (select 1 from public.appointments where client_id = c.id and unverified and guest_name = 'Atacante') then
    raise exception 'FALHOU: pedido não conferido não ficou marcado para a Laís';
  end if;
  raise notice 'OK  celular de cliente cadastrada pela Laís não dá acesso nem confirma (só o convite confirma)';
end $$;

-- A1: alguém se cadastra primeiro com o celular da Fernanda; a verdadeira agenda depois
select pg_temp.anon();
set role anon;
do $$
declare r1 jsonb; r2 jsonb; v_day date; v_slot timestamptz;
begin
  select day into v_day from public.get_available_days(current_setting('test.service')::uuid, null, current_date + 7, 30) limit 1;
  select starts_at into v_slot from public.get_available_slots(v_day, current_setting('test.service')::uuid, null) limit 1;
  r1 := public.book_as_guest('Falsa Fernanda', '31977776666', '1999-09-09', current_setting('test.service')::uuid, null, v_slot, null, true);
  select starts_at into v_slot from public.get_available_slots(v_day, current_setting('test.service')::uuid, null) offset 2 limit 1;
  r2 := public.book_as_guest('Fernanda Real', '31977776666', '1975-07-07', current_setting('test.service')::uuid, null, v_slot, null, true);
  if r2 ->> 'token' is not null then raise exception 'FALHOU: sessão para dados que não conferem'; end if;
  if exists (select 1 from public.guest_appointments(r1 ->> 'token') where starts_at = v_slot) then
    raise exception 'FALHOU: quem chegou antes vê o pedido da Fernanda real';
  end if;
  raise notice 'OK  pedido de quem não confere fica oculto de quem já usa o celular';
end $$;
reset role;

-- admin não usa funções de cliente; reset de acesso; merge sem herdar consentimento
insert into public.clients (full_name, phone, lgpd_consent_at, confirmed_at, birth_date)
values ('Zuleica Consentiu', '11933332222', now(), now(), '1960-01-01');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad', 'aal1');
set role authenticated;
do $$
declare v_fer uuid; v_new uuid; v_old uuid;
begin
  begin
    perform public.confirm_invite(gen_random_uuid(), '1970-01-01', true);
    raise exception 'FALHOU: admin usou confirm_invite';
  exception when insufficient_privilege then null; end;
  begin
    perform public.book_as_guest('X Y', '11955554444', '1980-01-01', current_setting('test.service')::uuid, null, now(), null, true);
    raise exception 'FALHOU: admin usou book_as_guest';
  exception when insufficient_privilege then null; end;
  raise notice 'OK  conta admin não age como cliente';
  select id into v_fer from public.clients where phone_norm = '31977776666';
  perform public.admin_reset_access(v_fer);
  insert into public.clients (full_name, phone) values ('Helena Nova', '11944443333') returning id into v_new;
  select id into v_old from public.clients where full_name = 'Zuleica Consentiu';
  perform public.admin_merge_clients(v_new, v_old);
  if (select lgpd_consent_at from public.clients where id = v_new) is not null then
    raise exception 'FALHOU: merge herdou consentimento';
  end if;
  raise notice 'OK  unir cadastros não herda consentimento';
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.client_sessions s join public.clients c on c.id = s.client_id where c.phone_norm = '31977776666') then
    raise exception 'FALHOU: reset não encerrou as sessões';
  end if;
  raise notice 'OK  resetar acesso encerra sessões e exige novo convite';
end $$;

-- ---------------------------------------------------------------------
-- 5. Histórico da cliente: só leitura e sem dados internos; LGPD
-- ---------------------------------------------------------------------
select pg_temp.anon();
set role anon;
do $$
declare j jsonb;
begin
  select to_jsonb(h) into j from public.guest_history(current_setting('test.ana')) h limit 1;
  if j is null then raise exception 'FALHOU: Ana não vê o histórico'; end if;
  if j ? 'formula' or j ? 'internal_notes' or j ? 'price' then raise exception 'FALHOU: histórico expõe dados internos'; end if;
  j := public.guest_export(current_setting('test.ana'));
  if (j -> 'ficha_tecnica' ->> 'allergies') is distinct from 'Nenhuma' then raise exception 'FALHOU: exportação sem ficha'; end if;
  if (j -> 'ficha_tecnica') ? 'notes' then raise exception 'FALHOU: exportação com anotação interna'; end if;
  raise notice 'OK  histórico só leitura, sem dados internos; exportação LGPD completa';
end $$;
reset role;

-- não cancela o que já passou; limite de pendentes
do $$
declare v_id uuid;
begin
  insert into public.appointments (client_id, service_name, starts_at, ends_at, status)
  select id, 'Antigo', now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 'pendente'
    from public.clients where full_name = 'Ana Teste' returning id into v_id;
  perform set_config('test.old', v_id::text, false);
end $$;
select pg_temp.anon();
set role anon;
do $$
declare v_service uuid := current_setting('test.service')::uuid; d date; v_slot timestamptz;
begin
  begin
    perform public.guest_cancel(current_setting('test.ana'), current_setting('test.old')::uuid);
    raise exception 'FALHOU: cancelou agendamento no passado';
  exception when sqlstate '22023' then raise notice 'OK  não cancela agendamento que já passou'; end;
  for d in select day from public.get_available_days(v_service, null, current_date + 12, 40) loop
    select starts_at into v_slot from public.get_available_slots(d, v_service, null) limit 1;
    begin
      perform public.book_as_guest(null, null, null, v_service, null, v_slot, null, false, current_setting('test.ana'));
    exception when sqlstate '22023' then
      if sqlerrm <> 'too_many_pending' then raise; end if;
      exit;
    end;
  end loop;
  if (select count(*) from public.guest_appointments(current_setting('test.ana')) where status = 'pendente' and starts_at > now()) > 3 then
    raise exception 'FALHOU: passou do limite de pendentes';
  end if;
  raise notice 'OK  cliente lembrada agenda sem redigitar dados; limite de 3 pendentes';
end $$;
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


-- ---------------------------------------------------------------------
-- 8. LGPD: excluir meus dados
-- ---------------------------------------------------------------------
update public.clients set photo_path = 'bia/perfil/foto.webp' where full_name = 'Bia Teste';
select pg_temp.anon();
set role anon;
select public.guest_delete(current_setting('test.bia'));
reset role;
do $$
begin
  if exists (select 1 from public.clients where full_name = 'Bia Teste') then raise exception 'FALHOU: dados não excluídos'; end if;
  if exists (select 1 from public.client_sessions s left join public.clients c on c.id = s.client_id where c.id is null) then
    raise exception 'FALHOU: sessão órfã';
  end if;
  if not exists (select 1 from public.storage_purge where path = 'bia/perfil/foto.webp') then
    raise exception 'FALHOU: foto não entrou na fila de exclusão';
  end if;
  raise notice 'OK  exclusão de dados (LGPD), fotos na fila de limpeza';
end $$;

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

\echo '==== TODOS OS TESTES DE SEGURANÇA PASSARAM ===='
