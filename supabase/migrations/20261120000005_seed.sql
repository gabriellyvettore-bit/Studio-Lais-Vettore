-- =====================================================================
-- Dados iniciais — tudo pode ser alterado pela Laís no painel
-- =====================================================================

-- Horário: terça (2) a sábado (6), primeiro horário 9h, último 16h
insert into public.business_hours (weekday, is_open, first_start, last_start) values
  (0, false, '09:00', '16:00'),
  (1, false, '09:00', '16:00'),
  (2, true,  '09:00', '16:00'),
  (3, true,  '09:00', '16:00'),
  (4, true,  '09:00', '16:00'),
  (5, true,  '09:00', '16:00'),
  (6, true,  '09:00', '16:00')
on conflict (weekday) do nothing;

-- Equipe
insert into public.staff (name, sort_order) values ('Laís', 1), ('Gabi', 2);

-- Serviços
with s as (
  insert into public.services
    (name, description, category, price_mode, duration_min, allowed_weekdays,
     start_window_from, start_window_to, featured, sort_order)
  values
    ('Corte + Escova', 'Corte personalizado para o seu formato de rosto, finalizado com escova.',
     'Corte', 'unico', 60, '{2,3,4,5,6}', null, null, true, 10),
    ('Coloração de Raiz', 'Retoque de raiz com coloração profissional, cobertura uniforme e brilho.',
     'Cor', 'unico', 120, '{2,3,4,5,6}', null, null, false, 20),
    ('Luzes / Mechas', 'Loiro construído sob medida — iluminado, natural e saudável. Nossa especialidade.',
     'Cor', 'por_comprimento', 60, '{5,6}', '09:00', '12:00', true, 30),
    ('Botox Capilar', 'Tratamento de reposição de massa que reduz o volume e devolve maciez e brilho.',
     'Tratamento', 'por_comprimento', 120, '{2,3,4,5,6}', null, null, false, 40),
    ('Progressiva', 'Alisamento progressivo com acabamento natural e movimento.',
     'Tratamento', 'por_comprimento', 150, '{2,3,4,5,6}', null, null, false, 50),
    ('Penteado', 'Penteados para festas, formaturas e eventos.',
     'Penteado', 'por_comprimento', 60, '{2,3,4,5,6}', null, null, true, 60)
  returning id, name
)
insert into public.service_prices (service_id, hair_length, price, duration_min, unavailable)
select s.id, p.hair_length::public.hair_length, p.price, p.duration_min, p.unavailable
  from s
  join (values
    ('Corte + Escova',     null,          120.00, null, false),
    ('Coloração de Raiz',  null,          160.00, null, false),
    ('Luzes / Mechas',     'curto',       500.00, null, false),
    ('Luzes / Mechas',     'medio',       null,   null, false),
    ('Luzes / Mechas',     'longo',       null,   null, false),
    ('Luzes / Mechas',     'extra_longo', null,   null, false),
    ('Botox Capilar',      'curto',       250.00, 120,  false),
    ('Botox Capilar',      'medio',       null,   150,  false),
    ('Botox Capilar',      'longo',       null,   180,  false),
    ('Botox Capilar',      'extra_longo', null,   210,  false),
    ('Progressiva',        'curto',       250.00, 150,  false),
    ('Progressiva',        'medio',       null,   180,  false),
    ('Progressiva',        'longo',       null,   210,  false),
    ('Progressiva',        'extra_longo', null,   240,  false),
    ('Penteado',           'curto',       250.00, null, false),
    ('Penteado',           'medio',       250.00, null, false),
    ('Penteado',           'longo',       250.00, null, false),
    ('Penteado',           'extra_longo', null,   null, true)
  ) as p(name, hair_length, price, duration_min, unavailable)
  on p.name = s.name;

-- Mechas/luzes: só a Laís faz
update public.services
   set staff_only = array[(select id from public.staff where name = 'Laís')]
 where name = 'Luzes / Mechas';

-- Configurações
insert into public.site_settings (key, value) values
  ('booking', jsonb_build_object(
      'min_advance_hours', 12,
      'cancel_hours', 24,
      'slot_step_min', 30,
      'horizon_days', 60,
      'max_pending_per_client', 3
  )),
  ('contact', jsonb_build_object(
      'whatsapp', 'https://wa.me/message/Q3WKUDLIJU73M1',
      'phone', '(11) 2459-6382',
      'instagram', 'studiolaisvettore',
      'address', 'Rua Jacareí, 128 — Vila Rosália',
      'city', 'Guarulhos — SP',
      'cep', '07064-140',
      'maps_url', 'https://maps.google.com/?q=Rua+Jacare%C3%AD,+128,+Vila+Ros%C3%A1lia,+Guarulhos+-+SP'
  )),
  ('home', jsonb_build_object(
      'hero_kicker', 'Studio de beleza em Guarulhos',
      'hero_title', 'Loiros com assinatura.',
      'hero_text', 'Cor, corte e cuidado feitos sob medida por Laís Vettore e equipe. Escolha seu serviço, veja os horários livres e agende em poucos toques.',
      'about_title', 'Sobre a Laís',
      'about_text', 'Especialista em loiros, mega hair e dia da noiva, a Laís transformou o studio na Vila Rosália em um espaço acolhedor, onde cada cliente sai com um cabelo que conversa com a sua história. Cada atendimento começa com uma conversa — e termina com aquela vontade de se olhar no espelho de novo.',
      'bride_text', 'Do teste ao grande dia: penteado, maquiagem, sala privativa e uma equipe inteira dedicada a você e às suas madrinhas.'
  ))
on conflict (key) do nothing;

-- Galeria inicial (fotos do Instagram @studiolaisvettore, autorizadas)
insert into public.gallery_items (image_url, caption, category, sort_order) values
  ('img/galeria/loiro-quente.webp',       'Loiro quente e delicado',      'Loiros',  10),
  ('img/galeria/morena-iluminada.webp',   'Morena iluminada',             'Morenas', 20),
  ('img/galeria/loiro-iluminado.webp',    'Loiro iluminado',              'Loiros',  30),
  ('img/galeria/noiva-coque.webp',        'Coque para noiva',             'Noivas',  40),
  ('img/galeria/cacheado.webp',           'Cachos com luzes',             'Cachos',  50),
  ('img/galeria/morena-ondas.webp',       'Morena iluminada com ondas',   'Morenas', 60),
  ('img/galeria/loiro-sorriso.webp',      'Loiro natural',                'Loiros',  70),
  ('img/galeria/morena-mechas.webp',      'Fundo e naturalidade',         'Morenas', 80),
  ('img/galeria/atendimento-lais.webp',   'Laís finalizando',             'Studio',  90),
  ('img/galeria/morena-iluminada-2.webp', 'Morena iluminada — detalhe',   'Morenas', 100),
  ('img/galeria/noiva-coque-2.webp',      'Detalhes do penteado',         'Noivas',  110),
  ('img/galeria/cacheado-2.webp',         'Cachos',                       'Cachos',  120),
  ('img/galeria/lais-finalizando.webp',   'Loiro com ondas',              'Loiros',  130);
