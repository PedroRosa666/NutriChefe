/*
  # Pacientes, plano alimentar, lista de compras e estatísticas de receitas

  1. nutritionist_invites  -> códigos de convite (uso único, 7 dias) que o
                              nutricionista gera e envia ao cliente.
  2. nutritionist_clients  -> vínculo nutricionista <-> paciente. Criado só pela
                              função redeem_nutritionist_invite (o cliente aceita).
                              Qualquer um dos dois pode encerrar.
  3. Com vínculo ativo, o nutricionista LÊ diário, metas, perfil de saúde e peso
     do paciente e pode DEFINIR as metas dele. Sem vínculo, nada muda: cada
     usuário só vê os próprios dados.
  4. meal_plans / meal_plan_items -> plano semanal (do próprio cliente ou feito
     pelo nutricionista para um paciente).
  5. shopping_lists        -> lista de compras do usuário.
  6. recipe_author_stats() -> favoritos, registros no diário e uso em planos
                              das receitas do nutricionista (só números).
*/

-- 1) Vínculo -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutritionist_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (nutritionist_id, client_id),
  CHECK (nutritionist_id <> client_id)
);

CREATE INDEX IF NOT EXISTS idx_nutritionist_clients_client ON nutritionist_clients(client_id);

ALTER TABLE nutritionist_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own links" ON nutritionist_clients;
CREATE POLICY "Members read own links"
  ON nutritionist_clients FOR SELECT TO authenticated
  USING (auth.uid() IN (nutritionist_id, client_id));

-- Encerrar é a única alteração permitida pelo app; reativar só com novo convite.
DROP POLICY IF EXISTS "Members end own links" ON nutritionist_clients;
CREATE POLICY "Members end own links"
  ON nutritionist_clients FOR UPDATE TO authenticated
  USING (auth.uid() IN (nutritionist_id, client_id))
  WITH CHECK (auth.uid() IN (nutritionist_id, client_id) AND status = 'ended');

REVOKE INSERT, UPDATE, DELETE ON nutritionist_clients FROM anon, authenticated;
GRANT UPDATE (status, ended_at) ON nutritionist_clients TO authenticated;

-- true quando quem chama é nutricionista com vínculo ativo com p_client.
-- SECURITY DEFINER: usada dentro de policies de outras tabelas sem recursão de RLS.
CREATE OR REPLACE FUNCTION public.is_my_patient(p_client uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM nutritionist_clients
    WHERE nutritionist_id = auth.uid()
      AND client_id = p_client
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_my_patient(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_my_patient(uuid) TO authenticated;

-- 2) Convites ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutritionist_invites (
  code text PRIMARY KEY,
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nutritionist_invites_owner ON nutritionist_invites(nutritionist_id);

ALTER TABLE nutritionist_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nutritionists read own invites" ON nutritionist_invites;
CREATE POLICY "Nutritionists read own invites"
  ON nutritionist_invites FOR SELECT TO authenticated
  USING (nutritionist_id = auth.uid());

DROP POLICY IF EXISTS "Nutritionists delete own invites" ON nutritionist_invites;
CREATE POLICY "Nutritionists delete own invites"
  ON nutritionist_invites FOR DELETE TO authenticated
  USING (nutritionist_id = auth.uid());

-- Criação e uso só pelas funções abaixo.
REVOKE INSERT, UPDATE ON nutritionist_invites FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_nutritionist_invite()
RETURNS nutritionist_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row nutritionist_invites;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Nutritionist') THEN
    RAISE EXCEPTION 'only_nutritionists';
  END IF;
  -- Limite simples contra abuso: 20 convites em aberto por nutricionista.
  IF (SELECT count(*) FROM nutritionist_invites
      WHERE nutritionist_id = auth.uid() AND used_at IS NULL AND expires_at > now()) >= 20 THEN
    RAISE EXCEPTION 'too_many_invites';
  END IF;

  LOOP
    -- 8 caracteres hexadecimais (sem O nem I, fácil de ditar).
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM nutritionist_invites WHERE code = v_code);
  END LOOP;

  INSERT INTO nutritionist_invites (code, nutritionist_id)
  VALUES (v_code, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_nutritionist_invite() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_nutritionist_invite() TO authenticated;

-- O cliente aceita o convite: cria (ou reativa) o vínculo e queima o código.
CREATE OR REPLACE FUNCTION public.redeem_nutritionist_invite(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite nutritionist_invites;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Client') THEN
    RAISE EXCEPTION 'only_clients';
  END IF;

  SELECT * INTO v_invite
  FROM nutritionist_invites
  WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF v_invite.code IS NULL OR v_invite.used_at IS NOT NULL OR v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invalid_invite';
  END IF;

  INSERT INTO nutritionist_clients (nutritionist_id, client_id, status)
  VALUES (v_invite.nutritionist_id, auth.uid(), 'active')
  ON CONFLICT (nutritionist_id, client_id)
  DO UPDATE SET status = 'active', ended_at = NULL, created_at = now();

  UPDATE nutritionist_invites
  SET used_by = auth.uid(), used_at = now()
  WHERE code = v_invite.code;

  RETURN v_invite.nutritionist_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_nutritionist_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_nutritionist_invite(text) TO authenticated;

-- 3) Nutricionista lê os dados do paciente (e define metas) -----------------
DROP POLICY IF EXISTS "Nutritionists read patient diary" ON nutrition_log_entries;
CREATE POLICY "Nutritionists read patient diary"
  ON nutrition_log_entries FOR SELECT TO authenticated
  USING (public.is_my_patient(user_id));

DROP POLICY IF EXISTS "Nutritionists read patient health" ON client_health_profiles;
CREATE POLICY "Nutritionists read patient health"
  ON client_health_profiles FOR SELECT TO authenticated
  USING (public.is_my_patient(user_id));

DROP POLICY IF EXISTS "Nutritionists read patient weight" ON weight_logs;
CREATE POLICY "Nutritionists read patient weight"
  ON weight_logs FOR SELECT TO authenticated
  USING (public.is_my_patient(user_id));

ALTER TABLE nutrition_goals ADD COLUMN IF NOT EXISTS set_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Nutritionists read patient goals" ON nutrition_goals;
CREATE POLICY "Nutritionists read patient goals"
  ON nutrition_goals FOR SELECT TO authenticated
  USING (public.is_my_patient(user_id));

DROP POLICY IF EXISTS "Nutritionists insert patient goals" ON nutrition_goals;
CREATE POLICY "Nutritionists insert patient goals"
  ON nutrition_goals FOR INSERT TO authenticated
  WITH CHECK (public.is_my_patient(user_id) AND set_by = auth.uid());

DROP POLICY IF EXISTS "Nutritionists update patient goals" ON nutrition_goals;
CREATE POLICY "Nutritionists update patient goals"
  ON nutrition_goals FOR UPDATE TO authenticated
  USING (public.is_my_patient(user_id))
  WITH CHECK (public.is_my_patient(user_id) AND set_by = auth.uid());

-- 4) Plano alimentar ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Plano alimentar' CHECK (char_length(title) BETWEEN 1 AND 120),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_client ON meal_plans(client_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day smallint NOT NULL CHECK (day BETWEEN 0 AND 6), -- 0 = segunda-feira
  meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'snack', 'dinner')),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  servings numeric(4,1) NOT NULL DEFAULT 1 CHECK (servings > 0 AND servings <= 20),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan ON meal_plan_items(plan_id);

-- Ver: o próprio cliente, ou o autor do plano enquanto o vínculo estiver ativo.
CREATE OR REPLACE FUNCTION public.can_view_meal_plan(p_plan uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meal_plans p
    WHERE p.id = p_plan
      AND (p.client_id = auth.uid()
           OR (p.created_by = auth.uid() AND public.is_my_patient(p.client_id)))
  );
$$;

-- Editar: só o autor (o cliente no próprio plano; o nutricionista no plano que fez).
CREATE OR REPLACE FUNCTION public.can_edit_meal_plan(p_plan uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meal_plans p
    WHERE p.id = p_plan
      AND p.created_by = auth.uid()
      AND (p.client_id = auth.uid() OR public.is_my_patient(p.client_id))
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_meal_plan(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_edit_meal_plan(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_meal_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_meal_plan(uuid) TO authenticated;

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View meal plans" ON meal_plans;
CREATE POLICY "View meal plans"
  ON meal_plans FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR (created_by = auth.uid() AND public.is_my_patient(client_id)));

DROP POLICY IF EXISTS "Create meal plans" ON meal_plans;
CREATE POLICY "Create meal plans"
  ON meal_plans FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (client_id = auth.uid() OR public.is_my_patient(client_id)));

DROP POLICY IF EXISTS "Edit own meal plans" ON meal_plans;
CREATE POLICY "Edit own meal plans"
  ON meal_plans FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND (client_id = auth.uid() OR public.is_my_patient(client_id)))
  WITH CHECK (created_by = auth.uid() AND (client_id = auth.uid() OR public.is_my_patient(client_id)));

-- O cliente também pode apagar um plano que recebeu (ex.: depois de encerrar o vínculo).
DROP POLICY IF EXISTS "Delete meal plans" ON meal_plans;
CREATE POLICY "Delete meal plans"
  ON meal_plans FOR DELETE TO authenticated
  USING (client_id = auth.uid() OR (created_by = auth.uid() AND public.is_my_patient(client_id)));

ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View meal plan items" ON meal_plan_items;
CREATE POLICY "View meal plan items"
  ON meal_plan_items FOR SELECT TO authenticated
  USING (public.can_view_meal_plan(plan_id));

DROP POLICY IF EXISTS "Edit meal plan items" ON meal_plan_items;
CREATE POLICY "Edit meal plan items"
  ON meal_plan_items FOR ALL TO authenticated
  USING (public.can_edit_meal_plan(plan_id))
  WITH CHECK (public.can_edit_meal_plan(plan_id));

-- 5) Lista de compras --------------------------------------------------------
CREATE TABLE IF NOT EXISTS shopping_lists (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- [{ "id", "name", "quantity", "checked", "recipes": [títulos] }]
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own shopping list" ON shopping_lists;
CREATE POLICY "Users manage own shopping list"
  ON shopping_lists FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6) Estatísticas das receitas do autor -------------------------------------
-- Só contagens: quem favoritou ou registrou continua invisível.
CREATE OR REPLACE FUNCTION public.recipe_author_stats()
RETURNS TABLE (recipe_id uuid, favorites bigint, diary_logs bigint, in_plans bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id,
         (SELECT count(*) FROM favorites f WHERE f.recipe_id = r.id),
         (SELECT count(*) FROM nutrition_log_entries l WHERE l.recipe_id = r.id),
         (SELECT count(DISTINCT i.plan_id) FROM meal_plan_items i WHERE i.recipe_id = r.id)
  FROM recipes r
  WHERE r.author_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.recipe_author_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.recipe_author_stats() TO authenticated;
