/*
  # Premium do cliente: receitas exclusivas, conquistas e desafios

  - recipes.premium_only: receita exclusiva, marcada pelo admin na moderação. Só aparece inteira para
    quem tem Premium (próprio ou incluído pelo nutricionista Premium), para o autor e para o admin.
    Os outros veem só a vitrine (premium_recipe_teasers): título, foto, categoria e calorias.
  - my_progress(): números do próprio usuário para as conquistas (todos) e os desafios da semana
    (Premium). Datas no fuso de São Paulo, semana de segunda a domingo.
*/

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS premium_only boolean NOT NULL DEFAULT false;

-- Quem vê o conteúdo exclusivo: Premium próprio, paciente de nutricionista Premium ou admin.
CREATE OR REPLACE FUNCTION public.premium_content()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_feature(auth.uid(), 'ai_mentoring')
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM nutritionist_clients c
      WHERE c.client_id = auth.uid() AND c.status = 'active' AND public.has_feature(c.nutritionist_id, 'nutritionist_pro')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.premium_content() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.premium_content() TO authenticated;

DROP POLICY IF EXISTS "Visible recipes" ON recipes;
DROP POLICY IF EXISTS "Visible recipes for members" ON recipes;
CREATE POLICY "Visible recipes"
  ON recipes FOR SELECT TO anon
  USING (hidden_at IS NULL AND NOT premium_only);
CREATE POLICY "Visible recipes for members"
  ON recipes FOR SELECT TO authenticated
  USING (
    (hidden_at IS NULL AND (NOT premium_only OR (SELECT public.premium_content())))
    OR author_id = auth.uid()
    OR public.is_admin()
  );

-- Vitrine das exclusivas para quem ainda não é Premium.
CREATE OR REPLACE FUNCTION public.premium_recipe_teasers()
RETURNS TABLE (id uuid, title text, image text, category text, prep_time integer, calories numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.title, r.image, r.category, r.prep_time,
         nullif(r.nutrition_facts ->> 'calories', '')::numeric
  FROM recipes r
  WHERE r.premium_only AND r.hidden_at IS NULL
  ORDER BY r.created_at DESC
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.premium_recipe_teasers() FROM public;
GRANT EXECUTE ON FUNCTION public.premium_recipe_teasers() TO anon, authenticated;

-- Moderação: lista com a marca de exclusiva e o interruptor.
DROP FUNCTION IF EXISTS public.admin_recipes(text);
CREATE FUNCTION public.admin_recipes(p_query text DEFAULT '')
RETURNS TABLE (id uuid, title text, author_name text, rating numeric, reviews bigint, hidden_at timestamptz, premium_only boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT r.id, r.title, p.full_name, r.rating::numeric, (SELECT count(*) FROM reviews v WHERE v.recipe_id = r.id),
         r.hidden_at, r.premium_only, r.created_at
  FROM recipes r LEFT JOIN profiles p ON p.id = r.author_id
  WHERE coalesce(trim(p_query), '') = '' OR r.title ILIKE '%' || trim(p_query) || '%' OR p.full_name ILIKE '%' || trim(p_query) || '%'
  ORDER BY r.hidden_at DESC NULLS LAST, r.premium_only DESC, r.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_recipe_premium(p_recipe uuid, p_premium boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE recipes SET premium_only = p_premium WHERE id = p_recipe;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recipes(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_recipes(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_recipe_premium(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_recipe_premium(uuid, boolean) TO authenticated;

-- Conquistas e desafios ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_progress()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_week date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_goal_kcal numeric;
  v_goal_prot numeric;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT g.calories, g.protein INTO v_goal_kcal, v_goal_prot FROM nutrition_goals g WHERE g.user_id = v_user;

  WITH days AS (
    SELECT DISTINCT e.entry_date AS d FROM nutrition_log_entries e WHERE e.user_id = v_user AND e.entry_date <= v_today
  ),
  islands AS (
    SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days
  ),
  runs AS (
    SELECT min(d) AS first_day, max(d) AS last_day, count(*) AS len FROM islands GROUP BY grp
  ),
  week_totals AS (
    SELECT e.entry_date AS d,
           sum(coalesce(nullif(e.per_serving ->> 'calories', '')::numeric, 0) * e.servings) AS kcal,
           sum(coalesce(nullif(e.per_serving ->> 'protein', '')::numeric, 0) * e.servings) AS prot
    FROM nutrition_log_entries e
    WHERE e.user_id = v_user AND e.entry_date BETWEEN v_week AND v_today
    GROUP BY e.entry_date
  ),
  weights AS (
    SELECT w.weight_kg, w.logged_on FROM weight_logs w WHERE w.user_id = v_user
  )
  SELECT jsonb_build_object(
    'diary_days', (SELECT count(*) FROM days),
    'streak', coalesce((SELECT len FROM runs WHERE last_day >= v_today - 1 ORDER BY last_day DESC LIMIT 1), 0),
    'best_streak', coalesce((SELECT max(len) FROM runs), 0),
    'weight_logs', (SELECT count(*) FROM weights),
    'weight_change', (
      SELECT (SELECT weight_kg FROM weights ORDER BY logged_on DESC LIMIT 1) - (SELECT weight_kg FROM weights ORDER BY logged_on LIMIT 1)
    ),
    'ate_meals', (SELECT count(*) FROM meal_plan_checks c WHERE c.client_id = v_user AND c.status = 'ate'),
    'reviews', (SELECT count(*) FROM reviews v WHERE v.user_id = v_user),
    'favorites', (SELECT count(*) FROM favorites f WHERE f.user_id = v_user),
    'week', jsonb_build_object(
      'start', v_week,
      'diary_days', (SELECT count(*) FROM week_totals),
      'ate_meals', (SELECT count(*) FROM meal_plan_checks c WHERE c.client_id = v_user AND c.status = 'ate' AND c.check_date BETWEEN v_week AND v_today),
      'weigh_ins', (SELECT count(*) FROM weights WHERE logged_on BETWEEN v_week AND v_today),
      'protein_days', CASE WHEN coalesce(v_goal_prot, 0) > 0 THEN (SELECT count(*) FROM week_totals WHERE prot >= v_goal_prot) END,
      'calorie_days', CASE WHEN coalesce(v_goal_kcal, 0) > 0 THEN (SELECT count(*) FROM week_totals WHERE kcal BETWEEN v_goal_kcal * 0.9 AND v_goal_kcal * 1.1) END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.my_progress() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_progress() TO authenticated;

-- Texto do plano do cliente com os recursos novos.
UPDATE subscription_plans
SET description = 'Mentoria IA, calorias por foto, cardápio da semana pela IA, receitas exclusivas, relatório de evolução e desafios semanais.'
WHERE name = 'Premium';
