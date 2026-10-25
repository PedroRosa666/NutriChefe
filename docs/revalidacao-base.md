# Revalidação da base (Etapa 1)

Data: 25/10/2026. Esta é a revalidação das áreas da seção 3 do plano de implementação.

- **Commit testado:** é o que inclui a migração `20261104120000_base_hardening.sql`.
- **Ambientes usados:**
  - banco de teste local (PGlite com as migrações reais);
  - leitura das políticas de produção;
  - simulação em produção com as contas demo, dentro de uma transação desfeita no final.

**Como ler a coluna "Situação":**
- **verificado:** o comportamento foi reproduzido em teste ou em produção.
- **pendente:** depende de um teste que ainda não foi feito, e o motivo está anotado.

| Área | O que foi conferido | Evidência | Situação |
|---|---|---|---|
| Autorização | Um nutricionista sem vínculo não lê nem grava dados do paciente. As políticas de diário, saúde, peso, metas, planos, marcações, trocas, consultas e IA exigem vínculo ativo (`is_my_patient`, `is_my_nutritionist`, `ai_link_active`). | Políticas de produção lidas em 25/10. Testes `security`, `care-rules` e `ai-security`. | verificado (banco) |
| Encerramento do vínculo | Ao terminar o vínculo, o acesso a dados novos acaba, inclusive na IA. O cache do app é separado por conta e apagado ao sair. | Testes `ai-security` e `care-rules`. Migração `hide_plans_after_link_ends`. Cache por conta em `public/sw.js` v3. | verificado (banco). Pendente o teste com Realtime e duas contas reais, porque o Chrome bloqueia cliques. |
| Push | Só são aceitos endereços de notificação permitidos, tanto na gravação quanto no envio. Falha de entrega pode ser tentada de novo. | Teste `ai-security`. Lista de endereços permitidos em `send-push`. | verificado |
| Diário | O "Comi" e o lançamento no diário são gravados numa operação só. Repetir não duplica. Falha no meio desfaz tudo. Desmarcar apaga só o que veio da marcação. | Teste `checks-search`. | verificado |
| Assinaturas | O estado da assinatura só muda pelo servidor; a API não grava mais em `user_subscriptions` nem em `subscription_plans`. O webhook é idempotente. | Teste `base-hardening`. Função `stripe-webhook`. | verificado (banco). Pendente o teste de pagamento no Stripe em modo de teste, que Pedro vai fazer. |
| Privacidade | A exportação é paginada e completa. Toda tabela nova precisa ser exportada ou ter motivo registrado para ficar de fora. | Testes `export-sources` (inventário) e `privacy.ts` (`NOT_EXPORTED`). | verificado |
| Catálogo e gerador | A busca é feita no servidor, com paginação e sem acento. As ferramentas usam o índice leve do catálogo inteiro, não só a grade carregada na tela. | Teste `recipe-catalog`. Verificação em produção em 23/10. | verificado |
| Compilação e CI | Tipos, lint, testes, build e verificação das Edge Functions passam no mesmo commit. | `.github/workflows/ci.yml` | verificado |

## Achados novos desta revalidação (corrigidos)

| Achado | Severidade | Correção |
|---|---|---|
| 8 tabelas da primeira versão continuavam no `public`. Uma delas (`messages`) estava sem RLS. | Médio (as tabelas não tinham permissão de acesso) | Movidas para o schema `legacy`, que a API não enxerga. Os dados foram guardados. |
| TRUNCATE, TRIGGER e REFERENCES estavam liberados para a API. Visitantes tinham permissão de escrita nas tabelas, contida só pela RLS. | Médio (defesa em profundidade) | Permissões retiradas, inclusive para tabelas criadas no futuro. |
| Funções de gatilho e funções antigas podiam ser chamadas pela API. | Baixo | Execução retirada. As funções antigas foram para o `legacy`. |
| O paciente conseguia gravar outra pessoa como "definida por" nas metas. | Médio (integridade) | Um gatilho recusa a gravação. |

## Base para as próximas etapas

- **`app_operations`, `op_begin` e `op_finish`:** a mesma gravação repetida devolve o resultado original. O mesmo identificador com conteúdo diferente resulta em `operation_conflict`.
- **`src/lib/app-errors.ts`:** códigos de erro estáveis (`version_conflict`, `operation_conflict`, `not_allowed`, `temporarily_unavailable`...). Cada código tem texto em português e em inglês.
