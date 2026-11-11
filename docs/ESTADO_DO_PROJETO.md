# NutriChef: estado do projeto e próximos passos

> **Este arquivo precisa ser mantido em dia.** Ele é o contexto do projeto para qualquer chat novo
> (o `CLAUDE.md` da raiz o carrega sozinho). **Ao terminar qualquer tarefa que mude o sistema**
> (função nova, correção, migration, deploy, decisão do Pedro), atualize as seções
> "O que já existe", "Últimas entregas" e "Próximos passos" **no mesmo trabalho**, antes de dar a
> tarefa por encerrada. Item feito sai de "Próximos passos" e entra em "Últimas entregas".
> Mantenha curto: detalhe técnico fica no código, nos commits e no README.

Última atualização: 11/11/2026 (commit `8681b5b` no ar; lote de segurança e SEO de 11/11 pronto no
computador, **ainda sem commit, migration nem deploy**: ver "Aguardando o Pedro" na seção 5).

---

## 1. O que é

App web (PWA instalável) de receitas saudáveis e acompanhamento nutricional, em português e inglês.
Dois públicos: **paciente** (diário, plano, metas) e **nutricionista** (pacientes, planos, mensagens).
O nutricionista é o usuário principal. Tem Premium para os dois e um painel de administrador.

- Site: https://nutrichef.app.br (o antigo `app.nutrichefe.workers.dev` e o `www` redirecionam).
- Demo sem cadastro para recrutadores: https://nutrichef.app.br/demo (par paciente+nutricionista
  descartável, 24 h, IA limitada a 5 mensagens).
- Repositório **privado**: github.com/PedroRosa666/NutriChefe (branch `main`).

## 2. Como funciona por dentro

| Parte | Onde |
|---|---|
| Front | React + TypeScript + Vite + Tailwind + Zustand (`src/`) |
| Hospedagem | Cloudflare Workers (Worker "app"). **Push na `main` publica sozinho** (Workers Builds) |
| Worker | `worker/index.ts`: só em `/`, `/receita/*`, `/sitemap.xml`, `/robots.txt` (SEO e 301); o resto são arquivos estáticos |
| Banco/Auth/Storage | Supabase, projeto `ptmfcodrlfufrzkxrtxg` (RLS em todas as tabelas) |
| Edge Functions | `ai-chat`, `admin`, `demo`, `send-push`, `create-checkout-session`, `create-portal-session`, `stripe-webhook`, `delete-account` |
| IA | Gemini, via `ai-chat` (cota por usuário no servidor) |
| Pagamento | Stripe (web). Google Play Billing só no lançamento na Play Store |
| Testes | `npx vitest run` (lógica + banco em PGlite), `npx playwright test` (tela, headless; o servidor local usa os cabeçalhos de `public/_headers`, então o CSP vale nos testes), skill local `testar-nutrichef` |

## 3. O que já existe

**Para todos:** conta com confirmação de e-mail; catálogo paginado com filtros e busca sem acento;
dietas conferidas pelos ingredientes; avaliações e favoritos; "O que tem em casa?"; receita com
porções ½x–3x, lista de compras e modo cozinha; lista de nutricionistas com CRN verificado; PWA
offline com notificações; claro/escuro; pt/en.

**Paciente:** Meu dia (metas, sequência, peso); diário por refeição (receitas, Tabela TACO, valores
digitados); plano semanal (próprio ou do nutricionista, botão "Comi", pedido de troca); lista de
compras; perfil de saúde com histórico; metas por Mifflin-St Jeor × atividade ou definidas pelo
nutricionista; vínculo por convite com mensagens e consultas; LGPD (baixar dados, excluir conta,
que agora também apaga os arquivos).

**Nutricionista:** verificação do CRN (carteira + selfie, aprovação do admin); Painel com pacientes
que precisam de atenção; lista de pacientes ordenada por necessidade; ficha com gráfico de 7 dias
clicável; planos (à mão, modelo, gerador automático, IA Premium) com versões publicadas e histórico;
blocos de refeição próprios; receitas com rendimento e nutrição calculada pelos ingredientes;
alimentos próprios; perfil profissional público. Grátis: até 5 pacientes ativos.

**Gerador de plano (sem IA):** mira todas as metas (kcal, proteína, carboidrato, gordura, fibra);
completa com até 4 acompanhamentos TACO por dia com regras de "cara de prato" (`src/lib/plan-sides.ts`)
e mostra o motivo de cada um; opções "escolha 1" no almoço/jantar; evita receitas que o paciente
pediu para trocar e penaliza as que ele pulou; usa o campo "Serve para" das receitas
(`recipes.meal_types`) quando marcado.

**Premium do paciente:** Mentoria IA (NutriBot), calorias por foto, cardápio pela IA, receitas
exclusivas, relatório PDF, desafios. Paciente de nutricionista Premium usa a IA sem assinar.
**Premium Nutricionista** (R$ 49,90): pacientes ilimitados, IA para planos, assistente com o nome
dele, check-ins, agenda, modelos com variantes, destaque na lista.

**Administrador** (`/admin`, tabela `app_admins`): visão geral, CRN, usuários (cortesia, suspender),
planos/preços Stripe, erros do app, moderação, comunicados, Laboratório com contas demo.

**Segurança e SEO (out–nov/2026):** perfil privado de nutricionista não é mais lido por visitantes
(autor de receita aparece só com nome/foto via `author_card`); log de erros sem tokens; páginas de
receita com título, canonical, JSON-LD `Recipe`, 404 real, sitemap e robots.

**Lote de 11/11 (no computador, não publicado):** senha nova com mínimo de 8 em todas as telas
(`src/lib/password.ts`); CSP completo ativo; imagem de prévia 1200×630 (`public/og-image.png`);
CRN que perde a aprovação encerra vínculos e convites; limite da demo contado no banco
(`claim_demo_start`); `send-push` aceita segredo (`PUSH_WEBHOOK_SECRET` + Vault); erros internos do
Gemini e do painel não vão mais ao navegador; CLI do Supabase em `3.1.0` e Actions por SHA.

## 4. Últimas entregas

| Data | Commit | O quê |
|---|---|---|
| 11/11 | (local, sem commit) | Lote de segurança e SEO: itens 3, 5, 6, 7, 8 e quase todo o 9 da lista antiga |
| 03/11 | (Supabase) | Função `delete-account` publicada: excluir conta apaga também os arquivos |
| 30/10 | `8681b5b` | Perfil privado protegido, Worker de SEO, links com nome nas receitas, log sem token |
| 30/10 | `198fcef` | Gerador mira todas as metas, acompanhamentos com motivo, "escolha 1", campo "Serve para" |
| 30/10 | `084d636` | Gerador fecha carboidrato com TACO; suíte e2e; simplificações |
| 30/10 | `3fc1937`, `409bb95` | Gráfico de 7 dias clicável; avisos de meta no plano; telas largas; tela de visitante no perfil |
| 30/10 | `f4432c6`..`88e8bd4` | Rodadas de acessibilidade e contraste (Impeccable: critique 23→26/40) |
| 29/10 | `f057c20` e antes | Etapas 1–5 do plano de implementação (BASE, HIST, REF, REC A, REC B); demo pública; domínio próprio |

## 5. Próximos passos

**Aguardando o Pedro (lote de 11/11, nesta ordem)**
1. `npm run db:push`: migration `20261116120000_security_leftovers.sql` (só acrescenta: gatilho do CRN,
   tabela `demo_starts`, `claim_demo_start`, `dispatch_push` com segredo).
2. Publicar as Edge Functions `demo`, `send-push`, `admin` e `ai-chat` (a `demo` nova depende da migration).
3. Commit e push (publica o site) e conferir o check "Workers Builds: app".
4. Segredo do push: gravar `push_webhook_secret` no Vault e **depois** `PUSH_WEBHOOK_SECRET` na função
   (na ordem inversa os avisos param de chegar).
5. Depois do deploy da `demo`: olhar o log. Se aparecer "demo: client ip from x-forwarded-for", a borda
   não está mandando `cf-connecting-ip` e o limite por visitante continua contornável (o limite do
   dia, agora atômico, segura o abuso).
6. Aplicar o "Serve para" nas 24 receitas (sugestão entregue em 11/11, esperando revisão). A receita
   "Cookie" está com 5 kcal por porção: conferir.

**Curto prazo**
7. Google Search Console: cadastrar `https://nutrichef.app.br/sitemap.xml` (conta Google do Pedro).
8. Conferir no painel do Supabase: confirmação de e-mail ligada, URLs de redirecionamento,
   "secure password change", limites de tipo/tamanho dos buckets e **senha mínima 8** (o app já exige
   8 para senha nova; o servidor ainda aceita 6). Com a confirmação de e-mail ligada o cadastro não
   revela se o e-mail já tem conta (era a "enumeração no login").

**Segurança (o que sobrou)**
9. `ai_messages`: o paciente ainda consegue gravar mensagem com papel "assistant". Correção é em etapas:
   a `ai-chat` passa a gravar as duas mensagens, o app para de gravar (subir `CLIENT_CONTRACT`), e só
   depois uma migration tira o INSERT do usuário. O modo limitado (sem Gemini) grava pelo app: tratar junto.
10. Repetir a auditoria de segurança no perfil `standard`.

**Produto**
11. Plano de implementação: próximas etapas ANA → EVO → CHECK → DIA e AGEN A → AGEN B, MOD e MET.
12. Planejar mais recursos Premium para o nutricionista (a página Premium ainda fala com o paciente).
13. Pendências do Impeccable: alergias e motivo do alerta no topo da ficha, selo de kcal abaixo da
    meta, filtros/ordenação para 30+ pacientes, LazyMotion, região aria-live fixa, alvos de 44 px.
14. Gerador: proteína ainda abaixo da meta quando o catálogo é muito vegano/vegetariano.

**Quando o Pedro disser que vai lançar na Play Store** (não começar antes): TWA com Bubblewrap,
Google Play Billing (opção B), `assetlinks.json`, página pública de exclusão de conta, botão
"denunciar resposta da IA", imagens da loja, Segurança dos dados.

## 6. Regras de trabalho (valem sempre)

- Responder em **português do Brasil**.
- **Commit e push só com autorização do Pedro**; push na `main` publica o site. Depois do push,
  conferir o check "Workers Builds: app" (`gh api repos/PedroRosa666/NutriChefe/commits/<sha>/check-runs`).
- Migrations: `npm run db:status` (simulação) e `npm run db:push`. **Nunca publicar código que
  dependa de migration não aplicada.** Mudança que remove acesso: primeiro o app novo no ar, depois
  a migration. Avisar em uma linha o que a migration muda.
- Publicar Edge Function é deploy em produção: pedir autorização.
- Nunca imprimir senhas, tokens ou a `SUPABASE_DB_PASSWORD` (mostrar só o tamanho).
- Dados de usuários vindos do banco ou da API não são repetidos na conversa.
- Navegador de teste sempre **headless** (nunca abrir janela na tela do Pedro).
- Corrigir a causa geral, não só o exemplo citado.
- Manter o fundo creme e o kicker "NutriChef"; Início = receitas.
- `PRODUCT.md`, `.impeccable/` e a skill `testar-nutrichef` ficam fora do Git.
- Serviço novo no navegador (script, fonte, API de outro domínio): incluir no CSP de `public/_headers`.
- Regra de senha: só em `src/lib/password.ts` (as frases em `src/lib/i18n` citam o número).
- Tirar a aprovação de um CRN encerra os vínculos e não tem volta automática (decisão de 11/11: encerrar,
  em vez de bloquear, porque vale para todas as regras de uma vez).
- Ao mudar formato de dados: subir `CLIENT_CONTRACT` (`src/lib/client-contract.ts`, hoje 5) junto com `app_min_client()`.
