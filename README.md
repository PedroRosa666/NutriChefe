# 🍽️ NutriChef

Plataforma de receitas saudáveis que conecta nutricionistas e pacientes. Tem catálogo de receitas, diário alimentar, perfil de saúde, plano alimentar semanal, lista de compras, acompanhamento de pacientes, mensagens, consultas, notificações, assinatura Premium e uma Mentoria IA que encontra receitas do catálogo a partir do que a pessoa escreve.

**No ar:** https://app.nutrichefe.workers.dev

## ✨ Funcionalidades

### Para todos
- 🔐 **Conta**: cadastro com confirmação de e-mail, login, recuperação e troca de senha.
- 🍳 **Catálogo de receitas** com categorias, filtros (dificuldade, tempo, nota) e busca que ignora acento, maiúsculas e ordem das palavras ("salmao toscana" acha "Salmão à Toscana").
- 🥦 **Dietas conferidas pelos ingredientes**: o filtro "Vegana", por exemplo, não mostra receita com ovo ou laticínio, mesmo que esteja com esse rótulo.
- ⭐ **Avaliações** de 1 a 5 estrelas com comentário e ❤️ **favoritos**.
- 🧺 **"O que tem em casa?"**: digite os ingredientes e veja o que dá para cozinhar.
- 👩‍🍳 **Na receita**: quantidades de ½x a 3x, lista de compras e modo cozinha (passo a passo, timer e tela sempre acesa).
- 🔎 **Encontre um nutricionista**: só profissionais com CRN verificado.
- 📱 **App instalável (PWA)**: abre sem internet, recebe notificações e tem barra de navegação no celular.
- 🌙 **Modo claro/escuro** e 🌍 **português/inglês**.

### 🥗 Paciente
- **Meu dia**: calorias e metas do dia, sequência de registros, peso e próximos passos.
- **Diário alimentar por refeição** (café, almoço, lanche, jantar): receitas, alimentos da Tabela TACO ou valores digitados, com edição de cada registro.
- **Plano alimentar semanal**: o próprio ou o enviado pelo nutricionista. O botão "Comi" lança a refeição no diário sem duplicar; também dá para pedir troca de um item ao nutricionista.
- **Lista de compras** gerada das receitas ou do plano da semana.
- **Perfil de saúde** (idade, altura, peso, objetivo, alergias, dietas) com histórico e gráfico de peso.
- **Metas** calculadas pelo perfil (Mifflin-St Jeor) ou definidas pelo nutricionista.
- **Meu nutricionista**: conecta por convite; mensagens e consultas. Qualquer um dos dois pode encerrar, e o acesso aos dados acaba na hora.
- **Seus dados (LGPD)**: baixar uma cópia completa ou excluir a conta.

### 👨‍⚕️ Nutricionista
- **Verificação do CRN** (carteira + selfie, aprovada pelo admin) antes de convidar pacientes.
- **Painel**: pacientes que precisam de atenção (3 dias sem registrar, trocas pendentes, mensagens), consultas e desempenho das receitas.
- **Pacientes**: convite por link ou WhatsApp; ficha com resumo, plano, metas, consultas e mensagens.
- **Planos alimentares**: montar à mão, partir de um modelo, gerar automaticamente ou montar com IA (Premium), e ajustar à meta.
- **Conteúdo**: receitas próprias e alimentos próprios (visíveis só para os seus pacientes).
- **Perfil profissional público** com contatos e "Agendar pelo WhatsApp".
- **Plano grátis**: até 5 pacientes ativos. **Premium Nutricionista**: pacientes ilimitados, IA para montar planos, assistente com o seu nome para os pacientes (incluído para eles), relatórios e destaque na lista.

### 💎 Premium do paciente
Mentoria IA, estimativa de calorias por foto, cardápio pela IA, receitas exclusivas, relatório e desafios. O paciente de um nutricionista Premium usa a IA sem assinar.

### 🛡️ Administrador
Visão geral, aprovação de CRN, moderação de receitas e avaliações, usuários e planos de cortesia, comunicados, erros do app e um Laboratório com contas demo.

## 🧠 Como a Mentoria IA funciona

```
Mensagem ──► Edge Function ai-chat
              1. Gemini monta um PLANO em JSON: intenção, ingredientes, exclusões
                 (alergias e dietas do perfil), categoria, tempo e calorias.
              2. BUSCA no catálogo real (supabase/functions/_shared/recipe-search.ts):
                 casamento por radical ("morangos" = "morango"; "sal" ≠ "salmão"),
                 filtros soltos um a um se não houver resultado.
              3. Gemini escreve a resposta usando SÓ as receitas encontradas.
          ◄── { content, recipes (cartões), suggestions, meta }
```

- A chave do Gemini fica só no servidor. A função confere quem pode usar (assinatura própria ou paciente de nutricionista Premium) e o limite de mensagens.
- Alergias e dietas valem como restrição: a IA nunca sugere receita com o que a pessoa não pode comer.
- Sem a chave, ou se a IA falhar, o app usa a **mesma busca** com um plano montado localmente.

## 🚀 Tecnologias

- **Frontend**: React 18, TypeScript (strict), Vite 7, Tailwind CSS 3, Framer Motion, Zustand, React Router 7, Lucide.
- **Backend**: Supabase (PostgreSQL com RLS, Auth, Storage, Realtime, Edge Functions em Deno, pg_net).
- **IA**: Google Gemini (`gemini-3.5-flash` e `gemini-3.5-flash-lite`), chamado pela Edge Function `ai-chat`.
- **Pagamentos**: Stripe Checkout, Customer Portal e webhooks.
- **Notificações**: Web Push (VAPID) pelo service worker.
- **Hospedagem**: Cloudflare Workers (arquivos estáticos).

## 🛠️ Como rodar

### Pré-requisitos
- Node.js 22+
- Projeto no Supabase (e, para pagamentos, conta no Stripe)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase ...` funciona)

### 1. Instale

```bash
git clone https://github.com/PedroRosa666/NutriChefe.git
cd NutriChefe
npm install
```

### 2. Variáveis do front (`.env`)

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

Tudo com `VITE_` fica público no navegador: chaves secretas (Gemini, Stripe) **nunca** vão aqui.

No Supabase, em Authentication > URL Configuration, coloque o site em **Site URL** e adicione `https://seu-dominio/**` (e `http://localhost:5173/**`) em **Redirect URLs**.

### 3. Banco de dados

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:push      # roda as migrations (a senha do banco vem da variável SUPABASE_DB_PASSWORD)
npm run db:types     # regera src/types/database.ts a partir do banco
```

As migrations em `supabase/migrations` são o histórico completo do banco: tabelas, políticas de segurança (RLS), funções e gatilhos. Rode `npm run db:types` sempre que mudar o banco; consultas a tabelas ou colunas que não existem deixam de compilar.

### 4. Edge Functions e segredos

```bash
npx supabase functions deploy ai-chat --no-verify-jwt
npx supabase functions deploy admin --no-verify-jwt
npx supabase functions deploy create-checkout-session --no-verify-jwt
npx supabase functions deploy create-portal-session --no-verify-jwt
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy send-push --no-verify-jwt

npx supabase secrets set GEMINI_API_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... FRONTEND_URL=https://seu-dominio
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@exemplo.com
# Opcionais: limites da IA e modelos do Gemini
npx supabase secrets set AI_HOURLY_LIMIT=60 AI_DAILY_LIMIT=300 GEMINI_MODEL=gemini-3.5-flash GEMINI_LITE_MODEL=gemini-3.5-flash-lite
```

As funções conferem o login por conta própria (por isso `--no-verify-jwt`).

| Função | Para quê |
| --- | --- |
| `ai-chat` | Mentoria IA, plano pela IA e estimativa de calorias por foto. |
| `admin` | Ações do administrador que precisam do servidor (suspender contas, contas demo). |
| `create-checkout-session` | Abre o Checkout do Stripe só para planos ativos, sem cobrança em dobro. |
| `create-portal-session` | Abre o portal do cliente do Stripe. |
| `stripe-webhook` | Mantém `user_subscriptions` igual ao Stripe (ativa, renova, pagamento falho, cancela). |
| `send-push` | Envia as notificações para os aparelhos (chamada pelo banco a cada aviso novo). |

### 5. Stripe

- Webhook para `https://SEU_PROJETO.supabase.co/functions/v1/stripe-webhook` com os eventos `checkout.session.completed` e `customer.subscription.created`, `.updated` e `.deleted`. O segredo `whsec_...` vai em `STRIPE_WEBHOOK_SECRET`.
- Salve uma vez as configurações do **Customer Portal**.
- Preencha `stripe_price_id` dos planos em `subscription_plans`.

### 6. Rode

```bash
npm run dev
```

Disponível em `http://localhost:5173`.

## 🔧 Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # checagem de tipos + build de produção
npm run typecheck  # só a checagem de tipos
npm run lint       # ESLint
npm test           # testes (Vitest), inclusive das regras do banco num Postgres em memória
npm run preview    # serve o build localmente
npm run cf:dev     # build + teste local no Cloudflare (http://localhost:8787)
npm run db:status  # migrations que faltam rodar (não muda nada)
npm run db:push    # roda as migrations novas
npm run db:types   # regera os tipos do banco
```

Os testes não falam com o Supabase de verdade: as regras do banco (RLS, funções) rodam em PGlite com as migrations reais.

## 🗂️ Estrutura

```
src/
  components/      # UI por área (ai, admin, care, nutrition, plans, profile, recipes...)
  pages/           # páginas carregadas sob demanda pelo roteador
  store/           # estado global (Zustand)
  services/        # acesso ao Supabase, IA, assinatura e notificações
  hooks/           # hooks compartilhados (tradução, navegação...)
  lib/             # regras puras: busca, dietas, gerador de plano, cálculos, i18n...
  types/           # tipos do app e do banco (database.ts é gerado)
public/            # ícones, manifesto, service worker (sw.js) e cabeçalhos (_headers)
supabase/
  migrations/      # esquema do banco e políticas de segurança
  functions/       # Edge Functions (Deno)
    _shared/       # busca de receitas e regras de dieta, usadas pela IA e pelo app
  templates/       # modelos dos e-mails de conta
  tests/           # testes das regras do banco
scripts/db.mjs     # migrations pela Supabase CLI
```

## 🔐 Segurança

- RLS em todas as tabelas. Diário, metas, saúde, peso e conversas com a IA só são lidos pelo dono e pelo nutricionista que ele aceitou, e só enquanto o acompanhamento estiver ativo.
- `email` e `stripe_customer_id` não são legíveis pela chave pública. O usuário não altera o próprio tipo de conta, a assinatura nem os participantes de uma conversa.
- Ações de administrador são conferidas no banco (`app_admins`), não só na tela.
- Chaves do Gemini, do Stripe e do VAPID só existem como segredos das Edge Functions.
- Dados guardados para uso sem internet ficam separados por conta e são apagados ao sair.
- Cabeçalhos de segurança no site (`public/_headers`): `nosniff`, proteção contra iframe e política de conteúdo (em modo de observação).
- Texto de usuários e da IA é renderizado sem HTML; links de contato aceitam só `http(s)`.

## 🚀 Deploy

- **Site**: cada push na `main` é publicado sozinho pelo Cloudflare Workers Builds (build `npm run build`). `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam em Settings > Build > Variables and secrets, porque o Vite só as lê durante o build. Também dá para publicar pelo terminal com `npm run deploy` (usa o `.env` local).
- **Banco e funções**: pelo Supabase CLI (passos 3 e 4).
- **CI** (`.github/workflows/ci.yml`): a cada push confere tipos, lint, testes, build e os tipos das Edge Functions (Deno).

**Ao trocar de domínio**: atualize o segredo `FRONTEND_URL` (o checkout e o portal do Stripe só voltam para essa origem) e, no Supabase, o Site URL e as Redirect URLs.

## 👨‍💻 Autor

**Desenvolvido por Pedro Henrique de Oliveira Rosa**

- 📧 Email: pehenriqueoliveirarosa@gmail.com
- 💼 LinkedIn: [linkedin.com/in/pedro-henrique-oliveira-rosa-232383274](https://linkedin.com/in/pedro-henrique-oliveira-rosa-232383274)
- 🐱 GitHub: [github.com/PedroRosa666](https://github.com/PedroRosa666)

## 📄 Licença

MIT.

---

<div align="center">
  <p>Feito com ❤️ e muito ☕</p>
  <p>NutriChef © 2024–2026 - Alimentação saudável ao alcance de todos</p>
</div>
