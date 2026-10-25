/*
  Etapa 4 do plano de implementação (REC A): rendimento, porção e ingredientes flexíveis.

  - A receita passa a dizer quanto rende (yield_servings, final_weight_g), o que é uma porção
    (serving_label, serving_weight_g) e em que base o autor declarou os nutrientes
    (nutrition_basis): por porção ou da receita inteira. Rendimento zero, negativo, infinito ou
    inválido é recusado aqui também, não só na tela.
  - nutrition_declared guarda os valores como o autor escreveu. nutrition_facts continua sendo o
    valor de UMA porção (o que plano, diário, IA, PDF e apps antigos já leem), calculado aqui por um
    único caminho: recipe_per_serving(). Nutriente não informado fica ausente (desconhecido), nunca
    vira zero.
  - Receitas que já existem ficam com base "legacy_unit": os valores continuam exatamente como estão
    (sem dividir pelo rendimento) até o autor revisar e escolher a base. Totais de planos e do
    diário não mudam.
  - Ingredientes ganham linhas estruturadas (recipe_ingredients): texto original, alimento do
    catálogo opcional (TACO ou alimento próprio do autor), quantidade, unidade e observação.
    Ingrediente fora do catálogo é salvo como texto. recipes.ingredients continua com as linhas em
    texto para quem lê o formato antigo (busca, lista de compras, apps abertos).
  - Alimento privado não fica visível por estar numa receita pública: a linha mostra o texto do
    autor e o RLS de foods continua o mesmo.
  - Gravação pela RPC save_recipe (tudo ou nada, repetível). Apps antigos que gravam direto na
    tabela continuam funcionando: os valores que eles mandam são por porção e as linhas de texto
    viram ingredientes livres.
*/

-- 0) Versão mínima do app --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_min_client()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 4 $$;
REVOKE ALL ON FUNCTION public.app_min_client() FROM public;
GRANT EXECUTE ON FUNCTION public.app_min_client() TO anon, authenticated;

-- 1) Rendimento, porção e base dos nutrientes -----------------------------------------------------
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS yield_servings numeric,
  ADD COLUMN IF NOT EXISTS final_weight_g numeric,
  ADD COLUMN IF NOT EXISTS serving_weight_g numeric,
  ADD COLUMN IF NOT EXISTS serving_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nutrition_declared jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS nutrition_basis text NOT NULL DEFAULT 'legacy_unit',
  ADD COLUMN IF NOT EXISTS nutrition_source text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS nutrition_status text NOT NULL DEFAULT 'manual_declared',
  ADD COLUMN IF NOT EXISTS nutrition_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nutrition_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipe_version integer NOT NULL DEFAULT 1;


ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_yield_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_yield_check CHECK (
  (yield_servings IS NULL OR (yield_servings > 0 AND yield_servings <= 1000))
  AND (final_weight_g IS NULL OR (final_weight_g > 0 AND final_weight_g <= 100000))
  AND (serving_weight_g IS NULL OR (serving_weight_g > 0 AND serving_weight_g <= 100000))
  AND char_length(serving_label) <= 80
);
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_nutrition_basis_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_nutrition_basis_check CHECK (
  nutrition_basis IN ('per_serving', 'whole_recipe', 'legacy_unit')
  AND nutrition_source IN ('manual', 'ingredients', 'legacy')
  AND nutrition_status IN ('complete', 'partial', 'unknown', 'manual_declared')
  -- Valores da receita inteira só viram porção com rendimento conhecido.
  AND (nutrition_basis <> 'whole_recipe' OR yield_servings IS NOT NULL)
  -- A base antiga é só das receitas que ninguém revisou.
  AND ((nutrition_basis = 'legacy_unit') = (nutrition_source = 'legacy'))
);

/*
  O único conversor para "uma porção". Valores da receita inteira são divididos pelo rendimento;
  os demais ficam como estão. Chave ausente continua ausente (desconhecido). O app repete esta conta
  só para mostrar a prévia no formulário (src/lib/recipe-nutrition.ts).
*/
CREATE OR REPLACE FUNCTION public.recipe_per_serving(p_declared jsonb, p_basis text, p_yield numeric)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT coalesce(jsonb_object_agg(e.key,
           CASE WHEN p_basis = 'whole_recipe' THEN round(e.value::numeric / p_yield, 2) ELSE e.value::numeric END),
         '{}'::jsonb)
  FROM jsonb_each(coalesce(p_declared, '{}'::jsonb)) e
  WHERE e.key IN ('calories', 'protein', 'carbs', 'fat', 'fiber')
    AND jsonb_typeof(e.value) = 'number'
    AND (p_basis <> 'whole_recipe' OR p_yield > 0);
$$;

/*
  Nutrientes como o autor escreveu: só as cinco chaves, número entre 0 e 100000; vazio =
  desconhecido. p_strict (gravação pela tela): valor inválido é recusado. Sem p_strict (dados
  antigos): o valor inválido é ignorado, para nunca travar outra gravação da receita.
*/
CREATE OR REPLACE FUNCTION public.recipe_clean_nutrients(p_raw jsonb, p_strict boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
  v_key text;
  v_text text;
  v_num numeric;
BEGIN
  IF p_raw IS NULL OR jsonb_typeof(p_raw) = 'null' THEN
    RETURN v_out;
  END IF;
  IF jsonb_typeof(p_raw) <> 'object' THEN
    IF p_strict THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
    RETURN v_out;
  END IF;
  FOREACH v_key IN ARRAY ARRAY['calories', 'protein', 'carbs', 'fat', 'fiber'] LOOP
    v_text := p_raw ->> v_key;
    CONTINUE WHEN v_text IS NULL OR btrim(v_text) = '';
    BEGIN
      v_num := v_text::numeric;
    EXCEPTION WHEN others THEN
      v_num := NULL;
    END;
    IF v_num IS NULL OR NOT (v_num >= 0 AND v_num <= 100000) THEN
      IF p_strict THEN
        RAISE EXCEPTION 'validation_failed';
      END IF;
      CONTINUE;
    END IF;
    v_out := v_out || jsonb_build_object(v_key, v_num);
  END LOOP;
  RETURN v_out;
END;
$$;

-- Receitas existentes: o que estava escrito é o declarado, na base antiga. nutrition_facts não é
-- recalculado (os totais de planos e do diário ficam iguais).
UPDATE recipes r SET
  nutrition_declared = c.declared,
  nutrition_status = CASE (SELECT count(*) FROM jsonb_object_keys(c.declared))
                       WHEN 5 THEN 'manual_declared' WHEN 0 THEN 'unknown' ELSE 'partial' END
FROM (SELECT id, public.recipe_clean_nutrients(nutrition_facts) AS declared FROM recipes) c
WHERE c.id = r.id AND r.nutrition_source = 'legacy';

/*
  Mantém nutrition_facts (uma porção), a situação dos dados, quem revisou e a versão da receita.
  Gravação direta na tabela (apps antigos, que só conhecem "valores por porção"): o que mandarem em
  nutrition_facts passa a ser o declarado por porção.
*/
CREATE OR REPLACE FUNCTION public.recipe_nutrition_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF coalesce(current_setting('app.recipe_save', true), '') <> 'on'
     AND (TG_OP = 'INSERT' OR NEW.nutrition_facts IS DISTINCT FROM OLD.nutrition_facts) THEN
    NEW.nutrition_declared := public.recipe_clean_nutrients(NEW.nutrition_facts);
    IF NEW.nutrition_basis = 'whole_recipe' THEN
      NEW.nutrition_basis := 'per_serving';
    END IF;
  END IF;

  -- Só refaz a conta quando algo dela mudou: outras gravações (nota, ocultar) não mexem nos valores.
  IF TG_OP = 'INSERT'
     OR NEW.nutrition_declared IS DISTINCT FROM OLD.nutrition_declared
     OR NEW.nutrition_basis IS DISTINCT FROM OLD.nutrition_basis
     OR NEW.yield_servings IS DISTINCT FROM OLD.yield_servings THEN
    NEW.nutrition_declared := public.recipe_clean_nutrients(NEW.nutrition_declared);
    NEW.nutrition_facts := public.recipe_per_serving(NEW.nutrition_declared, NEW.nutrition_basis, NEW.yield_servings);
    IF NEW.nutrition_source <> 'ingredients' THEN
      SELECT count(*) INTO v_count FROM jsonb_object_keys(NEW.nutrition_declared);
      NEW.nutrition_status := CASE WHEN v_count = 5 THEN 'manual_declared' WHEN v_count = 0 THEN 'unknown' ELSE 'partial' END;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.nutrition_declared IS DISTINCT FROM OLD.nutrition_declared
       OR NEW.nutrition_basis IS DISTINCT FROM OLD.nutrition_basis THEN
      NEW.nutrition_reviewed_by := auth.uid();
      NEW.nutrition_reviewed_at := now();
    END IF;
    IF NEW.nutrition_facts IS DISTINCT FROM OLD.nutrition_facts
       OR NEW.ingredients IS DISTINCT FROM OLD.ingredients
       OR NEW.yield_servings IS DISTINCT FROM OLD.yield_servings
       OR NEW.serving_weight_g IS DISTINCT FROM OLD.serving_weight_g
       OR NEW.final_weight_g IS DISTINCT FROM OLD.final_weight_g
       OR NEW.serving_label IS DISTINCT FROM OLD.serving_label
       OR NEW.nutrition_basis IS DISTINCT FROM OLD.nutrition_basis THEN
      NEW.recipe_version := OLD.recipe_version + 1;
    ELSE
      NEW.recipe_version := OLD.recipe_version;
    END IF;
  ELSE
    NEW.recipe_version := 1;
    IF NEW.nutrition_source <> 'legacy' THEN
      NEW.nutrition_reviewed_by := auth.uid();
      NEW.nutrition_reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.recipe_nutrition_sync() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recipe_nutrition_sync ON recipes;
CREATE TRIGGER trg_recipe_nutrition_sync
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION public.recipe_nutrition_sync();

-- 2) Ingredientes estruturados --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position integer NOT NULL,
  -- A linha como o autor escreveu; é o que aparece para quem lê a receita.
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 300),
  -- Alimento do catálogo (opcional). Apagar o alimento não apaga a linha.
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  quantity numeric CHECK (quantity IS NULL OR (quantity > 0 AND quantity <= 100000)),
  unit text CHECK (unit IS NULL OR char_length(unit) BETWEEN 1 AND 30),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id, position);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_food ON recipe_ingredients(food_id) WHERE food_id IS NOT NULL;

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON recipe_ingredients FROM anon, authenticated;
GRANT SELECT ON recipe_ingredients TO anon, authenticated;

-- Quem vê a receita vê as linhas (o RLS de recipes vale aqui dentro, inclusive o do Premium).
DROP POLICY IF EXISTS "Ingredients of visible recipes" ON recipe_ingredients;
CREATE POLICY "Ingredients of visible recipes"
  ON recipe_ingredients FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_ingredients.recipe_id));

-- Linhas em texto viram ingredientes livres (receitas existentes e gravação direta de apps antigos).
CREATE OR REPLACE FUNCTION public.recipe_ingredients_from_lines(p_recipe uuid, p_lines jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe;
  INSERT INTO recipe_ingredients (recipe_id, position, text)
  SELECT p_recipe, l.ord::int - 1, left(btrim(l.value), 300)
  FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_lines) = 'array' THEN p_lines ELSE '[]'::jsonb END)
       WITH ORDINALITY AS l(value, ord)
  WHERE btrim(l.value) <> '';
$$;
REVOKE ALL ON FUNCTION public.recipe_ingredients_from_lines(uuid, jsonb) FROM public, anon, authenticated;

SELECT public.recipe_ingredients_from_lines(r.id, r.ingredients)
FROM recipes r
WHERE NOT EXISTS (SELECT 1 FROM recipe_ingredients i WHERE i.recipe_id = r.id);

CREATE OR REPLACE FUNCTION public.recipe_ingredients_direct_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('app.recipe_save', true), '') <> 'on'
     AND (TG_OP = 'INSERT' OR NEW.ingredients IS DISTINCT FROM OLD.ingredients) THEN
    PERFORM public.recipe_ingredients_from_lines(NEW.id, NEW.ingredients);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recipe_ingredients_direct_sync() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recipe_ingredients_direct_sync ON recipes;
CREATE TRIGGER trg_recipe_ingredients_direct_sync
  AFTER INSERT OR UPDATE OF ingredients ON recipes
  FOR EACH ROW EXECUTE FUNCTION public.recipe_ingredients_direct_sync();

-- 3) Gravação da receita ---------------------------------------------------------------------------
/*
  save_recipe(p_recipe, p_data, p_ingredients, p_operation): cria (p_recipe NULL) ou atualiza uma
  receita do próprio autor, com rendimento, porção, nutrientes declarados e ingredientes, tudo ou
  nada.
  - p_data: { title, description, image, prep_time, difficulty, category, instructions[],
    yield_servings, final_weight_g, serving_weight_g, serving_label, nutrition_basis, nutrition }.
  - p_ingredients: [{ id?, text, food_id?, quantity?, unit?, note? }] (até 100). Alimento só do
    catálogo TACO ou do próprio autor.
  - Rendimento inválido: "invalid_yield". Base "legacy_unit" só para receita que já está nela.
*/
CREATE OR REPLACE FUNCTION public.save_recipe(p_recipe uuid, p_data jsonb, p_ingredients jsonb, p_operation uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_done jsonb;
  v_id uuid := p_recipe;
  v_old recipes;
  v_basis text := coalesce(p_data ->> 'nutrition_basis', 'per_serving');
  v_yield numeric;
  v_final numeric;
  v_serving numeric;
  v_title text := btrim(coalesce(p_data ->> 'title', ''));
  v_instructions jsonb := coalesce(p_data -> 'instructions', '[]'::jsonb);
  v_lines jsonb := '[]'::jsonb;
  v_ing jsonb;
  v_pos integer := 0;
  v_ing_id uuid;
  v_food uuid;
  v_qty numeric;
  v_text text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  v_done := public.op_begin(p_operation, 'save_recipe',
    jsonb_build_object('recipe', p_recipe, 'data', p_data, 'ingredients', p_ingredients));
  IF v_done IS NOT NULL THEN
    RETURN v_done;
  END IF;

  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR jsonb_typeof(p_ingredients) IS DISTINCT FROM 'array'
     OR jsonb_typeof(v_instructions) <> 'array' THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  IF jsonb_array_length(p_ingredients) > 100 OR jsonb_array_length(v_instructions) > 100 THEN
    RAISE EXCEPTION 'limit_exceeded';
  END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;

  BEGIN
    v_yield := nullif(btrim(p_data ->> 'yield_servings'), '')::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_yield';
  END;
  IF v_yield IS NOT NULL AND NOT (v_yield > 0 AND v_yield <= 1000) THEN
    RAISE EXCEPTION 'invalid_yield';
  END IF;
  BEGIN
    v_final := nullif(btrim(p_data ->> 'final_weight_g'), '')::numeric;
    v_serving := nullif(btrim(p_data ->> 'serving_weight_g'), '')::numeric;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'validation_failed';
  END;
  IF (v_final IS NOT NULL AND NOT (v_final > 0 AND v_final <= 100000))
     OR (v_serving IS NOT NULL AND NOT (v_serving > 0 AND v_serving <= 100000)) THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  IF v_basis NOT IN ('per_serving', 'whole_recipe', 'legacy_unit') THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;
  IF v_basis = 'whole_recipe' AND v_yield IS NULL THEN
    RAISE EXCEPTION 'invalid_yield';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM recipes WHERE id = v_id FOR UPDATE;
    IF NOT FOUND OR v_old.author_id <> auth.uid() THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
  END IF;
  IF v_basis = 'legacy_unit' AND (v_id IS NULL OR v_old.nutrition_basis <> 'legacy_unit') THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;

  -- Linhas de texto (para o formato antigo) a partir dos ingredientes.
  FOR v_ing IN SELECT value FROM jsonb_array_elements(p_ingredients) LOOP
    v_text := btrim(coalesce(v_ing ->> 'text', ''));
    IF char_length(v_text) NOT BETWEEN 1 AND 300 THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
    v_lines := v_lines || to_jsonb(v_text);
  END LOOP;

  PERFORM set_config('app.recipe_save', 'on', true);

  IF v_id IS NULL THEN
    INSERT INTO recipes (title, description, image, prep_time, difficulty, category, ingredients, instructions,
                         nutrition_facts, author_id, yield_servings, final_weight_g, serving_weight_g, serving_label,
                         nutrition_declared, nutrition_basis, nutrition_source)
    VALUES (v_title, coalesce(p_data ->> 'description', ''), coalesce(p_data ->> 'image', ''),
            coalesce((p_data ->> 'prep_time')::integer, 30), coalesce(p_data ->> 'difficulty', 'medium'),
            coalesce(p_data ->> 'category', ''), v_lines, v_instructions, '{}'::jsonb, auth.uid(),
            v_yield, v_final, v_serving, left(btrim(coalesce(p_data ->> 'serving_label', '')), 80),
            public.recipe_clean_nutrients(p_data -> 'nutrition', true), v_basis, 'manual')
    RETURNING id INTO v_id;
  ELSE
    UPDATE recipes SET
      title = v_title,
      description = coalesce(p_data ->> 'description', ''),
      image = coalesce(p_data ->> 'image', ''),
      prep_time = coalesce((p_data ->> 'prep_time')::integer, prep_time),
      difficulty = coalesce(p_data ->> 'difficulty', difficulty),
      category = coalesce(p_data ->> 'category', category),
      ingredients = v_lines,
      instructions = v_instructions,
      yield_servings = v_yield,
      final_weight_g = v_final,
      serving_weight_g = v_serving,
      serving_label = left(btrim(coalesce(p_data ->> 'serving_label', '')), 80),
      nutrition_declared = public.recipe_clean_nutrients(p_data -> 'nutrition', true),
      nutrition_basis = v_basis,
      nutrition_source = CASE WHEN v_basis = 'legacy_unit' THEN 'legacy' ELSE 'manual' END,
      updated_at = now()
    WHERE id = v_id;
  END IF;

  DELETE FROM recipe_ingredients WHERE recipe_id = v_id;
  FOR v_ing IN SELECT value FROM jsonb_array_elements(p_ingredients) LOOP
    v_food := nullif(v_ing ->> 'food_id', '')::uuid;
    IF v_food IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM foods f WHERE f.id = v_food AND (f.owner_id IS NULL OR f.owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
    BEGIN
      v_qty := nullif(btrim(v_ing ->> 'quantity'), '')::numeric;
      v_ing_id := nullif(v_ing ->> 'id', '')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'validation_failed';
    END;
    -- O id que o app manda é mantido, desde que não seja de linha de outra receita.
    IF v_ing_id IS NULL OR EXISTS (SELECT 1 FROM recipe_ingredients WHERE id = v_ing_id) THEN
      v_ing_id := gen_random_uuid();
    END IF;
    INSERT INTO recipe_ingredients (id, recipe_id, position, text, food_id, quantity, unit, note)
    VALUES (v_ing_id, v_id, v_pos, btrim(v_ing ->> 'text'), v_food, v_qty,
            nullif(btrim(coalesce(v_ing ->> 'unit', '')), ''), btrim(coalesce(v_ing ->> 'note', '')));
    v_pos := v_pos + 1;
  END LOOP;

  PERFORM set_config('app.recipe_save', '', true);
  RETURN public.op_finish(p_operation, jsonb_build_object('recipe_id', v_id));
END;
$$;
REVOKE ALL ON FUNCTION public.save_recipe(uuid, jsonb, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_recipe(uuid, jsonb, jsonb, uuid) TO authenticated;

-- 4) Retrato da versão do plano: rendimento e base junto da receita --------------------------------
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
               'difficulty', r.difficulty, 'nutrition_facts', r.nutrition_facts, 'ingredients', r.ingredients,
               'yield_servings', r.yield_servings, 'nutrition_basis', r.nutrition_basis,
               'nutrition_status', r.nutrition_status, 'serving_label', r.serving_label,
               'recipe_version', r.recipe_version))
      FROM recipes r
      WHERE r.id IN (SELECT i.recipe_id FROM meal_plan_items i JOIN meal_plan_meals m ON m.id = i.meal_id
                     WHERE i.plan_id = p.id AND i.recipe_id IS NOT NULL AND i.day = ANY (m.days))), '{}'::jsonb)
  )
  FROM meal_plans p WHERE p.id = p_plan;
$$;
REVOKE ALL ON FUNCTION public.plan_snapshot(uuid) FROM public, anon, authenticated;
