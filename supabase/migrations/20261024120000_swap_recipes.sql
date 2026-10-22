/*
  # Trocas também por receita

  Antes o paciente só podia pedir (e o nutricionista só podia oferecer) um alimento do catálogo.
  Agora cada lado escolhe um alimento (com gramas) OU uma receita do site (com porções).

  - food_swap_requests ganha requested_recipe_id/requested_servings e counter_recipe_id/counter_servings.
  - request_food_swap e resolve_food_swap ganham os parâmetros de receita (assinaturas novas;
    as antigas são removidas).
  - apply_swap_to_plan passa a gravar alimento ou receita no item do plano.
  - O aviso "swap_answered" considera oferta de receita.
*/

ALTER TABLE food_swap_requests
  ADD COLUMN IF NOT EXISTS requested_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_servings numeric(4,1) CHECK (requested_servings IS NULL OR (requested_servings > 0 AND requested_servings <= 20)),
  ADD COLUMN IF NOT EXISTS counter_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counter_servings numeric(4,1) CHECK (counter_servings IS NULL OR (counter_servings > 0 AND counter_servings <= 20));

-- A regra "precisa de alimento ou motivo" passa a aceitar receita também.
DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.food_swap_requests'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%requested_food_id IS NOT NULL%'
  LOOP
    EXECUTE format('ALTER TABLE food_swap_requests DROP CONSTRAINT %I', v_name);
  END LOOP;
END;
$$;

ALTER TABLE food_swap_requests DROP CONSTRAINT IF EXISTS swap_has_request;
ALTER TABLE food_swap_requests ADD CONSTRAINT swap_has_request
  CHECK (requested_food_id IS NOT NULL OR requested_recipe_id IS NOT NULL OR char_length(reason) > 0);

ALTER TABLE food_swap_requests DROP CONSTRAINT IF EXISTS swap_one_requested;
ALTER TABLE food_swap_requests ADD CONSTRAINT swap_one_requested
  CHECK (requested_food_id IS NULL OR requested_recipe_id IS NULL);

ALTER TABLE food_swap_requests DROP CONSTRAINT IF EXISTS swap_one_counter;
ALTER TABLE food_swap_requests ADD CONSTRAINT swap_one_counter
  CHECK (counter_food_id IS NULL OR counter_recipe_id IS NULL);

-- Grava no item do plano o alimento (gramas + rótulo) ou a receita (porções).
DROP FUNCTION IF EXISTS public.apply_swap_to_plan(food_swap_requests, uuid, numeric, text);
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
    AND i.day = p_request.day
    AND i.meal = p_request.meal
    AND i.option_group IS NOT DISTINCT FROM p_request.option_group
    AND (i.recipe_id = p_request.original_recipe_id OR i.food_id = p_request.original_food_id)
  ORDER BY i.created_at
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

  UPDATE meal_plans SET updated_at = now() WHERE id = p_request.plan_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_swap_to_plan(food_swap_requests, uuid, numeric, text, uuid, numeric) FROM public, anon, authenticated;

-- Paciente: pede a troca (alimento OU receita, opcional, e o motivo).
DROP FUNCTION IF EXISTS public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, text);
CREATE OR REPLACE FUNCTION public.request_food_swap(
  p_plan uuid, p_day smallint, p_meal text, p_option_group smallint,
  p_original_recipe uuid, p_original_food uuid, p_original_label text,
  p_requested_food uuid, p_requested_grams numeric, p_requested_label text,
  p_requested_recipe uuid, p_requested_servings numeric, p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan meal_plans;
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
  IF EXISTS (
    SELECT 1 FROM food_swap_requests
    WHERE plan_id = p_plan AND day = p_day AND meal = p_meal AND status = 'pending'
      AND option_group IS NOT DISTINCT FROM p_option_group
      AND (original_recipe_id = p_original_recipe OR original_food_id = p_original_food)
  ) THEN
    RAISE EXCEPTION 'already_pending';
  END IF;

  INSERT INTO food_swap_requests (
    plan_id, client_id, nutritionist_id, day, meal, option_group,
    original_recipe_id, original_food_id, original_label,
    requested_food_id, requested_grams, requested_label,
    requested_recipe_id, requested_servings, reason
  ) VALUES (
    p_plan, auth.uid(), v_plan.created_by, p_day, p_meal, p_option_group,
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

-- Nutricionista: aprova (aplica o pedido) ou recusa, podendo oferecer outro alimento OU receita,
-- que entra no plano direto. Devolve true se o plano foi alterado.
DROP FUNCTION IF EXISTS public.resolve_food_swap(uuid, boolean, text, uuid, numeric, text);
CREATE OR REPLACE FUNCTION public.resolve_food_swap(
  p_request uuid, p_approve boolean, p_note text,
  p_counter_food uuid, p_counter_grams numeric, p_counter_label text,
  p_counter_recipe uuid, p_counter_servings numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req food_swap_requests;
  v_applied boolean := false;
  v_offer boolean := false;
BEGIN
  SELECT * INTO v_req FROM food_swap_requests WHERE id = p_request FOR UPDATE;
  IF v_req.id IS NULL OR v_req.nutritionist_id <> auth.uid() OR v_req.status <> 'pending'
     OR NOT public.is_my_patient(v_req.client_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_approve THEN
    IF v_req.requested_food_id IS NULL AND v_req.requested_recipe_id IS NULL THEN
      RAISE EXCEPTION 'nothing_to_apply';
    END IF;
    v_applied := public.apply_swap_to_plan(
      v_req, v_req.requested_food_id, v_req.requested_grams, v_req.requested_label,
      v_req.requested_recipe_id, v_req.requested_servings);
  ELSIF p_counter_food IS NOT NULL AND p_counter_recipe IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_request';
  ELSIF p_counter_food IS NOT NULL THEN
    IF p_counter_grams IS NULL OR p_counter_grams <= 0 OR NOT EXISTS (
      SELECT 1 FROM foods WHERE id = p_counter_food AND (owner_id IS NULL OR owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'invalid_food';
    END IF;
    v_offer := true;
    v_applied := public.apply_swap_to_plan(v_req, p_counter_food, p_counter_grams, p_counter_label, NULL, NULL);
  ELSIF p_counter_recipe IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM recipes WHERE id = p_counter_recipe)
       OR coalesce(p_counter_servings, 1) <= 0 OR coalesce(p_counter_servings, 1) > 20 THEN
      RAISE EXCEPTION 'invalid_recipe';
    END IF;
    v_offer := true;
    v_applied := public.apply_swap_to_plan(v_req, NULL, NULL, NULL, p_counter_recipe, coalesce(p_counter_servings, 1));
  END IF;

  UPDATE food_swap_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      response_note = left(coalesce(p_note, ''), 500),
      counter_food_id = CASE WHEN v_offer THEN p_counter_food END,
      counter_grams = CASE WHEN v_offer AND p_counter_food IS NOT NULL THEN p_counter_grams END,
      counter_label = CASE WHEN v_offer AND p_counter_food IS NOT NULL THEN left(p_counter_label, 200) END,
      counter_recipe_id = CASE WHEN v_offer THEN p_counter_recipe END,
      counter_servings = CASE WHEN v_offer AND p_counter_recipe IS NOT NULL THEN coalesce(p_counter_servings, 1) END,
      applied = v_applied,
      resolved_at = now()
  WHERE id = p_request;

  RETURN v_applied;
END;
$$;

REVOKE ALL ON FUNCTION public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, uuid, numeric, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.resolve_food_swap(uuid, boolean, text, uuid, numeric, text, uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_food_swap(uuid, boolean, text, uuid, numeric, text, uuid, numeric) TO authenticated;

-- Aviso ao paciente: "ofereceu outra opção" vale para alimento ou receita.
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
  END IF;
  RETURN NEW;
END;
$$;
