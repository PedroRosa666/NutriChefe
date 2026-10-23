/*
  # Segurança: perfis, IA, notas das receitas, erros, notificações e tabelas antigas

  1. profiles: antes qualquer pessoa (até sem login) listava todos os usuários (nome, tipo, último
     acesso). Agora uma linha só aparece para:
       - a própria pessoa;
       - nutricionistas com perfil público (página de nutricionistas);
       - autores de receitas e de avaliações (o nome aparece junto da receita/avaliação);
       - quem tem acompanhamento ativo com ela (nutricionista <-> paciente).
     `last_seen` deixa de ser legível (o app não usa).
  2. ai_usage + consume_ai_quota(): o limite de uso da IA passa a ser contado no servidor
     (a função ai-chat grava cada uso). Antes o limite contava mensagens gravadas pelo próprio app.
  3. recipes: ninguém mais muda a nota (`rating`) direto; ela é recalculada pelas avaliações
     (o gatilho agora roda com permissão própria, então avaliações de qualquer pessoa contam).
  4. client_errors: no máximo 30 erros por minuto por pessoa/visitante.
  5. push_subscriptions: só aceita endereços https dos serviços de notificação conhecidos.
  6. Tabelas antigas, sem uso no app (mentoria antiga, chat antigo, metas antigas): sem acesso
     pelo app. Os dados continuam no banco.
  7. Excluir a conta: bloqueado também com assinatura com pagamento pendente.
*/

-- 1) profiles -------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Qualquer pessoa pode visualizar perfis públicos" ON profiles;
DROP POLICY IF EXISTS "Public profile rows" ON profiles;
DROP POLICY IF EXISTS "Linked profile rows" ON profiles;

CREATE POLICY "Public profile rows"
  ON profiles FOR SELECT TO anon, authenticated
  USING (
    id = auth.uid()
    OR (user_type = 'Nutritionist' AND coalesce(profile_visibility, 'public') = 'public')
    OR EXISTS (SELECT 1 FROM recipes r WHERE r.author_id = profiles.id)
    OR EXISTS (SELECT 1 FROM reviews v WHERE v.user_id = profiles.id)
  );

-- Separada para só valer com login (as funções abaixo não são liberadas para visitantes).
CREATE POLICY "Linked profile rows"
  ON profiles FOR SELECT TO authenticated
  USING (public.is_my_patient(id) OR public.is_my_nutritionist(id));

REVOKE SELECT (last_seen) ON public.profiles FROM anon, authenticated;

-- 2) Limite de uso da IA ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chat', 'photo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id, kind, created_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_usage FROM anon, authenticated;

-- Conta e registra um uso, de forma atômica. Devolve false quando passou do limite da hora ou do dia.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user uuid, p_kind text, p_per_hour integer, p_per_day integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hour integer;
  v_day integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ai_usage:' || p_user::text));
  SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour'), count(*)
  INTO v_hour, v_day
  FROM ai_usage
  WHERE user_id = p_user AND kind = p_kind AND created_at > now() - interval '1 day';
  IF v_hour >= p_per_hour OR v_day >= p_per_day THEN
    RETURN false;
  END IF;
  INSERT INTO ai_usage (user_id, kind) VALUES (p_user, p_kind);
  DELETE FROM ai_usage WHERE user_id = p_user AND created_at < now() - interval '2 days';
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, integer, integer) TO service_role;

-- 3) recipes: a nota vem só das avaliações ----------------------------------------------------

REVOKE INSERT, UPDATE ON recipes FROM anon, authenticated;
GRANT INSERT (title, description, image, prep_time, difficulty, category, ingredients, instructions,
              nutrition_facts, author_id) ON recipes TO authenticated;
GRANT UPDATE (title, description, image, prep_time, difficulty, category, ingredients, instructions,
              nutrition_facts, updated_at) ON recipes TO authenticated;

CREATE OR REPLACE FUNCTION public.update_recipe_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE recipes
  SET rating = (
    SELECT coalesce(round(avg(rating::numeric), 1), 0)
    FROM reviews
    WHERE recipe_id = coalesce(NEW.recipe_id, OLD.recipe_id)
  )
  WHERE id = coalesce(NEW.recipe_id, OLD.recipe_id);
  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.update_recipe_rating() FROM public, anon, authenticated;

-- Corrige as notas que ficaram erradas.
UPDATE recipes r
SET rating = coalesce((SELECT round(avg(v.rating::numeric), 1) FROM reviews v WHERE v.recipe_id = r.id), 0);

-- 4) client_errors: limite por minuto ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.limit_client_errors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM client_errors
      WHERE created_at > now() - interval '1 minute'
        AND user_id IS NOT DISTINCT FROM NEW.user_id
        AND user_agent = NEW.user_agent) >= 30 THEN
    RAISE EXCEPTION 'too_many_errors';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_client_errors ON client_errors;
CREATE TRIGGER trg_limit_client_errors
  BEFORE INSERT ON client_errors
  FOR EACH ROW EXECUTE FUNCTION public.limit_client_errors();

-- 5) push_subscriptions: só serviços de notificação conhecidos --------------------------------

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/' THEN
    RAISE EXCEPTION 'invalid_endpoint';
  END IF;
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  ON CONFLICT (endpoint)
  DO UPDATE SET user_id = auth.uid(), p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
                user_agent = EXCLUDED.user_agent, created_at = now();
END;
$$;

-- 6) Tabelas antigas sem uso no app ------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_goals', 'conversations', 'goal_progress', 'mentoring_relationships',
                           'mentoring_sessions', 'messages', 'nutrition_log', 'nutritionist_services']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END;
$$;

-- 7) Excluir a conta com assinatura pendente ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Assinatura que ainda cobra (ativa com renovação, ou com pagamento pendente): cancelar antes.
  IF EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = auth.uid()
      AND stripe_subscription_id IS NOT NULL
      AND ((status = 'active' AND auto_renew IS DISTINCT FROM false) OR status = 'pending')
  ) THEN
    RAISE EXCEPTION 'active_subscription';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
