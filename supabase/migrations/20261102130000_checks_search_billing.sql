/*
  Consistência do "Comi", busca do painel admin e assinaturas (auditoria de 23/10/2026: F11, F19, F18).

  1. Marcação de refeição + diário numa operação só (save_meal_check). Cada lançamento feito
     pelo "Comi" fica ligado à marcação (plan_check_id): marcar de novo substitui os mesmos
     lançamentos (nunca duplica), mudar para "pulei"/"comi outra coisa" ou desmarcar tira o
     que ela tinha lançado, e uma falha no meio desfaz tudo (não fica "comi" sem diário).
  2. Busca do admin (usuários e receitas) igual à do app: sem diferença de acento, maiúsculas
     ou ordem das palavras.
  3. Uma linha por assinatura do Stripe (índice único em stripe_subscription_id), como a
     sincronização do webhook espera.
*/

-- 1) "Comi" -------------------------------------------------------------------------------
ALTER TABLE nutrition_log_entries
  ADD COLUMN IF NOT EXISTS plan_check_id uuid REFERENCES meal_plan_checks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_nutrition_log_entries_check
  ON nutrition_log_entries(plan_check_id) WHERE plan_check_id IS NOT NULL;

-- SECURITY INVOKER: valem as mesmas regras (RLS) de marcações e diário; a função só junta
-- tudo numa transação.
CREATE OR REPLACE FUNCTION public.save_meal_check(
  p_plan uuid,
  p_date date,
  p_meal text,
  p_status text,
  p_chosen jsonb DEFAULT '[]'::jsonb,
  p_note text DEFAULT '',
  p_entries jsonb DEFAULT '[]'::jsonb
)
RETURNS meal_plan_checks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v meal_plan_checks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_entries, '[]'::jsonb)) > 30 THEN
    RAISE EXCEPTION 'invalid_entries';
  END IF;

  INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, status, chosen, note)
  VALUES (auth.uid(), p_plan, p_date, p_meal, p_status, coalesce(p_chosen, '[]'::jsonb), left(coalesce(p_note, ''), 300))
  ON CONFLICT (client_id, plan_id, check_date, meal)
  DO UPDATE SET status = EXCLUDED.status, chosen = EXCLUDED.chosen, note = EXCLUDED.note
  RETURNING * INTO v;

  -- O que esta marcação tinha lançado sai; "Comi" lança de novo a lista atual.
  DELETE FROM nutrition_log_entries WHERE plan_check_id = v.id;

  IF p_status = 'ate' THEN
    INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_id, recipe_title, servings, per_serving, meal, plan_check_id)
    SELECT auth.uid(), p_date, nullif(e->>'recipe_id', '')::uuid, left(coalesce(e->>'title', ''), 200),
           greatest(least(coalesce((e->>'servings')::numeric, 1), 20), 0.1), coalesce(e->'per_serving', '{}'::jsonb),
           p_meal, v.id
    FROM jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) AS e;
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.save_meal_check(uuid, date, text, text, jsonb, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_meal_check(uuid, date, text, text, jsonb, text, jsonb) TO authenticated;

-- 2) Busca sem acento -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_key(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(
    lower(translate(coalesce(p_text, ''),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
      'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY')),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- Todas as palavras da busca aparecem no texto? Busca vazia aceita tudo.
CREATE OR REPLACE FUNCTION public.search_match(p_haystack text, p_query text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT coalesce(bool_and(position(w IN public.search_key(p_haystack)) > 0), true)
  FROM regexp_split_to_table(public.search_key(p_query), ' ') AS w
  WHERE w <> '';
$$;

CREATE OR REPLACE FUNCTION public.admin_users(p_query text DEFAULT '', p_limit integer DEFAULT 30)
RETURNS TABLE (
  id uuid, full_name text, email text, user_type text, crn_status text, is_demo boolean,
  plan_name text, sub_status text, expires_at timestamptz, courtesy boolean,
  created_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT p.id, p.full_name, u.email::text, p.user_type, p.crn_status, p.is_demo,
         sp.name, s.status, s.expires_at, (s.id IS NOT NULL AND s.stripe_subscription_id IS NULL),
         p.created_at, u.last_sign_in_at, u.banned_until
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN LATERAL (
    SELECT * FROM user_subscriptions x WHERE x.user_id = p.id ORDER BY x.created_at DESC LIMIT 1
  ) s ON true
  LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE public.search_match(coalesce(p.full_name, '') || ' ' || coalesce(u.email::text, ''), p_query)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_recipes(p_query text DEFAULT '')
RETURNS TABLE (id uuid, title text, author_name text, rating numeric, reviews bigint, hidden_at timestamptz, premium_only boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT r.id, r.title, p.full_name, r.rating::numeric, (SELECT count(*) FROM reviews v WHERE v.recipe_id = r.id),
         r.hidden_at, r.premium_only, r.created_at
  FROM recipes r LEFT JOIN profiles p ON p.id = r.author_id
  WHERE public.search_match(coalesce(r.title, '') || ' ' || coalesce(p.full_name, ''), p_query)
  ORDER BY r.hidden_at DESC NULLS LAST, r.premium_only DESC, r.created_at DESC
  LIMIT 50;
END;
$$;

-- 3) Uma linha por assinatura do Stripe --------------------------------------------------------
-- Se já houver duplicadas (versão antiga do webhook), o índice fica para depois da limpeza
-- manual em vez de travar a migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_subscriptions WHERE stripe_subscription_id IS NOT NULL
    GROUP BY stripe_subscription_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_key
      ON user_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'user_subscriptions has duplicated stripe_subscription_id; unique index not created';
  END IF;
END $$;
