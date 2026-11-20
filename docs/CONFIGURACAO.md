# Configuração — passo a passo

Tempo estimado: 30 a 40 minutos, uma única vez.

## 1. GitHub Pages
1. O GitHub Pages **gratuito exige repositório público**. Em *Settings → General → Danger Zone → Change visibility*, deixe o repositório **público**.
   (O código não contém segredos e os dados das clientes ficam no Supabase, protegidos.) Outra opção é assinar o GitHub Pro.
2. Em *Settings → Pages → Build and deployment → Source*, escolha **GitHub Actions**.
3. A cada push na `main` o site é testado e publicado em
   `https://gabriellyvettore-bit.github.io/Studio-Lais-Vettore/`.

## 2. Supabase (banco de dados)
1. Crie uma conta em <https://supabase.com> e um projeto novo (região **South America (São Paulo)**). Guarde a senha do banco num lugar seguro.
2. Em *SQL Editor*, rode **em ordem** cada arquivo de `supabase/migrations/` (copiar, colar e clicar em *Run*):
   `…01_schema.sql`, `…02_functions.sql`, `…03_rls.sql`, `…04_storage.sql`, `…05_seed.sql`.
   > ⚠️ Nunca rode `supabase/tests/00_local_supabase_shim.sql` no Supabase — ele é só para testes locais.
3. Em *Project Settings → API*, copie a **Project URL** e a **anon public key**.
   **Nunca** use nem divulgue a `service_role` key.
4. A URL e a chave *publishable* ficam em `.env.production` (são públicas). Projeto atual: `bwfawuenigptmqdfrzjj`.

## 3. Login (só para a administração)
Clientes **não fazem login**: agendam com nome, celular e nascimento (funções `book_as_guest`, `guest_*`, `confirm_invite`).
A administração entra com **Google** (conta `studiolaisvettore@gmail.com`):
1. *Authentication → URL Configuration*: Site URL e Redirect URL = `https://gabriellyvettore-bit.github.io/Studio-Lais-Vettore/`.
2. *Providers → Google*: Client ID/Secret do Google Cloud (OAuth “Aplicativo da Web”, redirect `https://bwfawuenigptmqdfrzjj.supabase.co/auth/v1/callback`). O provedor de e-mail fica **desligado**.

## 4. Conta de administração (studiolaisvettore@gmail.com)
Laís e Gabi usam **uma única conta**: `studiolaisvettore@gmail.com`.
1. Entrem no site uma vez com essa conta (botão Google).
2. No Supabase, *SQL Editor*:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'studiolaisvettore@gmail.com';
   ```
3. Acessem **Área do studio** (rodapé): o painel abre direto (sem código extra, por decisão do studio). Recomenda-se ativar a verificação em duas etapas do próprio Google nessa conta.


## 5. WhatsApp
Já vem configurado com o link do Instagram do studio (`wa.me/message/Q3WKUDLIJU73M1`). Para trocar, painel → **Textos e contato** (aceita número com DDD ou link wa.me). Com número, as mensagens já abrem escritas (ex.: “Gostaria de agendar Penteado para cabelo extra longo”).

## Backups
O plano gratuito do Supabase guarda backups diários por pouco tempo. Recomenda-se exportar periodicamente (*Database → Backups* ou `pg_dump`). Projetos gratuitos sem acesso por 7 dias podem ser pausados — basta reativar no painel do Supabase (o uso diário do site evita isso).
