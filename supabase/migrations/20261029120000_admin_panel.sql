/*
  # Painel do administrador

  - profiles.is_demo: contas de demonstração do Laboratório (fora das métricas e da lista pública).
  - recipes.hidden_at: receita escondida pela moderação (só o autor e os administradores veem).
  - admin_demo_accounts: as contas demo de cada administrador (criadas pela função admin).
  - Funções admin_* (só administradores): números do app, usuários, Premium de cortesia, CRN,
    planos e preços, erros, moderação, comunicados e simuladores do Laboratório.
  - Avisos: novo tipo 'announcement' (comunicado do NutriChef).
  - my_premium() passa a dizer também se o usuário é administrador e se é conta demo.
  Suspender conta e entrar nas contas demo ficam na Edge Function `admin` (precisam da API de Auth).
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

CREATE TABLE IF NOT EXISTS admin_demo_accounts (
  admin_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  nutritionist_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  extra_patients uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_demo_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_demo_accounts FROM anon, authenticated;

-- Receitas escondidas pela moderação --------------------------------------------------------
DROP POLICY IF EXISTS "Qualquer pessoa pode visualizar receitas" ON recipes;
DROP POLICY IF EXISTS "Visible recipes" ON recipes;
DROP POLICY IF EXISTS "Visible recipes for members" ON recipes;
CREATE POLICY "Visible recipes"
  ON recipes FOR SELECT TO anon
  USING (hidden_at IS NULL);
CREATE POLICY "Visible recipes for members"
  ON recipes FOR SELECT TO authenticated
  USING (hidden_at IS NULL OR author_id = auth.uid() OR public.is_admin());

-- Avisos: comunicado ---------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'swap_requested', 'swap_answered', 'patient_joined', 'link_ended', 'plan_updated', 'goals_updated', 'message',
  'appointment_scheduled', 'appointment_canceled', 'appointment_reminder',
  'verification_requested', 'verification_reviewed', 'announcement'
));

-- my_premium com admin e demo -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_premium()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ai', public.has_feature(auth.uid(), 'ai_mentoring'),
    'nutritionist_pro', public.has_feature(auth.uid(), 'nutritionist_pro'),
    'ai_via_nutritionist', (
      SELECT c.nutritionist_id FROM nutritionist_clients c
      WHERE c.client_id = auth.uid() AND c.status = 'active' AND public.has_feature(c.nutritionist_id, 'nutritionist_pro')
      ORDER BY c.created_at LIMIT 1
    ),
    'active_patients', (SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = auth.uid() AND status = 'active'),
    'free_patient_limit', 5,
    'admin', public.is_admin(),
    'demo', coalesce((SELECT is_demo FROM profiles WHERE id = auth.uid()), false)
  );
$$;

-- Guarda comum ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_admin() FROM public, anon, authenticated;

-- Visão geral -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.assert_admin();
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM profiles WHERE NOT is_demo),
    'clients', (SELECT count(*) FROM profiles WHERE NOT is_demo AND user_type = 'Client'),
    'nutritionists', (SELECT count(*) FROM profiles WHERE NOT is_demo AND user_type = 'Nutritionist'),
    'new_7d', (SELECT count(*) FROM profiles WHERE NOT is_demo AND created_at > now() - interval '7 days'),
    'new_30d', (SELECT count(*) FROM profiles WHERE NOT is_demo AND created_at > now() - interval '30 days'),
    'active_links', (SELECT count(*) FROM nutritionist_clients c JOIN profiles p ON p.id = c.client_id
                     WHERE c.status = 'active' AND NOT p.is_demo),
    'plans', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', x.name, 'paid', x.paid, 'courtesy', x.courtesy) ORDER BY x.name)
      FROM (
        SELECT sp.name,
               count(*) FILTER (WHERE s.stripe_subscription_id IS NOT NULL) AS paid,
               count(*) FILTER (WHERE s.stripe_subscription_id IS NULL) AS courtesy
        FROM user_subscriptions s
        JOIN subscription_plans sp ON sp.id = s.plan_id
        JOIN profiles p ON p.id = s.user_id
        WHERE s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > now()) AND NOT p.is_demo
        GROUP BY sp.name
      ) x
    ), '[]'::jsonb),
    'mrr', coalesce((
      SELECT sum(sp.price) FROM user_subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      JOIN profiles p ON p.id = s.user_id
      WHERE s.status = 'active' AND s.stripe_subscription_id IS NOT NULL AND NOT p.is_demo
    ), 0),
    'ai_today', coalesce((
      SELECT jsonb_object_agg(kind, n) FROM (
        SELECT kind, count(*) AS n FROM ai_usage WHERE created_at >= date_trunc('day', now()) GROUP BY kind
      ) a
    ), '{}'::jsonb),
    'errors_24h', (SELECT count(*) FROM client_errors WHERE created_at > now() - interval '24 hours'),
    'crn_pending', (SELECT count(*) FROM nutritionist_verifications WHERE status = 'pending')
  ) INTO v;
  RETURN v;
END;
$$;

-- Usuários --------------------------------------------------------------------------------------
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
  WHERE coalesce(trim(p_query), '') = ''
     OR p.full_name ILIKE '%' || trim(p_query) || '%'
     OR u.email ILIKE '%' || trim(p_query) || '%'
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 30), 1), 100);
END;
$$;

-- Premium de cortesia (sem Stripe): para parceiros e testadores.
CREATE OR REPLACE FUNCTION public.admin_grant_premium(p_user uuid, p_plan uuid, p_until timestamptz)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub user_subscriptions;
BEGIN
  PERFORM public.assert_admin();
  IF p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'invalid_date';
  END IF;
  SELECT * INTO v_sub FROM user_subscriptions WHERE user_id = p_user ORDER BY created_at DESC LIMIT 1;
  IF v_sub.id IS NOT NULL AND v_sub.stripe_subscription_id IS NOT NULL AND v_sub.status IN ('active', 'pending') THEN
    RAISE EXCEPTION 'has_paid_subscription';
  END IF;
  IF v_sub.id IS NOT NULL AND v_sub.stripe_subscription_id IS NULL THEN
    UPDATE user_subscriptions SET plan_id = p_plan, status = 'active', expires_at = p_until, auto_renew = false, updated_at = now()
    WHERE id = v_sub.id;
  ELSE
    INSERT INTO user_subscriptions (user_id, plan_id, status, expires_at, auto_renew)
    VALUES (p_user, p_plan, 'active', p_until, false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE user_subscriptions SET status = 'cancelled', updated_at = now()
  WHERE user_id = p_user AND stripe_subscription_id IS NULL AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_crn(p_user uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE profiles SET crn_status = p_status WHERE id = p_user AND user_type = 'Nutritionist';
END;
$$;

-- Planos e preços --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_plan(p_plan uuid, p_price numeric, p_stripe_price text, p_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  IF p_stripe_price IS NOT NULL AND p_stripe_price <> '' AND p_stripe_price !~ '^price_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'invalid_price_id';
  END IF;
  UPDATE subscription_plans
  SET price = coalesce(p_price, price),
      stripe_price_id = nullif(trim(coalesce(p_stripe_price, stripe_price_id)), ''),
      is_active = coalesce(p_active, is_active),
      updated_at = now()
  WHERE id = p_plan;
END;
$$;

-- Erros do app -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_errors(p_days integer DEFAULT 7)
RETURNS TABLE (message text, total bigint, users bigint, last_at timestamptz, url text, stack text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT e.message, count(*), count(DISTINCT e.user_id), max(e.created_at),
         (array_agg(e.url ORDER BY e.created_at DESC))[1],
         (array_agg(e.stack ORDER BY e.created_at DESC))[1]
  FROM client_errors e
  WHERE e.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
  GROUP BY e.message
  ORDER BY max(e.created_at) DESC
  LIMIT 50;
END;
$$;

-- Moderação --------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_recipes(p_query text DEFAULT '')
RETURNS TABLE (id uuid, title text, author_name text, rating numeric, reviews bigint, hidden_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT r.id, r.title, p.full_name, r.rating::numeric, (SELECT count(*) FROM reviews v WHERE v.recipe_id = r.id), r.hidden_at, r.created_at
  FROM recipes r LEFT JOIN profiles p ON p.id = r.author_id
  WHERE coalesce(trim(p_query), '') = '' OR r.title ILIKE '%' || trim(p_query) || '%' OR p.full_name ILIKE '%' || trim(p_query) || '%'
  ORDER BY r.hidden_at DESC NULLS LAST, r.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_recipe_hidden(p_recipe uuid, p_hidden boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE recipes SET hidden_at = CASE WHEN p_hidden THEN now() ELSE NULL END WHERE id = p_recipe;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reviews(p_recipe uuid)
RETURNS TABLE (id uuid, user_name text, rating integer, comment text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT v.id, p.full_name, v.rating::integer, v.comment, v.created_at
  FROM reviews v LEFT JOIN profiles p ON p.id = v.user_id
  WHERE v.recipe_id = p_recipe
  ORDER BY v.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_review(p_review uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  DELETE FROM reviews WHERE id = p_review;
END;
$$;

-- Comunicados ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_broadcast(p_audience text, p_title text, p_body text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ref uuid := gen_random_uuid();
  v_user uuid;
  v_count integer := 0;
BEGIN
  PERFORM public.assert_admin();
  IF coalesce(trim(p_title), '') = '' OR coalesce(trim(p_body), '') = '' THEN
    RAISE EXCEPTION 'empty';
  END IF;
  FOR v_user IN
    SELECT p.id FROM profiles p
    WHERE NOT p.is_demo
      AND (p_audience = 'all'
        OR (p_audience = 'clients' AND p.user_type = 'Client')
        OR (p_audience = 'nutritionists' AND p.user_type = 'Nutritionist'))
  LOOP
    PERFORM public.notify(v_user, 'announcement', v_ref,
      jsonb_build_object('title', left(trim(p_title), 80), 'body', left(trim(p_body), 300)));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Laboratório: simuladores -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_test_push()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  PERFORM public.notify(auth.uid(), 'announcement', gen_random_uuid(),
    jsonb_build_object('title', 'Teste de notificação', 'body', 'Se você está vendo isto no celular, as notificações funcionam.'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_run_reminders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN public.send_appointment_reminders();
END;
$$;

-- Dados de demonstração (chamado pela função admin, com a service role, logo depois de criar as contas).
CREATE OR REPLACE FUNCTION public.admin_seed_demo(p_admin uuid, p_patient uuid, p_nutri uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan uuid;
  v_recipes uuid[];
  v_titles text[];
  v_kcal numeric[];
  i integer;
  d integer;
BEGIN
  UPDATE profiles SET is_demo = true, full_name = 'Paciente Demo', user_type = 'Client' WHERE id = p_patient;
  UPDATE profiles SET is_demo = true, full_name = 'Nutricionista Demo', user_type = 'Nutritionist',
                      crn_status = 'approved', crn_region = 3, crn_number = '00000', profile_visibility = 'private'
  WHERE id = p_nutri;

  INSERT INTO admin_demo_accounts (admin_id, patient_id, nutritionist_id)
  VALUES (p_admin, p_patient, p_nutri)
  ON CONFLICT (admin_id) DO UPDATE SET patient_id = EXCLUDED.patient_id, nutritionist_id = EXCLUDED.nutritionist_id,
                                       extra_patients = '{}', created_at = now();

  INSERT INTO nutritionist_clients (nutritionist_id, client_id, status, consent_at)
  VALUES (p_nutri, p_patient, 'active', now())
  ON CONFLICT (nutritionist_id, client_id) DO UPDATE SET status = 'active', ended_at = NULL;

  INSERT INTO client_health_profiles (user_id, birth_date, sex, height_cm, weight_kg, target_weight_kg, activity_level, goal,
                                      dietary_preferences, allergies, notes, updated_at)
  VALUES (p_patient, '1992-05-10', 'female', 165, 72, 65, 'moderate', 'lose', ARRAY[]::text[], ARRAY['amendoim'],
          'Conta de demonstração.', now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO nutrition_goals (user_id, calories, protein, carbs, fat, fiber, set_by)
  VALUES (p_patient, 1800, 110, 200, 60, 25, p_nutri)
  ON CONFLICT (user_id) DO NOTHING;

  FOR d IN 0..9 LOOP
    INSERT INTO weight_logs (user_id, logged_on, weight_kg)
    VALUES (p_patient, current_date - d * 3, 72 - (9 - d) * 0.3);
  END LOOP;

  SELECT array_agg(id ORDER BY rn), array_agg(title ORDER BY rn), array_agg(kcal ORDER BY rn)
  INTO v_recipes, v_titles, v_kcal
  FROM (
    SELECT id, title, coalesce((nutrition_facts->>'calories')::numeric, 400) AS kcal, row_number() OVER (ORDER BY random()) AS rn
    FROM recipes WHERE hidden_at IS NULL LIMIT 8
  ) r;

  IF coalesce(array_length(v_recipes, 1), 0) >= 4 THEN
    -- Diário dos últimos 6 dias (2 ou 3 refeições por dia).
    FOR d IN 1..6 LOOP
      FOR i IN 1..(2 + d % 2) LOOP
        INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_id, recipe_title, servings, per_serving)
        VALUES (p_patient, current_date - d, v_recipes[1 + (d + i) % array_length(v_recipes, 1)],
                v_titles[1 + (d + i) % array_length(v_recipes, 1)], 1,
                jsonb_build_object('calories', v_kcal[1 + (d + i) % array_length(v_recipes, 1)], 'protein', 25, 'carbs', 50, 'fat', 15, 'fiber', 6));
      END LOOP;
    END LOOP;

    INSERT INTO meal_plans (client_id, created_by, title, notes)
    VALUES (p_patient, p_nutri, 'Plano de demonstração', 'Criado pelo Laboratório.')
    RETURNING id INTO v_plan;

    FOR d IN 0..6 LOOP
      INSERT INTO meal_plan_items (plan_id, day, meal, recipe_id, servings, note) VALUES
        (v_plan, d, 'breakfast', v_recipes[1 + d % 2], 1, ''),
        (v_plan, d, 'lunch', v_recipes[3 + d % 2], 1, ''),
        (v_plan, d, 'snack', v_recipes[1 + (d + 1) % 2], 0.5, ''),
        (v_plan, d, 'dinner', v_recipes[3 + (d + 1) % 2], 1, '');
    END LOOP;
  END IF;

  INSERT INTO care_messages (nutritionist_id, client_id, sender_id, body, created_at) VALUES
    (p_nutri, p_patient, p_nutri, 'Olá! Montei seu plano da semana. Qualquer dúvida, me chame por aqui.', now() - interval '2 days'),
    (p_nutri, p_patient, p_patient, 'Obrigada! Posso trocar o jantar de quarta?', now() - interval '1 day');

  INSERT INTO appointments (nutritionist_id, client_id, starts_at, duration_min, mode, location, notes)
  VALUES (p_nutri, p_patient, date_trunc('hour', now()) + interval '3 days 2 hours', 45, 'online', 'https://meet.example.com/demo',
          'Consulta de retorno (demonstração).');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_seed_demo(uuid, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_seed_demo(uuid, uuid, uuid) TO service_role;

-- Permissões das funções do painel ------------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'admin_stats()', 'admin_users(text, integer)', 'admin_grant_premium(uuid, uuid, timestamptz)',
    'admin_revoke_premium(uuid)', 'admin_set_crn(uuid, text)', 'admin_set_plan(uuid, numeric, text, boolean)',
    'admin_errors(integer)', 'admin_recipes(text)', 'admin_set_recipe_hidden(uuid, boolean)', 'admin_reviews(uuid)',
    'admin_delete_review(uuid)', 'admin_broadcast(text, text, text)', 'admin_test_push()', 'admin_run_reminders()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END;
$$;
