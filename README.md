# 🍽️ NutriChef

Plataforma para descobrir, criar e compartilhar receitas saudáveis, que conecta nutricionistas e clientes. Tem diário alimentar, perfil de saúde, assinatura Premium e uma Mentoria IA que encontra receitas do catálogo a partir do que a pessoa escreve, do jeito que ela escrever.

![NutriChef](https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop&crop=center)

## ✨ Funcionalidades

### Para todos
- 🔐 **Conta completa**: cadastro com confirmação de e-mail, login, recuperação de senha e troca de senha no perfil.
- 🍳 **Catálogo de receitas** com filtros por categoria, dificuldade, tempo, avaliação e busca por texto (também pela URL: `/?q=morango`).
- ⭐ **Avaliações** de 1 a 5 estrelas com comentário (uma por pessoa por receita, editável).
- ❤️ **Favoritos** sincronizados com a conta.
- 📊 **Informação nutricional** por porção: calorias, proteínas, carboidratos, gorduras e fibras.
- 🌙 **Modo escuro/claro** e 🌍 **português/inglês**.

### 🥗 Cliente
- **Visão geral**: calorias do dia, sequência de dias registrando, peso/IMC, favoritos e progresso das metas.
- **Diário alimentar**: registre receitas com o número de porções; totais do dia e gráfico dos últimos 7 dias.
- **Metas nutricionais** salvas na conta, com cálculo automático pelo perfil de saúde (Mifflin-St Jeor + nível de atividade + objetivo).
- **Perfil de saúde**: idade, sexo, altura, peso, peso-alvo, atividade, objetivo, preferências alimentares e alergias, com histórico e gráfico de peso.
- **Assinatura Premium** (Stripe) com portal para trocar cartão, ver faturas e cancelar.

### 👨‍⚕️ Nutricionista
- Criar, editar e excluir receitas próprias.
- **Painel**: receitas publicadas, avaliações recebidas, nota média, receita mais bem avaliada e avaliações recentes.
- **Perfil profissional público**: especialidades, formação, experiência, abordagem, valores, convênios, endereço e contatos, com checklist de completude e botão "Agendar pelo WhatsApp".
- Acesso à Mentoria IA sem assinatura.

### 🤖 Mentoria IA
- Entende pedidos em linguagem natural: "quero receitas com morangos", "tenho uns morangos sobrando, o que faço?", "algo doce sem lactose", "jantar leve até 400 kcal", "e mais rápidas?".
- **Busca receitas reais do catálogo** pelo ingrediente pedido (plural, sinônimo, erro de digitação ou inglês) e mostra cartões com foto, tempo, calorias e "contém: morango".
- Respeita **alergias e preferências** do perfil de saúde e pedidos como "sem leite": nunca sugere receitas com esses ingredientes.
- Se o catálogo não tem o ingrediente, diz isso e oferece receitas com ingredientes parecidos e uma sugestão de preparo marcada como **"fora do catálogo"**.
- Responde dúvidas sobre uma receita específica ("como faço a primeira?", "quantas calorias tem?") e perguntas gerais de nutrição.
- Histórico de conversas, sugestões de próxima pergunta e personalização pelo nutricionista (nome, personalidade e instruções).

## 🧠 Como a Mentoria IA funciona

```
Mensagem ──► Edge Function ai-chat
              1. Gemini monta um PLANO em JSON: intenção, ingredientes obrigatórios
                 (com variações), exclusões (alergias expandidas), categoria,
                 tempo, calorias, tipo de prato e receitas que combinam com a ocasião.
              2. BUSCA no catálogo real (supabase/functions/_shared/recipe-search.ts):
                 casamento por radical ("morangos" = "morango"; "sal" ≠ "salmão"),
                 filtros soltos um a um se não houver resultado, substitutos se o
                 ingrediente não existir no catálogo.
              3. Gemini escreve a resposta usando SÓ as receitas encontradas.
          ◄── { content, recipes (cartões), suggestions, meta }
```

- A chave do Gemini fica só no servidor; a função confere acesso (nutricionista ou Premium com `ai_mentoring`) e o limite de mensagens por hora.
- Sem a chave, ou se a IA cair, o app usa a **mesma busca** com um plano montado localmente pelo vocabulário do catálogo: a pessoa continua recebendo receitas, só sem o texto gerado.

## 🚀 Tecnologias

- **Frontend**: React 18, TypeScript (strict), Vite, Tailwind CSS, Framer Motion, Zustand, React Router, Lucide.
- **Backend**: Supabase (PostgreSQL com RLS e permissões por coluna, Auth, Storage, Edge Functions em Deno).
- **IA**: Google Gemini (`gemini-3.5-flash` para as respostas e `gemini-3.5-flash-lite` para o plano de busca), chamado pela Edge Function `ai-chat`. Se a cota de um modelo acabar ou ele for aposentado, a função troca sozinha.
- **Pagamentos**: Stripe Checkout, Customer Portal e webhooks.

## 🛠️ Como rodar

### Pré-requisitos
- Node.js 18+
- Projeto no Supabase (e, para pagamentos, conta no Stripe)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase ...` funciona)

### 1. Instale

```bash
git clone https://github.com/PedroRosa666/NutriChefe.git
cd NutriChefe
npm install
```

### 2. Variáveis do front (`.env`)

```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

A chave do Gemini **não** vai no `.env`: tudo com `VITE_` fica público no navegador. Ela é segredo da Edge Function (passo 4).

No Supabase (Authentication > URL Configuration), inclua nas **Redirect URLs** os endereços `/confirm-email` e `/reset-password` do site (ex.: `http://localhost:5173/confirm-email`).

### 3. Banco de dados

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Migrations recentes importantes:

| Migration | O que faz |
| --- | --- |
| `20261021120000_lock_user_subscriptions` | Impede o próprio usuário de se dar Premium alterando a assinatura. |
| `20261021130000_client_health_and_tracking` | Cria `nutrition_goals`, `nutrition_log_entries`, `client_health_profiles` e `weight_logs`, só visíveis para o dono. |
| `20261021140000_protect_profile_private_columns` | Esconde `email` e `stripe_customer_id` de `profiles` e limita o que o usuário pode editar (não pode mudar o próprio tipo de conta). |

### 4. Edge Functions e segredos

```bash
npx supabase functions deploy ai-chat
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-portal-session
npx supabase functions deploy stripe-webhook --no-verify-jwt

npx supabase secrets set GEMINI_API_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... FRONTEND_URL=https://seu-dominio
# Opcionais: mensagens da IA por usuário por hora (padrão 60) e modelos do Gemini
npx supabase secrets set AI_HOURLY_LIMIT=60 GEMINI_MODEL=gemini-3.5-flash GEMINI_LITE_MODEL=gemini-3.5-flash-lite
```

| Função | Para quê |
| --- | --- |
| `ai-chat` | Mentoria IA (plano + busca + resposta). |
| `create-checkout-session` | Abre o Checkout do Stripe; bloqueia cobrança em dobro e aceita só URLs do próprio site. |
| `create-portal-session` | Abre o portal do cliente do Stripe. |
| `stripe-webhook` | Atualiza `user_subscriptions` (ativa, renova, marca pagamento falho e cancela). |

### 5. Stripe

- Webhook apontando para `https://SEU_PROJETO.supabase.co/functions/v1/stripe-webhook` com os eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`. O segredo `whsec_...` desse destino vai em `STRIPE_WEBHOOK_SECRET`.
- Salve uma vez as configurações do **Customer Portal** (Configurações > Faturamento > Portal do cliente).
- Preencha `stripe_price_id` do plano Premium na tabela `subscription_plans`.

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
npm run preview    # serve o build localmente
```

## 🗂️ Estrutura

```
src/
  components/      # UI por área (ai, profile, nutrition, recipes, auth...)
  pages/           # páginas carregadas sob demanda pelo roteador
  store/           # estado global (Zustand): auth, receitas, assinatura, diário, metas, saúde, IA
  services/        # acesso ao Supabase, IA e assinatura
  lib/             # utilidades (calculadora nutricional, links de contato, i18n...)
supabase/
  migrations/      # esquema do banco e políticas de segurança
  functions/       # Edge Functions (Deno)
    _shared/       # busca de receitas usada pela IA e pelo app
```

## 🔐 Segurança

- RLS em todas as tabelas; diário, metas, saúde e peso só são lidos pelo dono.
- `email` e `stripe_customer_id` não são legíveis pela chave pública; o usuário não pode alterar o próprio tipo de conta nem a assinatura.
- Chaves do Gemini e do Stripe só existem como segredos das Edge Functions.
- Texto vindo de usuários e da IA é renderizado sem HTML; links de contato aceitam só `http(s)`.

## 🚀 Deploy

O front é publicado no Netlify a partir deste repositório (`npm run build`, pasta `dist`). Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel do Netlify. Banco e Edge Functions são publicados pelo Supabase CLI (passos 3 e 4).

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
