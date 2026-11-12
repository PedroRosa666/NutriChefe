/*
  # Mensagens da Mentoria IA: só o servidor grava

  Antes, o titular da conversa podia inserir em `ai_messages` com qualquer papel, inclusive "ai":
  dava para forjar uma resposta da IA no histórico que o nutricionista lê.

  Agora a função `ai-chat` grava a pergunta e a resposta (com a chave de serviço) e o app só lê.
  Regras que continuam valendo, agora dentro da função: a conversa é do próprio usuário e está ativa.

  ORDEM (remove acesso): só aplicar depois que a `ai-chat` nova estiver publicada e o app com
  CLIENT_CONTRACT 6 estiver no ar. O app antigo (contrato 5) gravava direto na tabela; por isso a
  versão mínima sobe junto e ele pede para recarregar.
*/

DROP POLICY IF EXISTS "AI messages: owner writes in own active conversation" ON ai_messages;
REVOKE INSERT ON ai_messages FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_min_client()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 6 $$;
REVOKE ALL ON FUNCTION public.app_min_client() FROM public;
GRANT EXECUTE ON FUNCTION public.app_min_client() TO anon, authenticated;
