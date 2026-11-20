# Studio Lais Vettore — site de autoagendamento

Site do **Studio Lais Vettore** (Rua Jacareí, 128 — Vila Rosália, Guarulhos/SP · [@studiolaisvettore](https://instagram.com/studiolaisvettore)).

- **Clientes**: veem serviços e preços (por comprimento de cabelo), galeria e dia da noiva; criam conta (Google ou link no e-mail, sem senha) e **agendam sozinhas** nos horários livres. Acompanham agendamentos e histórico, podem cancelar, baixar ou excluir seus dados (LGPD).
- **Laís (admin)**: painel com **calendário completo** (dia/semana/mês), aprovação de pedidos, agendamentos manuais (inclusive procedimentos fora da lista), **ficha técnica** e histórico de cada cliente com fotos, serviços/preços/promoções, horários e dias especiais, galeria e textos do site.

## Tecnologia
| Parte | Ferramenta |
|---|---|
| Site | Vite + React + TypeScript + Tailwind CSS (HashRouter) |
| Hospedagem | GitHub Pages (deploy automático pelo GitHub Actions) |
| Banco, login e fotos | Supabase (Postgres com RLS, Auth, Storage) — plano gratuito |

## Segurança
- Regras de acesso **dentro do banco** (Row Level Security): ninguém lê dados de outra pessoa, nem com a chave pública.
- Painel exige conta admin **e verificação em duas etapas** (app autenticador) — checado no banco.
- Preço, duração e status do agendamento são calculados no servidor.
- Fotos das clientes em bucket privado, com links temporários.
- Auditoria de alterações em dados sensíveis.
- Testes automáticos de segurança rodam a cada push (`supabase/tests/rls_test.sql`).

## Pastas
```
src/pages        páginas públicas e área da cliente
src/admin        painel da Laís
supabase/        migrações (schema, funções, RLS, storage, dados iniciais) e testes
docs/            CONFIGURACAO.md (passo a passo técnico) · GUIA-LAIS.md (manual do painel)
.claude/agents   agentes especialistas: segurança e design
```

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha URL e anon key do Supabase
npm run dev
```
Sem `.env.local` o site abre com o conteúdo padrão e o agendamento mostra o botão de WhatsApp.
