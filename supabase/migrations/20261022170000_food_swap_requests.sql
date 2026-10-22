/*
  # Pedidos de troca de item do plano alimentar

  - O paciente pede para trocar um item de um plano feito pelo nutricionista: diz o que gostaria
    (um alimento do catálogo, opcional) e por quê.
  - O nutricionista aprova (o alimento pedido entra no plano no lugar do original) ou recusa
    (com observação e, se quiser, oferecendo outro alimento, que entra no plano direto).
  - Como os itens do plano são regravados a cada edição, o pedido guarda a "posição" do item
    (dia, refeição, grupo de opções e o que havia lá) e uma descrição para exibir mesmo que o plano mude.
  - Escrita só pelas funções abaixo (SECURITY DEFINER), que conferem quem é quem; não há policy de
    INSERT/UPDATE direto na tabela.
*/

CREATE TABLE IF NOT EXISTS food_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day smallint NOT NULL CHECK (day BETWEEN 0 AND 6),
  meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'snack', 'dinner')),
  option_group smallint,
  original_recipe_id uuid,
  original_food_id uuid,
  original_label text NOT NULL CHECK (char_length(original_label) BETWEEN 1 AND 200),
  requested_food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  requested_grams numeric(7,1) CHECK (requested_grams IS NULL OR requested_grams > 0),
  requested_label text CHECK (requested_label IS NULL OR char_length(requested_label) <= 200),
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  response_note text NOT NULL DEFAULT '' CHECK (char_length(response_note) <= 500),
  counter_food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  counter_grams numeric(7,1) CHECK (counter_grams IS NULL OR counter_grams > 0),
  counter_label text CHECK (counter_label IS NULL OR char_length(counter_label) <= 200),
  -- false quando o item já não existia no plano na hora da resposta (plano editado depois do pedido).
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((original_recipe_id IS NULL) <> (original_food_id IS NULL)),
  CHECK (requested_food_id IS NOT NULL OR char_length(reason) > 0)
);

CREATE INDEX IF NOT EXISTS idx_swaps_nutritionist_status ON food_swap_requests(nutritionist_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_client ON food_swap_requests(client_id, created_at DESC);

ALTER TABLE food_swap_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own swap requests" ON food_swap_requests;
CREATE POLICY "View own swap requests"
  ON food_swap_requests FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR (nutritionist_id = auth.uid() AND public.is_my_patient(client_id)));

-- Troca o item da posição guardada no pedido; devolve true se achou o item.
CREATE OR REPLACE FUNCTION public.apply_swap_to_plan(
  p_request food_swap_requests, p_food uuid, p_grams numeric, p_label text
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

  UPDATE meal_plan_items
  SET recipe_id = NULL, food_id = p_food, grams = p_grams, servings = 1,
      measure_label = left(p_label, 120)
  WHERE id = v_item;

  UPDATE meal_plans SET updated_at = now() WHERE id = p_request.plan_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_swap_to_plan(food_swap_requests, uuid, numeric, text) FROM public, anon, authenticated;

-- Paciente: cria o pedido para um item de um plano que o nutricionista fez para ele.
CREATE OR REPLACE FUNCTION public.request_food_swap(
  p_plan uuid, p_day smallint, p_meal text, p_option_group smallint,
  p_original_recipe uuid, p_original_food uuid, p_original_label text,
  p_requested_food uuid, p_requested_grams numeric, p_requested_label text, p_reason text
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
  -- Só com acompanhamento ativo.
  IF NOT EXISTS (
    SELECT 1 FROM nutritionist_clients
    WHERE nutritionist_id = v_plan.created_by AND client_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  -- O alimento pedido precisa ser visível para o paciente (TACO ou do próprio nutricionista).
  IF p_requested_food IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM foods WHERE id = p_requested_food AND (owner_id IS NULL OR owner_id = v_plan.created_by)
  ) THEN
    RAISE EXCEPTION 'invalid_food';
  END IF;
  -- Um pedido aberto por item.
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
    requested_food_id, requested_grams, requested_label, reason
  ) VALUES (
    p_plan, auth.uid(), v_plan.created_by, p_day, p_meal, p_option_group,
    p_original_recipe, p_original_food, left(p_original_label, 200),
    p_requested_food, CASE WHEN p_requested_food IS NULL THEN NULL ELSE p_requested_grams END,
    CASE WHEN p_requested_food IS NULL THEN NULL ELSE left(p_requested_label, 200) END,
    left(coalesce(p_reason, ''), 500)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Paciente: cancela um pedido ainda aberto.
CREATE OR REPLACE FUNCTION public.cancel_food_swap(p_request uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE food_swap_requests
  SET status = 'canceled', resolved_at = now()
  WHERE id = p_request AND client_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
END;
$$;

-- Nutricionista: aprova (aplica o pedido) ou recusa (com nota e, opcionalmente, outro alimento,
-- que entra no plano direto). Devolve true se o plano foi alterado.
CREATE OR REPLACE FUNCTION public.resolve_food_swap(
  p_request uuid, p_approve boolean, p_note text,
  p_counter_food uuid, p_counter_grams numeric, p_counter_label text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req food_swap_requests;
  v_applied boolean := false;
BEGIN
  SELECT * INTO v_req FROM food_swap_requests WHERE id = p_request FOR UPDATE;
  IF v_req.id IS NULL OR v_req.nutritionist_id <> auth.uid() OR v_req.status <> 'pending'
     OR NOT public.is_my_patient(v_req.client_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_approve THEN
    IF v_req.requested_food_id IS NULL THEN
      RAISE EXCEPTION 'nothing_to_apply';
    END IF;
    v_applied := public.apply_swap_to_plan(v_req, v_req.requested_food_id, v_req.requested_grams, v_req.requested_label);
  ELSIF p_counter_food IS NOT NULL THEN
    IF p_counter_grams IS NULL OR p_counter_grams <= 0 OR NOT EXISTS (
      SELECT 1 FROM foods WHERE id = p_counter_food AND (owner_id IS NULL OR owner_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'invalid_food';
    END IF;
    v_applied := public.apply_swap_to_plan(v_req, p_counter_food, p_counter_grams, p_counter_label);
  END IF;

  UPDATE food_swap_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      response_note = left(coalesce(p_note, ''), 500),
      counter_food_id = CASE WHEN p_approve THEN NULL ELSE p_counter_food END,
      counter_grams = CASE WHEN p_approve OR p_counter_food IS NULL THEN NULL ELSE p_counter_grams END,
      counter_label = CASE WHEN p_approve OR p_counter_food IS NULL THEN NULL ELSE left(p_counter_label, 200) END,
      applied = v_applied,
      resolved_at = now()
  WHERE id = p_request;

  RETURN v_applied;
END;
$$;

REVOKE ALL ON FUNCTION public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_food_swap(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.resolve_food_swap(uuid, boolean, text, uuid, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_food_swap(uuid, smallint, text, smallint, uuid, uuid, text, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_food_swap(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_food_swap(uuid, boolean, text, uuid, numeric, text) TO authenticated;
