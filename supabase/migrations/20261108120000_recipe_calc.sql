/*
  Etapa 5 do plano de implementação (REC B): valores da receita calculados pelos ingredientes.

  - Cada ingrediente pode ter os gramas equivalentes (grams) e a medida caseira usada
    (measure_label). Medida caseira só vira grama pela medida daquele alimento (o app escolhe na
    lista do alimento); nunca por uma constante universal (ml não vira g, "xícara" não tem peso fixo).
  - excluded: o autor decidiu que a linha não entra na conta ("sal a gosto", água). Sem essa decisão,
    linha sem alimento ou sem gramas deixa o cálculo parcial e aparece como pendente.
  - Com nutrition_source = 'ingredients', save_recipe calcula aqui: nutrientes do ingrediente =
    nutrientes por 100 g do alimento × gramas ÷ 100; a soma é da receita inteira e a porção é a soma
    ÷ rendimento (rendimento obrigatório). Cada linha guarda o que somou (line_nutrients), então o
    total é reproduzível mesmo que o alimento mude ou seja apagado depois. Situação: "complete" ou
    "partial" (nunca completa com linha pendente; ausente não vira zero).
  - Valores informados à mão substituem o cálculo (não somam). Se ingredientes ou rendimento mudam e
    o autor não confirma os valores manuais, a receita fica "precisa de revisão"
    (nutrition_needs_review) e sai do ajuste automático até alguém revisar.
*/

-- 0) Versão mínima do app --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_min_client()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 5 $$;
REVOKE ALL ON FUNCTION public.app_min_client() FROM public;
GRANT EXECUTE ON FUNCTION public.app_min_client() TO anon, authenticated;

-- 1) Colunas novas ---------------------------------------------------------------------------------
ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS grams numeric CHECK (grams IS NULL OR (grams > 0 AND grams <= 100000)),
  ADD COLUMN IF NOT EXISTS measure_label text CHECK (measure_label IS NULL OR char_length(measure_label) BETWEEN 1 AND 80),
  ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS line_nutrients jsonb;

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS nutrition_needs_review boolean NOT NULL DEFAULT false;

-- 2) Gravação direta (apps antigos): valores mandados por eles são declarados à mão, por porção ------
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
    IF NEW.nutrition_source = 'ingredients' THEN
      NEW.nutrition_source := 'manual';
    END IF;
    NEW.nutrition_needs_review := false;
  END IF;

  -- Só refaz a conta quando algo dela mudou: outras gravações (nota, ocultar) não mexem nos valores.
  IF TG_OP = 'INSERT'
     OR NEW.nutrition_declared IS DISTINCT FROM OLD.nutrition_declared
     OR NEW.nutrition_basis IS DISTINCT FROM OLD.nutrition_basis
     OR NEW.nutrition_source IS DISTINCT FROM OLD.nutrition_source
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
       OR NEW.nutrition_basis IS DISTINCT FROM OLD.nutrition_basis
       OR NEW.nutrition_source IS DISTINCT FROM OLD.nutrition_source THEN
      NEW.nutrition_reviewed_by := auth.uid();
      NEW.nutrition_reviewed_at := now();
    END IF;
    IF NEW.nutrition_facts IS DISTINCT FROM OLD.nutrition_facts
       OR NEW.ingredients IS DISTINCT FROM OLD.ingredients
       OR NEW.yield_servings IS DISTINCT FROM OLD.yield_servings
       OR NEW.serving_weight_g IS DISTINCT FROM OLD.serving_weight_g
       OR NEW.final_weight_g IS DISTINCT FROM OLD.final_weight_g
       OR NEW.serving_label IS DISTINCT FROM OLD.serving_label
       OR NEW.nutrition_basis IS DISTINCT FROM OLD.nutrition_basis
       OR NEW.nutrition_source IS DISTINCT FROM OLD.nutrition_source
       OR NEW.nutrition_status IS DISTINCT FROM OLD.nutrition_status THEN
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

-- 3) Contribuição de um ingrediente: nutrientes por 100 g × gramas ÷ 100 (2 casas) ----------------
CREATE OR REPLACE FUNCTION public.ingredient_nutrients(p_food uuid, p_grams numeric)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'calories', round(f.kcal * p_grams / 100, 2),
    'protein', round(f.protein * p_grams / 100, 2),
    'carbs', round(f.carbs * p_grams / 100, 2),
    'fat', round(f.fat * p_grams / 100, 2),
    'fiber', round(f.fiber * p_grams / 100, 2))
  FROM foods f
  WHERE f.id = p_food AND p_grams > 0;
$$;
REVOKE ALL ON FUNCTION public.ingredient_nutrients(uuid, numeric) FROM public, anon, authenticated;

-- 4) Gravação da receita ---------------------------------------------------------------------------
/*
  save_recipe(p_recipe, p_data, p_ingredients, p_operation): como na etapa 4, mais:
  - p_data.nutrition_source: 'manual' (padrão) ou 'ingredients' (calcula aqui; exige rendimento e
    ignora p_data.nutrition e a base enviada).
  - p_data.confirm_manual: true quando o autor confirmou que os valores manuais continuam certos
    depois de mudar ingredientes ou rendimento.
  - Ingredientes: { id?, text, food_id?, quantity?, unit?, note?, grams?, measure_label?, excluded? }.
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
  v_source text := coalesce(p_data ->> 'nutrition_source', 'manual');
  v_basis text := coalesce(p_data ->> 'nutrition_basis', 'per_serving');
  v_declared jsonb;
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
  v_grams numeric;
  v_excluded boolean;
  v_line jsonb;
  v_text text;
  v_old_rows text;
  v_new_rows text;
  v_missing integer := 0;
  v_counted integer := 0;
  v_status text;
  v_review boolean := false;
  v_rows jsonb := '[]'::jsonb;
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
  IF char_length(v_title) NOT BETWEEN 1 AND 200 OR v_source NOT IN ('manual', 'ingredients') THEN
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
  -- Calculado: a soma é da receita inteira, então o rendimento é obrigatório.
  IF v_source = 'ingredients' THEN
    v_basis := 'whole_recipe';
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

  -- Validação das linhas e o texto para o formato antigo.
  FOR v_ing IN SELECT value FROM jsonb_array_elements(p_ingredients) LOOP
    v_text := btrim(coalesce(v_ing ->> 'text', ''));
    IF char_length(v_text) NOT BETWEEN 1 AND 300 THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
    v_lines := v_lines || to_jsonb(v_text);
  END LOOP;

  IF v_id IS NOT NULL THEN
    SELECT string_agg(concat_ws('|', text, food_id, grams, excluded), E'
' ORDER BY position) INTO v_old_rows
    FROM recipe_ingredients WHERE recipe_id = v_id;
  END IF;

  -- Linhas como serão gravadas, com o que cada uma soma (calculado antes de gravar a receita).
  FOR v_ing IN SELECT value FROM jsonb_array_elements(p_ingredients) LOOP
    v_food := nullif(v_ing ->> 'food_id', '')::uuid;
    IF v_food IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM foods f WHERE f.id = v_food AND (f.owner_id IS NULL OR f.owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
    BEGIN
      v_qty := nullif(btrim(v_ing ->> 'quantity'), '')::numeric;
      v_grams := nullif(btrim(v_ing ->> 'grams'), '')::numeric;
      v_ing_id := nullif(v_ing ->> 'id', '')::uuid;
      v_excluded := coalesce((v_ing ->> 'excluded')::boolean, false);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'validation_failed';
    END;
    IF v_grams IS NOT NULL AND NOT (v_grams > 0 AND v_grams <= 100000) THEN
      RAISE EXCEPTION 'validation_failed';
    END IF;
    -- O id que o app manda é mantido, desde que não seja de linha de outra receita.
    IF v_ing_id IS NULL OR EXISTS (SELECT 1 FROM recipe_ingredients WHERE id = v_ing_id AND recipe_id IS DISTINCT FROM v_id) THEN
      v_ing_id := gen_random_uuid();
    END IF;
    v_line := CASE WHEN v_excluded OR v_food IS NULL OR v_grams IS NULL THEN NULL
                   ELSE public.ingredient_nutrients(v_food, v_grams) END;
    IF NOT v_excluded THEN
      IF v_line IS NULL THEN v_missing := v_missing + 1; ELSE v_counted := v_counted + 1; END IF;
    END IF;
    v_rows := v_rows || jsonb_build_object(
      'id', v_ing_id, 'position', v_pos, 'text', btrim(v_ing ->> 'text'), 'food_id', v_food, 'quantity', v_qty,
      'unit', nullif(btrim(coalesce(v_ing ->> 'unit', '')), ''), 'note', btrim(coalesce(v_ing ->> 'note', '')),
      'grams', v_grams, 'measure_label', nullif(btrim(coalesce(v_ing ->> 'measure_label', '')), ''),
      'excluded', v_excluded, 'line', v_line);
    v_pos := v_pos + 1;
  END LOOP;

  SELECT string_agg(concat_ws('|', r ->> 'text', r ->> 'food_id', (r ->> 'grams')::numeric, (r ->> 'excluded')::boolean),
                    E'
' ORDER BY (r ->> 'position')::int) INTO v_new_rows
  FROM jsonb_array_elements(v_rows) r;

  IF v_source = 'ingredients' THEN
    -- Soma das linhas contadas; linha pendente deixa parcial (o que falta não vira zero).
    SELECT coalesce(jsonb_object_agg(k, s), '{}'::jsonb) INTO v_declared
    FROM (SELECT e.key AS k, round(sum(e.value::numeric), 2) AS s
          FROM jsonb_array_elements(v_rows) r, jsonb_each(r -> 'line') e
          WHERE jsonb_typeof(r -> 'line') = 'object'
          GROUP BY e.key) t;
    v_status := CASE WHEN v_counted = 0 THEN 'unknown' WHEN v_missing = 0 THEN 'complete' ELSE 'partial' END;
  ELSE
    v_declared := public.recipe_clean_nutrients(p_data -> 'nutrition', true);
    -- Valores à mão com ingredientes ou rendimento mudados: precisam de revisão, a menos que o
    -- autor tenha confirmado ou mudado os próprios valores agora.
    IF p_recipe IS NOT NULL AND v_old.nutrition_source IN ('manual', 'legacy')
       AND (v_old_rows IS DISTINCT FROM v_new_rows OR v_old.yield_servings IS DISTINCT FROM v_yield OR v_old.nutrition_needs_review)
       AND NOT coalesce((p_data ->> 'confirm_manual')::boolean, false)
       AND v_declared = v_old.nutrition_declared AND v_basis = v_old.nutrition_basis THEN
      v_review := true;
    END IF;
  END IF;

  PERFORM set_config('app.recipe_save', 'on', true);

  IF v_id IS NULL THEN
    INSERT INTO recipes (title, description, image, prep_time, difficulty, category, ingredients, instructions,
                         nutrition_facts, author_id, yield_servings, final_weight_g, serving_weight_g, serving_label,
                         nutrition_declared, nutrition_basis, nutrition_source, nutrition_status)
    VALUES (v_title, coalesce(p_data ->> 'description', ''), coalesce(p_data ->> 'image', ''),
            coalesce((p_data ->> 'prep_time')::integer, 30), coalesce(p_data ->> 'difficulty', 'medium'),
            coalesce(p_data ->> 'category', ''), v_lines, v_instructions, '{}'::jsonb, auth.uid(),
            v_yield, v_final, v_serving, left(btrim(coalesce(p_data ->> 'serving_label', '')), 80),
            v_declared, v_basis, v_source, coalesce(v_status, 'unknown'))
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
      nutrition_declared = v_declared,
      nutrition_basis = v_basis,
      nutrition_source = CASE WHEN v_basis = 'legacy_unit' THEN 'legacy' ELSE v_source END,
      nutrition_status = coalesce(v_status, nutrition_status),
      nutrition_needs_review = v_review,
      updated_at = now()
    WHERE id = v_id;
  END IF;

  DELETE FROM recipe_ingredients WHERE recipe_id = v_id;
  INSERT INTO recipe_ingredients (id, recipe_id, position, text, food_id, quantity, unit, note, grams, measure_label, excluded, line_nutrients)
  SELECT (r ->> 'id')::uuid, v_id, (r ->> 'position')::int, r ->> 'text', nullif(r ->> 'food_id', '')::uuid,
         (r ->> 'quantity')::numeric, r ->> 'unit', r ->> 'note', (r ->> 'grams')::numeric, r ->> 'measure_label',
         (r ->> 'excluded')::boolean, CASE WHEN jsonb_typeof(r -> 'line') = 'object' THEN r -> 'line' END
  FROM jsonb_array_elements(v_rows) r;

  PERFORM set_config('app.recipe_save', '', true);
  RETURN public.op_finish(p_operation, jsonb_build_object('recipe_id', v_id, 'status',
    (SELECT nutrition_status FROM recipes WHERE id = v_id), 'missing', v_missing));
END;
$$;
REVOKE ALL ON FUNCTION public.save_recipe(uuid, jsonb, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_recipe(uuid, jsonb, jsonb, uuid) TO authenticated;
