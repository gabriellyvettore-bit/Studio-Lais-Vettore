# Studio Lais Vettore — instruções para o Claude

- Site em português (pt-BR). Textos para clientes: tom acolhedor e elegante, sem clichês.
- Stack: Vite + React + TS + Tailwind v4 (`@utility` em `src/index.css`), HashRouter, Supabase.
- **Segurança é prioridade máxima.** Qualquer mudança em `supabase/` ou em fluxo de dados deve:
  1. manter RLS "negar por padrão" e funções `security definer` com `search_path = ''`;
  2. ganhar teste em `supabase/tests/rls_test.sql`;
  3. passar pelo agente `seguranca` antes do commit.
- Mudanças visuais passam pelo agente `design` (identidade em `.claude/agents/design.md`).
- `.env.production` guarda só a URL e a chave *publishable* (públicas). Nunca commitar `.env.local`, chave `sb_secret_…` ou `service_role`.
- Testar o banco localmente: Postgres 16 + `supabase/tests/00_local_supabase_shim.sql` + migrações + `rls_test.sql`.
- Build: `npm run build` (tsc + vite). O deploy é feito pelo GitHub Actions ao dar push na `main`.
