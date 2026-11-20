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

## 3. Login (Supabase → Authentication)
1. *URL Configuration*:
   - **Site URL**: `https://gabriellyvettore-bit.github.io/Studio-Lais-Vettore/`
   - **Redirect URLs**: a mesma URL acima (e `http://localhost:5173/Studio-Lais-Vettore/` para testes).
2. *Providers → Email*: deixe ativo (“magic link”) — é por onde entram as clientes sem conta Google.
   Para os e-mails chegarem às clientes, configure o envio pelo Gmail do studio em *Authentication → Emails → SMTP Settings*:
   host `smtp.gmail.com`, porta `465`, usuário e remetente `studiolaisvettore@gmail.com`, senha = **senha de app** do Google
   (myaccount.google.com/apppasswords; exige verificação em duas etapas na conta).
3. *Providers → Google*:
   1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto → *APIs e serviços → Tela de consentimento OAuth* (tipo Externo, nome “Studio Lais Vettore”).
   2. *Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web*.
   3. Em *URIs de redirecionamento autorizados*, cole a **Callback URL** mostrada pelo Supabase na tela do provedor Google (`https://<projeto>.supabase.co/auth/v1/callback`).
   4. Copie *Client ID* e *Client Secret* para o Supabase e salve.
4. *Multi-Factor* (MFA): confirme que **TOTP** está habilitado.
5. *Rate Limits*: mantenha os limites padrão. Opcional: *Attack Protection → Captcha* com Cloudflare Turnstile.

## 4. Conta de administração (studiolaisvettore@gmail.com)
Laís e Gabi usam **uma única conta**: `studiolaisvettore@gmail.com`.
1. Entrem no site uma vez com essa conta (botão Google).
2. No Supabase, *SQL Editor*:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'studiolaisvettore@gmail.com';
   ```
3. Acessem **Área do studio** (rodapé) → o site mostra um QR code do **Google Authenticator**. **As duas escaneiam o mesmo QR**, cada uma no seu celular, antes de digitar o código. A partir daí, o painel sempre pede o código de 6 dígitos (vale o de qualquer um dos dois celulares).

> Se ela trocar de celular e perder o autenticador: no Supabase, *Authentication → Users → (usuária) → Factors*, remova o fator e ela configura de novo.

## 5. WhatsApp
Já vem configurado com o link do Instagram do studio (`wa.me/message/Q3WKUDLIJU73M1`). Para trocar, painel → **Textos e contato** (aceita número com DDD ou link wa.me). Com número, as mensagens já abrem escritas (ex.: “Gostaria de agendar Penteado para cabelo extra longo”).

## Backups
O plano gratuito do Supabase guarda backups diários por pouco tempo. Recomenda-se exportar periodicamente (*Database → Backups* ou `pg_dump`). Projetos gratuitos sem acesso por 7 dias podem ser pausados — basta reativar no painel do Supabase (o uso diário do site evita isso).
