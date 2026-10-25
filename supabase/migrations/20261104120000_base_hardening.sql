/*
  Etapa 1 do plano de implementação (BASE): fechar o que sobrou de permissões amplas e preparar
  as gravações das próximas etapas.

  1. Tabelas da primeira versão (mentoria e chat antigos, metas antigas) saem do schema public
     para o schema "legacy", que a API não enxerga. Nenhum código usa; algumas têm poucas linhas
     antigas, então são guardadas em vez de apagadas. "messages" estava sem RLS.
  2. Permissões que a API nunca precisa: TRUNCATE, TRIGGER e REFERENCES saem de anon e
     authenticated em todas as tabelas; visitante (anon) não grava em tabela nenhuma, exceto o
     registro de erros da tela. Vale também para tabelas criadas depois (default privileges).
  3. Funções de gatilho deixam de ser executáveis pela API (gatilhos disparam do mesmo jeito).
  4. Metas: o paciente não pode gravar outra pessoa como "definida por" (set_by).
  5. Operações repetíveis: app_operations guarda o resultado de cada operation_id, para que repetir
     a mesma gravação (clique duplo, internet caindo) devolva o resultado original, e reutilizar o
     id com outro conteúdo dê "operation_conflict". Usado pelas RPCs das próximas etapas.
*/

-- 1. Tabelas antigas ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS legacy;
REVOKE ALL ON SCHEMA legacy FROM public, anon, authenticated;

DO $$
DECLARE
  t text;
  f text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'conversations', 'mentoring_sessions', 'mentoring_relationships',
                           'goal_progress', 'client_goals', 'nutrition_log', 'nutritionist_services'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy', t);
      EXECUTE format('REVOKE ALL ON legacy.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;

  -- Funções que só serviam a essas tabelas vão junto (e passam a achá-las no schema novo).
  FOR f IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_unread_messages_count', 'get_nutritionist_stats',
                        'update_conversation_last_message', 'update_goal_current_value')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA legacy', f);
  END LOOP;
  FOR f IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'legacy'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = legacy, public', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon, authenticated', f);
  END LOOP;
END $$;

-- 2. Permissões de tabela -------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon, authenticated', t);
    IF t <> 'client_errors' THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- Assinaturas e planos só mudam pelo servidor (webhook do Stripe e painel do admin).
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions, public.subscription_plans FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- 3. Funções de gatilho ---------------------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', f);
  END LOOP;
END $$;

-- 4. Quem definiu as metas ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_goals_set_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- O próprio paciente grava: set_by fica como estava ou vira vazio (metas dele).
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id AND NEW.set_by IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.set_by IS DISTINCT FROM OLD.set_by) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_goals_set_by() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS guard_goals_set_by ON nutrition_goals;
CREATE TRIGGER guard_goals_set_by BEFORE INSERT OR UPDATE ON nutrition_goals
  FOR EACH ROW EXECUTE FUNCTION public.guard_goals_set_by();

-- 5. Operações repetíveis -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_operations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(kind) <= 60),
  request_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_operations_created ON app_operations(created_at);
ALTER TABLE app_operations ENABLE ROW LEVEL SECURITY;
-- Sem políticas: só as funções abaixo (SECURITY DEFINER) leem e gravam.
REVOKE ALL ON app_operations FROM anon, authenticated;

/*
  Início de uma operação repetível, chamado de dentro de outra função na mesma transação:
  - id novo: reserva e devolve NULL (a função segue e grava; no fim chama op_finish);
  - id já concluído com o mesmo conteúdo: devolve o resultado guardado (a função só o repassa);
  - id de outra pessoa, de outro tipo ou com outro conteúdo: operation_conflict.
  Se a transação falhar, a reserva some junto (nada pela metade).
*/
CREATE OR REPLACE FUNCTION public.op_begin(p_id uuid, p_kind text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := md5(coalesce(p_payload, 'null'::jsonb)::text);
  v_row app_operations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_id IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO app_operations (id, user_id, kind, request_hash)
  VALUES (p_id, auth.uid(), p_kind, v_hash)
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_row FROM app_operations WHERE id = p_id FOR UPDATE;
  IF v_row.user_id <> auth.uid() OR v_row.kind <> p_kind OR v_row.request_hash <> v_hash OR v_row.result IS NULL THEN
    RAISE EXCEPTION 'operation_conflict';
  END IF;
  RETURN v_row.result;
END;
$$;

CREATE OR REPLACE FUNCTION public.op_finish(p_id uuid, p_result jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE app_operations SET result = coalesce(p_result, 'null'::jsonb)
    WHERE id = p_id AND user_id = auth.uid();
  END IF;
  -- Limpeza: resultados guardados por 7 dias bastam para qualquer nova tentativa.
  DELETE FROM app_operations WHERE created_at < now() - interval '7 days';
  RETURN p_result;
END;
$$;

-- Chamadas de dentro das RPCs (que rodam como o usuário). Chamar direto só mexe nas operações
-- da própria pessoa.
REVOKE ALL ON FUNCTION public.op_begin(uuid, text, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.op_finish(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.op_begin(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.op_finish(uuid, jsonb) TO authenticated;
