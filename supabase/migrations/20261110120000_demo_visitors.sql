/*
  Demonstração pública (/demo): quem recebe o link testa o app sem cadastro.

  - Cada visita cria um par novo (paciente demo + nutricionista demo, já vinculados e com dados),
    pela Edge Function `demo`. O par fica em demo_visitors e é apagado depois de 24 horas.
  - Visitante anônimo pode tentar abusar, então as travas ficam no banco (valem mesmo chamando a API
    direto): não cria receitas, avaliações nem convites, não envia arquivos, e conta demo nunca se
    vincula a conta real. Perfis demo só aparecem para o próprio par e para o administrador.
  - IA: 5 usos por par (contados aqui, em ai_usage com kind 'demo').
  - A semente dos dados (seed_demo_data) passa a ser a mesma do Laboratório do administrador.
*/

-- 1) Pares de visitantes ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  nutritionist_id uuid NOT NULL,
  -- Hash do IP (nunca o IP): limite de pares por hora para o mesmo visitante.
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX IF NOT EXISTS idx_demo_visitors_patient ON demo_visitors(patient_id);
CREATE INDEX IF NOT EXISTS idx_demo_visitors_nutritionist ON demo_visitors(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_demo_visitors_ip ON demo_visitors(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_visitors_expires ON demo_visitors(expires_at);
-- Sem políticas: só a Edge Function (service role) lê e grava.
ALTER TABLE demo_visitors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demo_visitors FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_demo_visitor(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user IS NOT NULL
     AND EXISTS (SELECT 1 FROM demo_visitors WHERE patient_id = p_user OR nutritionist_id = p_user);
$$;
REVOKE ALL ON FUNCTION public.is_demo_visitor(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_demo_visitor(uuid) TO authenticated;

-- 2) O que o visitante não faz ---------------------------------------------------------------------
-- Receitas, avaliações e convites aparecem para pessoas reais; save_recipe e os convites passam por
-- funções SECURITY DEFINER, por isso a trava é gatilho (vale para qualquer caminho de gravação).
CREATE OR REPLACE FUNCTION public.demo_visitor_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- TG_ARGV[0]: a coluna com o dono da linha.
  IF public.is_demo_visitor((to_jsonb(NEW) ->> TG_ARGV[0])::uuid) THEN
    RAISE EXCEPTION 'demo_readonly';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.demo_visitor_guard() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_demo_visitor_guard ON recipes;
CREATE TRIGGER trg_demo_visitor_guard BEFORE INSERT ON recipes
  FOR EACH ROW EXECUTE FUNCTION public.demo_visitor_guard('author_id');
DROP TRIGGER IF EXISTS trg_demo_visitor_guard ON reviews;
CREATE TRIGGER trg_demo_visitor_guard BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.demo_visitor_guard('user_id');
DROP TRIGGER IF EXISTS trg_demo_visitor_guard ON nutritionist_invites;
CREATE TRIGGER trg_demo_visitor_guard BEFORE INSERT ON nutritionist_invites
  FOR EACH ROW EXECUTE FUNCTION public.demo_visitor_guard('nutritionist_id');

-- Conta demo só se vincula a conta demo (planos, mensagens, consultas e trocas dependem do vínculo).
CREATE OR REPLACE FUNCTION public.demo_link_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (SELECT is_demo FROM profiles WHERE id = NEW.client_id)
     IS DISTINCT FROM (SELECT is_demo FROM profiles WHERE id = NEW.nutritionist_id) THEN
    RAISE EXCEPTION 'demo_readonly';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.demo_link_guard() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_demo_link_guard ON nutritionist_clients;
CREATE TRIGGER trg_demo_link_guard BEFORE INSERT OR UPDATE OF client_id, nutritionist_id ON nutritionist_clients
  FOR EACH ROW EXECUTE FUNCTION public.demo_link_guard();

-- Arquivos (foto de perfil, documentos do CRN): o bucket de avatares é público.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN; -- banco de teste (sem Storage)
  END IF;
  DROP POLICY IF EXISTS "Demo visitors do not upload" ON storage.objects;
  CREATE POLICY "Demo visitors do not upload" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (NOT public.is_demo_visitor());
  DROP POLICY IF EXISTS "Demo visitors do not replace files" ON storage.objects;
  CREATE POLICY "Demo visitors do not replace files" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
    USING (NOT public.is_demo_visitor());
END;
$$;

-- Perfis demo (visitantes e Laboratório) não aparecem para quem não é do par, mesmo que a conta
-- demo mude a visibilidade do perfil para pública.
-- Sem login, nenhum perfil demo (anon não executa as funções de vínculo).
DROP POLICY IF EXISTS "Demo profiles stay private" ON profiles;
CREATE POLICY "Demo profiles stay private" ON profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT is_demo OR id = auth.uid() OR public.is_my_patient(id) OR public.is_my_nutritionist(id) OR public.is_admin());
DROP POLICY IF EXISTS "Demo profiles hidden from anon" ON profiles;
CREATE POLICY "Demo profiles hidden from anon" ON profiles AS RESTRICTIVE FOR SELECT TO anon
  USING (NOT is_demo);

-- 3) IA: 5 usos por par ------------------------------------------------------------------------------
ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_kind_check;
ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_kind_check CHECK (kind IN ('chat', 'photo', 'plan', 'patient_chat', 'demo'));

-- NULL: não é visitante (vale o limite normal). false: o par já usou tudo.
CREATE OR REPLACE FUNCTION public.consume_demo_ai(p_user uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v demo_visitors%ROWTYPE;
  v_used integer;
BEGIN
  SELECT * INTO v FROM demo_visitors WHERE patient_id = p_user OR nutritionist_id = p_user LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('demo_ai:' || v.id::text));
  SELECT count(*) INTO v_used FROM ai_usage
  WHERE user_id IN (v.patient_id, v.nutritionist_id) AND kind = 'demo';
  IF v_used >= p_limit THEN
    RETURN false;
  END IF;
  INSERT INTO ai_usage (user_id, kind) VALUES (p_user, 'demo');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_demo_ai(uuid, integer) FROM public, anon, authenticated;

-- 4) Recursos do usuário logado: diz ao app se é visitante -----------------------------------------
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
    'demo', coalesce((SELECT is_demo FROM profiles WHERE id = auth.uid()), false),
    'visitor', public.is_demo_visitor(auth.uid())
  );
$$;

-- 5) Dados da demonstração (Laboratório e visitantes) ----------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_demo_data(p_patient uuid, p_nutri uuid)
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
    FROM recipes WHERE hidden_at IS NULL AND NOT premium_only LIMIT 8
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
    VALUES (p_patient, p_nutri, 'Plano de demonstração', 'Plano da semana para a paciente demo.')
    RETURNING id INTO v_plan;

    -- Um comando só: o gatilho publica uma versão (antes, um comando por dia criava sete).
    INSERT INTO meal_plan_items (plan_id, day, meal, recipe_id, servings, note)
    SELECT v_plan, d.day, m.meal, v_recipes[m.base + (d.day + m.shift) % 2], m.servings, ''
    FROM generate_series(0, 6) AS d(day)
    CROSS JOIN (VALUES ('breakfast', 1, 0, 1.0), ('lunch', 3, 0, 1.0), ('snack', 1, 1, 0.5), ('dinner', 3, 1, 1.0))
      AS m(meal, base, shift, servings);
  END IF;

  INSERT INTO care_messages (nutritionist_id, client_id, sender_id, body, created_at) VALUES
    (p_nutri, p_patient, p_nutri, 'Olá! Montei seu plano da semana. Qualquer dúvida, me chame por aqui.', now() - interval '2 days'),
    (p_nutri, p_patient, p_patient, 'Obrigada! Posso trocar o jantar de quarta?', now() - interval '1 day');

  INSERT INTO appointments (nutritionist_id, client_id, starts_at, duration_min, mode, location, notes)
  VALUES (p_nutri, p_patient, date_trunc('hour', now()) + interval '3 days 2 hours', 45, 'online', 'https://meet.example.com/demo',
          'Consulta de retorno (demonstração).');
END;
$$;
REVOKE ALL ON FUNCTION public.seed_demo_data(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_seed_demo(p_admin uuid, p_patient uuid, p_nutri uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_demo_accounts (admin_id, patient_id, nutritionist_id)
  VALUES (p_admin, p_patient, p_nutri)
  ON CONFLICT (admin_id) DO UPDATE SET patient_id = EXCLUDED.patient_id, nutritionist_id = EXCLUDED.nutritionist_id,
                                       extra_patients = '{}', created_at = now();
  PERFORM public.seed_demo_data(p_patient, p_nutri);
END;
$$;
