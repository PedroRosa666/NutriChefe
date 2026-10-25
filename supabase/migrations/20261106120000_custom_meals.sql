/*
  Etapa 3 do plano de implementação (REF): refeições personalizadas no plano alimentar.

  - O plano deixa de ter só as quatro refeições fixas (café, almoço, lanche, jantar). Cada plano tem
    blocos de refeição (meal_plan_meals) com identidade própria: nome escrito pelo profissional,
    ordem, dias em que aparece, horário e orientação (que podem mudar por dia) e uma categoria
    opcional (só para sugestões e filtros; o nome nunca vira chave de tradução).
  - Itens, marcações ("Comi"), diário e trocas apontam para o bloco pelo id (meal_id). Dois "Lanche"
    no mesmo dia são blocos diferentes; renomear ou reordenar não move marcações nem trocas.
  - Limites (os mesmos na tela e aqui): 1 a 12 refeições por dia, nome de 1 a 60 caracteres,
    orientação até 1000 e até 30 itens por refeição em cada dia. Passou: "limit_exceeded", sem cortar
    nada calado.
  - A versão publicada guarda os blocos no retrato (formato 2). Bloco sem itens num dia não aparece
    nesse dia (não vira refeição prescrita nem conta na adesão).
  - Planos existentes: as quatro refeições viram quatro blocos (com os mesmos itens e totais) e as
    versões já publicadas ganham os blocos no retrato, sem mudar o conteúdo.
  - Apps antigos (ainda abertos) só conhecem as quatro refeições: continuam funcionando enquanto o
    plano só tem essas quatro; se houver bloco personalizado, a gravação é recusada com
    "app_outdated" (nunca apaga nem esconde refeições calado). app_min_client() diz a versão mínima
    do app; o app avisa para atualizar quando fica para trás.
*/

-- 0) Versão mínima do app que entende o banco ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_min_client()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 3 $$;
REVOKE ALL ON FUNCTION public.app_min_client() FROM public;
GRANT EXECUTE ON FUNCTION public.app_min_client() TO anon, authenticated;

-- 1) Blocos de refeição do rascunho ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plan_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  position smallint NOT NULL DEFAULT 0,
  -- Classificação opcional (sugestões do gerador, diário sem plano). NULL: refeição livre.
  category text CHECK (category IN ('breakfast', 'lunch', 'snack', 'dinner')),
  -- Dias da semana em que o bloco aparece (0 = segunda).
  days smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}' CHECK (days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  time_of_day text CHECK (time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  guidance text NOT NULL DEFAULT '' CHECK (char_length(guidance) <= 1000),
  -- Horário e orientação diferentes em algum dia: {"5": {"time": "09:00", "guidance": "..."}}.
  day_overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(day_overrides) = 'object'),
  -- Parte das calorias do dia (%), opcional: o gerador usa quando todas as refeições do dia têm.
  kcal_share numeric(4,1) CHECK (kcal_share > 0 AND kcal_share <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, id)
);
CREATE INDEX IF NOT EXISTS idx_meal_plan_meals_plan ON meal_plan_meals(plan_id, position);

ALTER TABLE meal_plan_meals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View meal plan meals" ON meal_plan_meals;
CREATE POLICY "View meal plan meals"
  ON meal_plan_meals FOR SELECT TO authenticated
  USING (public.can_view_meal_plan(plan_id));
DROP POLICY IF EXISTS "Edit meal plan meals" ON meal_plan_meals;
CREATE POLICY "Edit meal plan meals"
  ON meal_plan_meals FOR ALL TO authenticated
  USING (public.can_edit_meal_plan(plan_id))
  WITH CHECK (public.can_edit_meal_plan(plan_id));
REVOKE ALL ON meal_plan_meals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_meals TO authenticated;

-- Nome padrão das quatro refeições de sempre.
CREATE OR REPLACE FUNCTION public.default_meal_name(p_category text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_category
    WHEN 'breakfast' THEN 'Café da manhã' WHEN 'lunch' THEN 'Almoço'
    WHEN 'snack' THEN 'Lanche' WHEN 'dinner' THEN 'Jantar' ELSE 'Refeição' END;
$$;

-- Adaptador das quatro refeições: o bloco do plano com essa categoria (criado se ainda não existe).
CREATE OR REPLACE FUNCTION public.legacy_meal_id(p_plan uuid, p_category text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_category IS NULL OR p_category NOT IN ('breakfast', 'lunch', 'snack', 'dinner') THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  SELECT id INTO v_id FROM meal_plan_meals
  WHERE plan_id = p_plan AND category = p_category
  ORDER BY position, created_at LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO meal_plan_meals (plan_id, name, position, category)
    VALUES (p_plan, public.default_meal_name(p_category),
            array_position(ARRAY['breakfast', 'lunch', 'snack', 'dinner'], p_category) - 1, p_category)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.legacy_meal_id(uuid, text) FROM public, anon, authenticated;

-- Dia do plano (0 = segunda) de uma data.
CREATE OR REPLACE FUNCTION public.plan_day_of(p_date date)
RETURNS smallint
LANGUAGE sql IMMUTABLE
AS $$ SELECT (extract(isodow FROM p_date)::int - 1)::smallint $$;

-- Tira o CHECK antigo das quatro refeições de uma coluna "meal" (o nome do CHECK varia).
CREATE OR REPLACE FUNCTION pg_temp.drop_meal_check(p_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = p_table AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%meal%breakfast%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_table, v_name);
  END LOOP;
END;
$$;

-- 2) Itens ligados ao bloco ------------------------------------------------------------------------
-- "meal" fica como a categoria do bloco (ou NULL num bloco livre), para quem ainda lê o código.
ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS meal_id uuid;
SELECT pg_temp.drop_meal_check('meal_plan_items');
ALTER TABLE meal_plan_items ALTER COLUMN meal DROP NOT NULL;
ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_items_meal_category
  CHECK (meal IS NULL OR meal IN ('breakfast', 'lunch', 'snack', 'dinner'));

UPDATE meal_plan_items SET meal_id = public.legacy_meal_id(plan_id, meal) WHERE meal_id IS NULL;

ALTER TABLE meal_plan_items ALTER COLUMN meal_id SET NOT NULL;
ALTER TABLE meal_plan_items DROP CONSTRAINT IF EXISTS meal_plan_items_meal_fkey;
-- Chave composta: o bloco é sempre do mesmo plano do item.
ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_items_meal_fkey
  FOREIGN KEY (plan_id, meal_id) REFERENCES meal_plan_meals(plan_id, id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_meal ON meal_plan_items(meal_id);

-- Gravação sem bloco (seed das contas demo, app antigo): usa o bloco da categoria. Sempre acerta
-- "meal" pela categoria do bloco.
CREATE OR REPLACE FUNCTION public.item_meal_fill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.meal_id IS NULL THEN
    NEW.meal_id := public.legacy_meal_id(NEW.plan_id, NEW.meal);
  END IF;
  NEW.meal := (SELECT m.category FROM meal_plan_meals m WHERE m.id = NEW.meal_id AND m.plan_id = NEW.plan_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.item_meal_fill() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_item_meal_fill ON meal_plan_items;
CREATE TRIGGER trg_item_meal_fill BEFORE INSERT OR UPDATE OF meal_id, meal, plan_id ON meal_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.item_meal_fill();

-- 3) Retrato da versão: formato 2, com os blocos ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_snapshot(p_plan uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH used AS (
    -- Dias em que cada bloco aparece de fato: os marcados e com pelo menos um item.
    SELECT m.*, (SELECT array_agg(DISTINCT i.day ORDER BY i.day) FROM meal_plan_items i
                 WHERE i.meal_id = m.id AND i.day = ANY (m.days)) AS used_days
    FROM meal_plan_meals m WHERE m.plan_id = p_plan
  )
  SELECT jsonb_build_object(
    'format', 2,
    'title', p.title,
    'notes', p.notes,
    'meals', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', u.id, 'name', u.name, 'category', u.category, 'days', to_jsonb(u.used_days),
               'time', u.time_of_day, 'guidance', u.guidance, 'day_overrides', u.day_overrides,
               'kcal_share', u.kcal_share)
             ORDER BY u.position, u.created_at)
      FROM used u WHERE u.used_days IS NOT NULL), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'day', i.day, 'meal_id', i.meal_id, 'meal', i.meal, 'recipe_id', i.recipe_id,
               'servings', i.servings, 'food_id', i.food_id, 'grams', i.grams, 'measure_label', i.measure_label,
               'option_group', i.option_group, 'note', i.note,
               'food', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
                 'id', f.id, 'taco_id', f.taco_id, 'owner_id', f.owner_id, 'name', f.name, 'category', f.category,
                 'kcal', f.kcal, 'protein', f.protein, 'carbs', f.carbs, 'fat', f.fat, 'fiber', f.fiber,
                 'sodium', f.sodium, 'nutrients', f.nutrients, 'measures', f.measures) END)
             ORDER BY i.day, m.position, m.created_at, i.position, i.created_at)
      FROM meal_plan_items i
      JOIN meal_plan_meals m ON m.id = i.meal_id
      LEFT JOIN foods f ON f.id = i.food_id
      WHERE i.plan_id = p.id AND i.day = ANY (m.days)), '[]'::jsonb),
    'recipes', coalesce((
      SELECT jsonb_object_agg(r.id, jsonb_build_object(
               'title', r.title, 'image', r.image, 'category', r.category, 'prep_time', r.prep_time,
               'difficulty', r.difficulty, 'nutrition_facts', r.nutrition_facts, 'ingredients', r.ingredients))
      FROM recipes r
      WHERE r.id IN (SELECT i.recipe_id FROM meal_plan_items i JOIN meal_plan_meals m ON m.id = i.meal_id
                     WHERE i.plan_id = p.id AND i.recipe_id IS NOT NULL AND i.day = ANY (m.days))), '{}'::jsonb)
  )
  FROM meal_plans p WHERE p.id = p_plan;
$$;
REVOKE ALL ON FUNCTION public.plan_snapshot(uuid) FROM public, anon, authenticated;

-- Versões já publicadas (formato 1): ganham os blocos e o meal_id de cada item; o resto fica igual.
DO $$
BEGIN
  PERFORM public.legacy_meal_id(s.plan_id, s.meal)
  FROM (SELECT DISTINCT v.plan_id, e->>'meal' AS meal
        FROM meal_plan_versions v, jsonb_array_elements(v.content->'items') e
        WHERE coalesce((v.content->>'format')::int, 1) = 1 AND e->>'meal' IS NOT NULL) s;
END $$;

UPDATE meal_plan_versions v
SET content = v.content || jsonb_build_object(
  'format', 2,
  'meals', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', m.id, 'name', m.name, 'category', m.category,
             'days', (SELECT jsonb_agg(d ORDER BY d) FROM (
                        SELECT DISTINCT (e->>'day')::int AS d FROM jsonb_array_elements(v.content->'items') e
                        WHERE e->>'meal' = m.category) days),
             'time', NULL, 'guidance', '', 'day_overrides', '{}'::jsonb, 'kcal_share', NULL)
           ORDER BY m.position, m.created_at)
    FROM meal_plan_meals m
    WHERE m.plan_id = v.plan_id
      AND m.id IN (SELECT public.legacy_meal_id(v.plan_id, e->>'meal') FROM jsonb_array_elements(v.content->'items') e)), '[]'::jsonb),
  'items', coalesce((
    SELECT jsonb_agg(e || jsonb_build_object('meal_id', public.legacy_meal_id(v.plan_id, e->>'meal')) ORDER BY o)
    FROM jsonb_array_elements(v.content->'items') WITH ORDINALITY AS t(e, o)), '[]'::jsonb))
WHERE coalesce((v.content->>'format')::int, 1) = 1;

-- 4) Marcações ("Comi") por bloco ------------------------------------------------------------------
ALTER TABLE meal_plan_checks
  ADD COLUMN IF NOT EXISTS meal_id uuid,
  ADD COLUMN IF NOT EXISTS meal_name text CHECK (char_length(meal_name) <= 60);
SELECT pg_temp.drop_meal_check('meal_plan_checks');
ALTER TABLE meal_plan_checks ALTER COLUMN meal DROP NOT NULL;
ALTER TABLE meal_plan_checks ADD CONSTRAINT meal_plan_checks_meal_category
  CHECK (meal IS NULL OR meal IN ('breakfast', 'lunch', 'snack', 'dinner'));

UPDATE meal_plan_checks c
SET meal_id = public.legacy_meal_id(c.plan_id, c.meal),
    meal_name = (SELECT m.name FROM meal_plan_meals m WHERE m.id = public.legacy_meal_id(c.plan_id, c.meal))
WHERE c.meal_id IS NULL;
ALTER TABLE meal_plan_checks ALTER COLUMN meal_id SET NOT NULL;

-- Uma marcação por paciente, plano, dia e BLOCO (antes era pela refeição: dois lanches colidiam).
ALTER TABLE meal_plan_checks DROP CONSTRAINT IF EXISTS meal_plan_checks_plan_day_meal_key;
ALTER TABLE meal_plan_checks DROP CONSTRAINT IF EXISTS meal_plan_checks_meal_key;
ALTER TABLE meal_plan_checks ADD CONSTRAINT meal_plan_checks_meal_key UNIQUE (client_id, plan_id, check_date, meal_id);

-- O que foi comido numa refeição pode ter até 30 itens (o limite por refeição).
DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.meal_plan_checks'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%jsonb_array_length(chosen)%'
  LOOP
    EXECUTE format('ALTER TABLE meal_plan_checks DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;
ALTER TABLE meal_plan_checks ADD CONSTRAINT meal_plan_checks_chosen_check
  CHECK (jsonb_typeof(chosen) = 'array' AND jsonb_array_length(chosen) <= 30);

-- Gravação sem bloco (app antigo): o bloco da categoria na versão do dia. Ambíguo: pede atualização.
CREATE OR REPLACE FUNCTION public.check_meal_fill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meals jsonb;
BEGIN
  IF NEW.meal_id IS NULL THEN
    SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO v_meals
    FROM meal_plan_versions v, jsonb_array_elements(v.content->'meals') m
    WHERE v.id = public.plan_version_on(NEW.plan_id, NEW.check_date)
      AND m->>'category' = NEW.meal AND (m->'days') @> to_jsonb(public.plan_day_of(NEW.check_date));
    IF jsonb_array_length(v_meals) > 1 THEN
      RAISE EXCEPTION 'app_outdated';
    END IF;
    NEW.meal_id := coalesce((v_meals->0->>'id')::uuid, public.legacy_meal_id(NEW.plan_id, NEW.meal));
  END IF;
  IF NEW.meal_name IS NULL THEN
    NEW.meal_name := coalesce(
      (SELECT m->>'name' FROM meal_plan_versions v, jsonb_array_elements(v.content->'meals') m
       WHERE v.id = public.plan_version_on(NEW.plan_id, NEW.check_date) AND m->>'id' = NEW.meal_id::text LIMIT 1),
      (SELECT m.name FROM meal_plan_meals m WHERE m.id = NEW.meal_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_meal_fill() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_check_meal_fill ON meal_plan_checks;
CREATE TRIGGER trg_check_meal_fill BEFORE INSERT ON meal_plan_checks
  FOR EACH ROW EXECUTE FUNCTION public.check_meal_fill();

-- 5) Diário: a refeição do registro pode ser um bloco do plano -------------------------------------
-- meal_id/meal_name: o bloco (e o nome dele naquele dia). Sem bloco: a categoria de sempre em "meal".
ALTER TABLE nutrition_log_entries
  ADD COLUMN IF NOT EXISTS meal_id uuid,
  ADD COLUMN IF NOT EXISTS meal_name text CHECK (char_length(meal_name) <= 60);
UPDATE nutrition_log_entries e SET meal_id = c.meal_id, meal_name = c.meal_name
FROM meal_plan_checks c
WHERE e.plan_check_id = c.id AND e.meal_id IS NULL;

-- 6) Trocas: o item e o bloco pedidos --------------------------------------------------------------
ALTER TABLE food_swap_requests
  ADD COLUMN IF NOT EXISTS meal_id uuid,
  ADD COLUMN IF NOT EXISTS meal_name text CHECK (char_length(meal_name) <= 60),
  ADD COLUMN IF NOT EXISTS item_id uuid;
SELECT pg_temp.drop_meal_check('food_swap_requests');
ALTER TABLE food_swap_requests ALTER COLUMN meal DROP NOT NULL;
ALTER TABLE food_swap_requests ADD CONSTRAINT food_swap_requests_meal_category
  CHECK (meal IS NULL OR meal IN ('breakfast', 'lunch', 'snack', 'dinner'));

-- "outdated": o item mudou numa publicação posterior; o paciente pode pedir de novo.
DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.food_swap_requests'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%pending%'
  LOOP
    EXECUTE format('ALTER TABLE food_swap_requests DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;
ALTER TABLE food_swap_requests ADD CONSTRAINT food_swap_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'canceled', 'outdated'));

UPDATE food_swap_requests s
SET meal_id = public.legacy_meal_id(s.plan_id, s.meal),
    meal_name = (SELECT m.name FROM meal_plan_meals m WHERE m.id = public.legacy_meal_id(s.plan_id, s.meal))
WHERE s.meal_id IS NULL AND s.meal IS NOT NULL;
UPDATE food_swap_requests s
SET item_id = (SELECT i.id FROM meal_plan_items i
               WHERE i.plan_id = s.plan_id AND i.day = s.day AND i.meal_id = s.meal_id
                 AND i.option_group IS NOT DISTINCT FROM s.option_group
                 AND (i.recipe_id = s.original_recipe_id OR i.food_id = s.original_food_id)
               ORDER BY i.position, i.created_at LIMIT 1)
WHERE s.item_id IS NULL AND s.status = 'pending';

-- Pedido gravado sem bloco (Laboratório do admin, app antigo): o bloco da categoria.
CREATE OR REPLACE FUNCTION public.swap_meal_fill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.meal_id IS NULL AND NEW.meal IS NOT NULL THEN
    NEW.meal_id := public.legacy_meal_id(NEW.plan_id, NEW.meal);
  END IF;
  IF NEW.meal_name IS NULL THEN
    NEW.meal_name := (SELECT m.name FROM meal_plan_meals m WHERE m.id = NEW.meal_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.swap_meal_fill() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_swap_meal_fill ON food_swap_requests;
CREATE TRIGGER trg_swap_meal_fill BEFORE INSERT ON food_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.swap_meal_fill();

-- Pedir troca: com p_item (app novo) o banco tira dia, bloco, grupo e original da versão vigente;
-- sem ele (app antigo), vale o que foi enviado.
DROP FUNCTION IF EXISTS public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.request_food_swap(
  p_plan uuid, p_day smallint, p_meal text, p_option_group smallint,
  p_original_recipe uuid, p_original_food uuid, p_original_label text,
  p_requested_food uuid, p_requested_grams numeric, p_requested_label text,
  p_requested_recipe uuid, p_requested_servings numeric, p_reason text,
  p_item uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan meal_plans;
  v_content jsonb;
  v_item jsonb;
  v_meal_id uuid;
  v_meal_name text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_plan FROM meal_plans WHERE id = p_plan;
  IF v_plan.id IS NULL OR v_plan.client_id <> auth.uid() OR v_plan.created_by = auth.uid() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM nutritionist_clients
    WHERE nutritionist_id = v_plan.created_by AND client_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF p_requested_food IS NOT NULL AND p_requested_recipe IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_request';
  END IF;
  IF p_requested_food IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM foods WHERE id = p_requested_food AND (owner_id IS NULL OR owner_id = v_plan.created_by)
  ) THEN
    RAISE EXCEPTION 'invalid_food';
  END IF;
  IF p_requested_recipe IS NOT NULL AND NOT EXISTS (SELECT 1 FROM recipes WHERE id = p_requested_recipe) THEN
    RAISE EXCEPTION 'invalid_recipe';
  END IF;

  IF p_item IS NOT NULL THEN
    SELECT v.content INTO v_content FROM meal_plan_versions v WHERE v.id = public.plan_version_on(p_plan, public.app_today());
    SELECT e INTO v_item FROM jsonb_array_elements(v_content->'items') e WHERE e->>'id' = p_item::text;
    IF v_item IS NULL THEN
      RAISE EXCEPTION 'resource_archived';
    END IF;
    p_day := (v_item->>'day')::smallint;
    v_meal_id := (v_item->>'meal_id')::uuid;
    p_meal := v_item->>'meal';
    p_option_group := (v_item->>'option_group')::smallint;
    p_original_recipe := CASE WHEN v_item->>'food_id' IS NULL THEN (v_item->>'recipe_id')::uuid END;
    p_original_food := (v_item->>'food_id')::uuid;
    v_meal_name := (SELECT m->>'name' FROM jsonb_array_elements(v_content->'meals') m WHERE m->>'id' = v_meal_id::text);
    IF EXISTS (SELECT 1 FROM food_swap_requests WHERE plan_id = p_plan AND item_id = p_item AND status = 'pending') THEN
      RAISE EXCEPTION 'already_pending';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM food_swap_requests
    WHERE plan_id = p_plan AND day = p_day AND meal = p_meal AND status = 'pending'
      AND option_group IS NOT DISTINCT FROM p_option_group
      AND (original_recipe_id = p_original_recipe OR original_food_id = p_original_food)
  ) THEN
    RAISE EXCEPTION 'already_pending';
  END IF;

  INSERT INTO food_swap_requests (
    plan_id, client_id, nutritionist_id, day, meal, meal_id, meal_name, item_id, option_group,
    original_recipe_id, original_food_id, original_label,
    requested_food_id, requested_grams, requested_label,
    requested_recipe_id, requested_servings, reason
  ) VALUES (
    p_plan, auth.uid(), v_plan.created_by, p_day, p_meal, v_meal_id, v_meal_name, p_item, p_option_group,
    p_original_recipe, p_original_food, left(p_original_label, 200),
    p_requested_food, CASE WHEN p_requested_food IS NULL THEN NULL ELSE p_requested_grams END,
    CASE WHEN p_requested_food IS NULL THEN NULL ELSE left(p_requested_label, 200) END,
    p_requested_recipe, CASE WHEN p_requested_recipe IS NULL THEN NULL ELSE coalesce(p_requested_servings, 1) END,
    left(coalesce(p_reason, ''), 500)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, uuid, numeric, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, uuid, numeric, text, uuid) TO authenticated;

-- A troca aprovada vai para o item pedido (pelo id); se ele sumiu ou mudou, para um igual no mesmo
-- bloco, dia e grupo; senão não aplica (o nutricionista vê que não entrou no plano).
CREATE OR REPLACE FUNCTION public.apply_swap_to_plan(
  p_request food_swap_requests, p_food uuid, p_grams numeric, p_label text, p_recipe uuid, p_servings numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item uuid;
BEGIN
  SELECT i.id INTO v_item
  FROM meal_plan_items i
  WHERE i.plan_id = p_request.plan_id
    AND (i.recipe_id = p_request.original_recipe_id OR i.food_id = p_request.original_food_id)
    AND (i.id = p_request.item_id
         OR (i.day = p_request.day AND i.meal_id = p_request.meal_id
             AND i.option_group IS NOT DISTINCT FROM p_request.option_group))
  ORDER BY (i.id = p_request.item_id) DESC NULLS LAST, i.position, i.created_at
  LIMIT 1;

  IF v_item IS NULL THEN
    RETURN false;
  END IF;

  IF p_recipe IS NOT NULL THEN
    UPDATE meal_plan_items
    SET recipe_id = p_recipe, servings = coalesce(p_servings, 1), food_id = NULL, grams = NULL, measure_label = NULL
    WHERE id = v_item;
  ELSE
    UPDATE meal_plan_items
    SET recipe_id = NULL, food_id = p_food, grams = p_grams, servings = 1, measure_label = left(p_label, 120)
    WHERE id = v_item;
  END IF;

  UPDATE meal_plans SET revision = revision + 1, updated_at = now() WHERE id = p_request.plan_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_swap_to_plan(food_swap_requests, uuid, numeric, text, uuid, numeric) FROM public, anon, authenticated;

-- Pedido que ficou desatualizado: o aviso ao nutricionista deixa de ser "novo".
CREATE OR REPLACE FUNCTION public.notify_swap_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify(NEW.nutritionist_id, 'swap_requested', NEW.id, jsonb_build_object(
      'name', public.profile_name(NEW.client_id), 'client_id', NEW.client_id, 'item', NEW.original_label));
  ELSIF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM public.notify(NEW.client_id, 'swap_answered', NEW.id, jsonb_build_object(
      'name', public.profile_name(NEW.nutritionist_id), 'status', NEW.status, 'item', NEW.original_label,
      'offered', NEW.counter_food_id IS NOT NULL OR NEW.counter_recipe_id IS NOT NULL));
    UPDATE notifications SET read_at = now()
    WHERE user_id = NEW.nutritionist_id AND kind = 'swap_requested' AND ref_id = NEW.id AND read_at IS NULL;
  ELSIF OLD.status = 'pending' AND NEW.status = 'canceled' THEN
    DELETE FROM notifications
    WHERE user_id = NEW.nutritionist_id AND kind = 'swap_requested' AND ref_id = NEW.id AND read_at IS NULL;
  ELSIF OLD.status = 'pending' AND NEW.status = 'outdated' THEN
    UPDATE notifications SET read_at = now()
    WHERE user_id = NEW.nutritionist_id AND kind = 'swap_requested' AND ref_id = NEW.id AND read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Publicar: pedidos pendentes sobre um item que mudou ficam desatualizados ----------------------
CREATE OR REPLACE FUNCTION public.publish_plan_internal(p_plan uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan meal_plans;
  v_last meal_plan_versions;
  v_from date;
  v_number integer;
  v_id uuid;
  v_content jsonb;
BEGIN
  SELECT * INTO v_plan FROM meal_plans WHERE id = p_plan FOR UPDATE;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'resource_archived';
  END IF;
  -- Usuário do app: só o autor, com o paciente ainda vinculado (ou o próprio paciente).
  -- Sem usuário (rotinas do servidor, como as contas demo): liberado.
  IF auth.uid() IS NOT NULL AND NOT (
       v_plan.created_by = auth.uid() AND (v_plan.client_id = auth.uid() OR public.is_my_patient(v_plan.client_id))) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT * INTO v_last FROM meal_plan_versions WHERE plan_id = p_plan ORDER BY number DESC LIMIT 1;
  -- Nada mudou desde a última publicação: devolve a versão atual.
  IF v_last.id IS NOT NULL AND v_plan.published_revision = v_plan.revision THEN
    RETURN jsonb_build_object('version_id', v_last.id, 'number', v_last.number, 'valid_from', v_last.valid_from, 'new', false);
  END IF;

  v_from := public.app_today();
  IF EXISTS (SELECT 1 FROM meal_plan_checks WHERE plan_id = p_plan AND check_date = v_from) THEN
    v_from := v_from + 1;
  END IF;
  -- Nunca antes de uma versão já agendada.
  IF v_last.valid_from > v_from THEN
    v_from := v_last.valid_from;
  END IF;
  v_number := coalesce(v_last.number, 0) + 1;
  v_content := public.plan_snapshot(p_plan);

  INSERT INTO meal_plan_versions (plan_id, client_id, number, plan_revision, valid_from, content, published_by)
  VALUES (p_plan, v_plan.client_id, v_number, v_plan.revision, v_from, v_content, auth.uid())
  RETURNING id INTO v_id;

  UPDATE meal_plans SET published_revision = revision, updated_at = now() WHERE id = p_plan;

  -- Trocas aprovadas que estavam esperando publicação passam a valer junto.
  UPDATE food_swap_requests SET effective_from = v_from
  WHERE plan_id = p_plan AND status IN ('approved', 'rejected') AND applied AND effective_from IS NULL;

  -- Pedido aberto sobre um item que não está mais igual na nova versão: desatualizado (nunca é
  -- aplicado a outro item parecido). O paciente pode pedir de novo.
  UPDATE food_swap_requests r SET status = 'outdated'
  WHERE r.plan_id = p_plan AND r.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_content->'items') e
      WHERE (r.item_id IS NULL OR e->>'id' = r.item_id::text)
        AND (e->>'day')::smallint = r.day
        AND e->>'meal_id' = r.meal_id::text
        AND (e->>'option_group')::smallint IS NOT DISTINCT FROM r.option_group
        AND ((e->>'recipe_id')::uuid = r.original_recipe_id OR (e->>'food_id')::uuid = r.original_food_id));

  -- Primeiro plano do paciente: entra em uso sozinho. Se já há um em uso, o paciente escolhe.
  INSERT INTO client_plan_selection (client_id, plan_id) VALUES (v_plan.client_id, p_plan)
  ON CONFLICT (client_id) DO NOTHING;

  PERFORM public.record_care_event(
    v_plan.client_id, CASE WHEN v_plan.created_by = v_plan.client_id THEN NULL ELSE v_plan.created_by END,
    'plan_published', p_plan, v_number,
    jsonb_build_object('title', v_plan.title, 'number', v_number, 'valid_from', v_from, 'version_id', v_id),
    'plan:' || p_plan || ':' || v_number);

  RETURN jsonb_build_object('version_id', v_id, 'number', v_number, 'valid_from', v_from, 'new', true);
END;
$$;
REVOKE ALL ON FUNCTION public.publish_plan_internal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.publish_plan_internal(uuid) TO authenticated;

-- 8) Salvar o rascunho com os blocos ---------------------------------------------------------------
-- Horário/orientação por dia: só dias 0..6, horário HH:MM e orientação até 1000 caracteres.
CREATE OR REPLACE FUNCTION public.clean_day_overrides(p jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT coalesce(jsonb_object_agg(k, o), '{}'::jsonb)
  FROM (
    SELECT k, jsonb_strip_nulls(jsonb_build_object(
             'time', CASE WHEN v->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN v->>'time' END,
             'guidance', nullif(left(coalesce(v->>'guidance', ''), 1000), ''))) AS o
    FROM jsonb_each(CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END) AS t(k, v)
    WHERE k IN ('0', '1', '2', '3', '4', '5', '6') AND jsonb_typeof(v) = 'object'
  ) s
  WHERE o <> '{}'::jsonb;
$$;

/*
  p_meals (app novo): a lista completa de blocos, na ordem; cada um com id (o app gera para os
  novos), name, category, days, time, guidance, day_overrides e kcal_share. Blocos fora da lista
  saem (com os itens do rascunho; versões publicadas, marcações e diário ficam).
  Sem p_meals (app antigo): itens com o código das quatro refeições; recusado com "app_outdated"
  se o plano já tem blocos que esse app não sabe mostrar.
*/
DROP FUNCTION IF EXISTS public.save_plan_draft(uuid, uuid, text, text, jsonb, integer, boolean, uuid);
CREATE OR REPLACE FUNCTION public.save_plan_draft(
  p_plan uuid, p_client uuid, p_title text, p_notes text, p_items jsonb,
  p_expected_revision integer, p_publish boolean, p_operation uuid, p_meals jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_done jsonb;
  v_id uuid := p_plan;
  v_revision integer;
  v_version jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  v_done := public.op_begin(p_operation, 'save_plan_draft',
    jsonb_build_object('plan', p_plan, 'client', p_client, 'title', p_title, 'notes', p_notes, 'items', p_items,
                       'rev', p_expected_revision, 'publish', p_publish, 'meals', p_meals));
  IF v_done IS NOT NULL THEN
    RETURN v_done;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR (p_meals IS NOT NULL AND jsonb_typeof(p_meals) <> 'array') THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  IF jsonb_array_length(p_items) > 400 OR jsonb_array_length(coalesce(p_meals, '[]'::jsonb)) > 40 THEN
    RAISE EXCEPTION 'limit_exceeded';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO meal_plans (client_id, created_by, title, notes)
    VALUES (p_client, auth.uid(), coalesce(nullif(left(trim(p_title), 120), ''), 'Plano alimentar'), left(coalesce(p_notes, ''), 2000))
    RETURNING id, revision INTO v_id, v_revision;
  ELSE
    SELECT revision INTO v_revision FROM meal_plans WHERE id = v_id AND created_by = auth.uid() FOR UPDATE;
    IF v_revision IS NULL THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
    IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_revision THEN
      RAISE EXCEPTION 'version_conflict';
    END IF;
    UPDATE meal_plans
    SET title = coalesce(nullif(left(trim(p_title), 120), ''), 'Plano alimentar'),
        notes = left(coalesce(p_notes, ''), 2000),
        revision = revision + 1,
        updated_at = now()
    WHERE id = v_id
    RETURNING revision INTO v_revision;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
  END IF;

  IF p_meals IS NULL THEN
    -- App antigo: só sabe mostrar as quatro refeições, uma de cada, em todos os dias.
    IF EXISTS (SELECT 1 FROM meal_plan_meals WHERE plan_id = v_id AND (category IS NULL OR cardinality(days) < 7))
       OR EXISTS (SELECT 1 FROM meal_plan_meals WHERE plan_id = v_id GROUP BY category HAVING count(*) > 1) THEN
      RAISE EXCEPTION 'app_outdated';
    END IF;
  ELSE
    -- Todo bloco tem id; um id de outro plano não pode ser "puxado" para este.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_meals) e WHERE nullif(e->>'id', '') IS NULL)
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_meals) e
                  JOIN meal_plan_meals m ON m.id = (e->>'id')::uuid WHERE m.plan_id <> v_id) THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
    -- Até 12 refeições em cada dia.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_meals) e, jsonb_array_elements_text(coalesce(e->'days', '[]'::jsonb)) d
               GROUP BY d HAVING count(*) > 12) THEN
      RAISE EXCEPTION 'limit_exceeded';
    END IF;

    DELETE FROM meal_plan_meals m
    WHERE m.plan_id = v_id AND m.id NOT IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(p_meals) e);

    INSERT INTO meal_plan_meals (id, plan_id, name, position, category, days, time_of_day, guidance, day_overrides, kcal_share)
    SELECT x.id, v_id,
           coalesce(nullif(left(trim(x.name), 60), ''), 'Refeição ' || x.ord),
           least(x.ord - 1, 32000),
           CASE WHEN x.category IN ('breakfast', 'lunch', 'snack', 'dinner') THEN x.category END,
           coalesce((SELECT array_agg(DISTINCT d::smallint ORDER BY d::smallint)
                     FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(x.days) = 'array' THEN x.days ELSE '[]'::jsonb END) d),
                    '{}'::smallint[]),
           nullif(x.time, ''),
           left(coalesce(x.guidance, ''), 1000),
           public.clean_day_overrides(x.day_overrides),
           x.kcal_share
    FROM jsonb_to_recordset(
           (SELECT coalesce(jsonb_agg(e || jsonb_build_object('ord', o)), '[]'::jsonb)
            FROM jsonb_array_elements(p_meals) WITH ORDINALITY AS t(e, o))
         ) AS x(id uuid, name text, category text, days jsonb, time text, guidance text, day_overrides jsonb,
                kcal_share numeric, ord integer)
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, position = EXCLUDED.position, category = EXCLUDED.category, days = EXCLUDED.days,
        time_of_day = EXCLUDED.time_of_day, guidance = EXCLUDED.guidance, day_overrides = EXCLUDED.day_overrides,
        kcal_share = EXCLUDED.kcal_share;

    -- Cada item num bloco deste plano, num dia em que o bloco aparece.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_items) e
      WHERE NOT EXISTS (SELECT 1 FROM meal_plan_meals m
                        WHERE m.plan_id = v_id AND m.id = nullif(e->>'meal_id', '')::uuid
                          AND (e->>'day')::smallint = ANY (m.days))
    ) THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
  END IF;

  -- Até 30 itens por refeição em cada dia (o "Comi" leva todos para o diário).
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) e
             GROUP BY coalesce(e->>'meal_id', e->>'meal'), e->>'day' HAVING count(*) > 30) THEN
    RAISE EXCEPTION 'limit_exceeded';
  END IF;

  -- Um id que já pertence a outro plano não pode ser "puxado" para este.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
    JOIN meal_plan_items i ON i.id = nullif(e->>'id', '')::uuid
    WHERE i.plan_id <> v_id
  ) THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;

  DELETE FROM meal_plan_items i
  WHERE i.plan_id = v_id
    AND i.id NOT IN (SELECT nullif(e->>'id', '')::uuid FROM jsonb_array_elements(p_items) e WHERE nullif(e->>'id', '') IS NOT NULL);

  INSERT INTO meal_plan_items (id, plan_id, day, meal_id, meal, recipe_id, servings, food_id, grams, measure_label, option_group, note, position)
  SELECT coalesce(x.id, gen_random_uuid()), v_id, x.day, x.meal_id, x.meal,
         CASE WHEN x.food_id IS NULL THEN x.recipe_id END,
         CASE WHEN x.food_id IS NULL THEN coalesce(x.servings, 1) ELSE 1 END,
         x.food_id,
         CASE WHEN x.food_id IS NOT NULL THEN x.grams END,
         CASE WHEN x.food_id IS NOT NULL THEN nullif(left(coalesce(x.measure_label, ''), 120), '') END,
         x.option_group,
         left(coalesce(x.note, ''), 300),
         least(x.ord, 32000)
  FROM jsonb_to_recordset(
         (SELECT coalesce(jsonb_agg(e || jsonb_build_object('ord', o)), '[]'::jsonb)
          FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, o))
       ) AS x(id uuid, day smallint, meal_id uuid, meal text, recipe_id uuid, servings numeric, food_id uuid, grams numeric,
              measure_label text, option_group smallint, note text, ord integer)
  ON CONFLICT (id) DO UPDATE
  SET day = EXCLUDED.day, meal_id = EXCLUDED.meal_id, meal = EXCLUDED.meal, recipe_id = EXCLUDED.recipe_id,
      servings = EXCLUDED.servings, food_id = EXCLUDED.food_id, grams = EXCLUDED.grams,
      measure_label = EXCLUDED.measure_label, option_group = EXCLUDED.option_group, note = EXCLUDED.note,
      position = EXCLUDED.position;

  IF p_publish THEN
    v_version := public.publish_plan_internal(v_id);
  END IF;

  v_result := jsonb_build_object('plan_id', v_id, 'revision', v_revision, 'version', v_version);
  RETURN public.op_finish(p_operation, v_result);
END;
$$;
REVOKE ALL ON FUNCTION public.save_plan_draft(uuid, uuid, text, text, jsonb, integer, boolean, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_plan_draft(uuid, uuid, text, text, jsonb, integer, boolean, uuid, jsonb) TO authenticated;

-- 9) "Comi" por bloco ------------------------------------------------------------------------------
/*
  Marcação de uma refeição (bloco) num dia, com o diário na mesma transação.
  - O bloco precisa estar na versão que vale na data, naquele dia da semana.
  - "Comi": p_items = [{ item_id, title, servings, per_serving }]. Precisa ter todos os itens fixos
    e exatamente uma opção de cada grupo "escolha 1", sempre pelo id do item. Grava só esses.
  - Repetir (mesmo p_operation, clique duplo, duas abas) não duplica: uma marcação por bloco e dia,
    e o diário dela é substituído inteiro. Desmarcar tira só o que ela lançou.
  SECURITY INVOKER: valem as regras (RLS) de marcações e diário.
*/
CREATE OR REPLACE FUNCTION public.record_meal_check(
  p_plan uuid, p_date date, p_meal uuid, p_status text, p_items jsonb, p_note text, p_operation uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_done jsonb;
  v_content jsonb;
  v_meal jsonb;
  v_day smallint := public.plan_day_of(p_date);
  v_items jsonb;
  v_picked jsonb := coalesce(p_items, '[]'::jsonb);
  v_check meal_plan_checks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  v_done := public.op_begin(p_operation, 'record_meal_check', jsonb_build_object(
    'plan', p_plan, 'date', p_date, 'meal', p_meal, 'status', p_status, 'items', p_items, 'note', p_note));
  IF v_done IS NOT NULL THEN
    RETURN v_done;
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('ate', 'other', 'skipped') OR jsonb_typeof(v_picked) <> 'array' THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM meal_plans WHERE id = p_plan AND client_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT v.content INTO v_content FROM meal_plan_versions v WHERE v.id = public.plan_version_on(p_plan, p_date);
  SELECT m INTO v_meal FROM jsonb_array_elements(v_content->'meals') m
  WHERE m->>'id' = p_meal::text AND (m->'days') @> to_jsonb(v_day);
  IF v_meal IS NULL THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  v_items := coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(v_content->'items') e
                       WHERE e->>'meal_id' = p_meal::text AND (e->>'day')::smallint = v_day), '[]'::jsonb);

  IF p_status = 'ate' THEN
    IF -- só itens desta refeição, sem repetir
       EXISTS (SELECT 1 FROM jsonb_array_elements(v_picked) c
               WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) e WHERE e->>'id' = c->>'item_id'))
       OR (SELECT count(DISTINCT c->>'item_id') FROM jsonb_array_elements(v_picked) c) <> jsonb_array_length(v_picked)
       -- todos os itens fixos
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_items) e
                  WHERE e->>'option_group' IS NULL
                    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_picked) c WHERE c->>'item_id' = e->>'id'))
       -- exatamente uma opção de cada grupo
       OR EXISTS (SELECT 1 FROM (SELECT DISTINCT e->>'option_group' AS g FROM jsonb_array_elements(v_items) e
                                 WHERE e->>'option_group' IS NOT NULL) gs
                  WHERE (SELECT count(*) FROM jsonb_array_elements(v_picked) c
                         JOIN jsonb_array_elements(v_items) e ON e->>'id' = c->>'item_id'
                         WHERE e->>'option_group' = gs.g) <> 1)
    THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
  ELSE
    v_picked := '[]'::jsonb;
  END IF;

  INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, meal_id, meal_name, status, chosen, note)
  VALUES (auth.uid(), p_plan, p_date, v_meal->>'category', p_meal, left(v_meal->>'name', 60), p_status,
          coalesce((SELECT jsonb_agg(left(coalesce(c->>'title', ''), 200) ORDER BY o)
                    FROM jsonb_array_elements(v_picked) WITH ORDINALITY AS t(c, o)), '[]'::jsonb),
          left(coalesce(p_note, ''), 300))
  ON CONFLICT (client_id, plan_id, check_date, meal_id)
  DO UPDATE SET status = EXCLUDED.status, chosen = EXCLUDED.chosen, note = EXCLUDED.note, meal_name = EXCLUDED.meal_name
  RETURNING * INTO v_check;

  -- O que esta marcação tinha lançado sai; "Comi" lança de novo a lista atual.
  DELETE FROM nutrition_log_entries WHERE plan_check_id = v_check.id;

  IF p_status = 'ate' THEN
    INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_id, recipe_title, servings, per_serving,
                                       meal, meal_id, meal_name, plan_check_id)
    SELECT auth.uid(), p_date,
           CASE WHEN e->>'food_id' IS NULL THEN (e->>'recipe_id')::uuid END,
           left(coalesce(c->>'title', ''), 200),
           greatest(least(coalesce((c->>'servings')::numeric, 1), 20), 0.1),
           CASE WHEN jsonb_typeof(c->'per_serving') = 'object' THEN c->'per_serving' ELSE '{}'::jsonb END,
           v_check.meal, p_meal, v_check.meal_name, v_check.id
    FROM jsonb_array_elements(v_picked) c
    JOIN jsonb_array_elements(v_items) e ON e->>'id' = c->>'item_id';
  END IF;

  RETURN public.op_finish(p_operation, to_jsonb(v_check));
END;
$$;
REVOKE ALL ON FUNCTION public.record_meal_check(uuid, date, uuid, text, jsonb, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_meal_check(uuid, date, uuid, text, jsonb, text, uuid) TO authenticated;

-- App antigo ("Comi" pela refeição de sempre): acha o bloco pela categoria. Se houver dois blocos
-- dessa categoria no dia, pede atualização em vez de adivinhar.
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
  v_meals jsonb;
  v_meal jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_entries, '[]'::jsonb)) > 30 THEN
    RAISE EXCEPTION 'invalid_entries';
  END IF;
  SELECT coalesce(jsonb_agg(m), '[]'::jsonb) INTO v_meals
  FROM meal_plan_versions ver, jsonb_array_elements(ver.content->'meals') m
  WHERE ver.id = public.plan_version_on(p_plan, p_date)
    AND m->>'category' = p_meal AND (m->'days') @> to_jsonb(public.plan_day_of(p_date));
  IF jsonb_array_length(v_meals) > 1 THEN
    RAISE EXCEPTION 'app_outdated';
  END IF;
  -- Nenhum bloco dessa categoria na versão do dia: o gatilho usa o bloco da categoria no plano.
  v_meal := v_meals->0;

  INSERT INTO meal_plan_checks (client_id, plan_id, check_date, meal, meal_id, meal_name, status, chosen, note)
  VALUES (auth.uid(), p_plan, p_date, p_meal, (v_meal->>'id')::uuid, left(v_meal->>'name', 60), p_status,
          coalesce(p_chosen, '[]'::jsonb), left(coalesce(p_note, ''), 300))
  ON CONFLICT (client_id, plan_id, check_date, meal_id)
  DO UPDATE SET status = EXCLUDED.status, chosen = EXCLUDED.chosen, note = EXCLUDED.note
  RETURNING * INTO v;

  DELETE FROM nutrition_log_entries WHERE plan_check_id = v.id;

  IF p_status = 'ate' THEN
    INSERT INTO nutrition_log_entries (user_id, entry_date, recipe_id, recipe_title, servings, per_serving,
                                       meal, meal_id, meal_name, plan_check_id)
    SELECT auth.uid(), p_date, nullif(e->>'recipe_id', '')::uuid, left(coalesce(e->>'title', ''), 200),
           greatest(least(coalesce((e->>'servings')::numeric, 1), 20), 0.1), coalesce(e->'per_serving', '{}'::jsonb),
           p_meal, v.meal_id, v.meal_name, v.id
    FROM jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) AS e;
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.plan_day_of(date) FROM public, anon;
REVOKE ALL ON FUNCTION public.clean_day_overrides(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.default_meal_name(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.plan_day_of(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clean_day_overrides(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_meal_name(text) TO authenticated;

-- 10) Modelos guardam os blocos --------------------------------------------------------------------
-- Ao aplicar, o app cria ids novos para blocos e itens (nada é compartilhado com a origem).
ALTER TABLE meal_plan_templates
  ADD COLUMN IF NOT EXISTS meals jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(meals) = 'array' AND jsonb_array_length(meals) <= 40);
