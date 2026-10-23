/*
  # Fase 2: consistência dos dados

  1. O paciente não apaga mais o plano do nutricionista durante o acompanhamento ativo. Planos de
     acompanhamentos encerrados (que ele não vê) podem ser contados e apagados por ele.
  2. Marcação de refeição é por plano: com dois planos, marcar num não apaga a do outro.
  3. Ao encerrar o acompanhamento: avisos daquele acompanhamento ficam lidos e o selo "metas
     definidas pelo nutricionista" sai. Recomeçar mantém a data original de início.
  4. Receita apagada: quem tinha ela no plano recebe aviso (plan_item_removed) e os pedidos de
     troca por ela deixam de travar a exclusão.
  5. Excluir a conta do nutricionista não trava mais por alimento próprio usado no plano de alguém:
     os itens saem do plano com aviso.
  6. save_meal_plan(): salvar plano e itens numa transação só (a internet cair no meio não deixa o
     plano vazio).
*/

-- 1) Apagar planos ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Delete meal plans" ON meal_plans;
CREATE POLICY "Delete meal plans"
  ON meal_plans FOR DELETE TO authenticated
  USING (
    (client_id = auth.uid() AND (created_by = auth.uid() OR NOT public.is_my_nutritionist(created_by)))
    OR (created_by = auth.uid() AND public.is_my_patient(client_id))
  );

CREATE OR REPLACE FUNCTION public.my_archived_plans()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::integer FROM meal_plans p
  WHERE p.client_id = auth.uid() AND p.created_by <> auth.uid() AND NOT public.is_my_nutritionist(p.created_by);
$$;

CREATE OR REPLACE FUNCTION public.delete_my_archived_plans()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  DELETE FROM meal_plans p
  WHERE p.client_id = auth.uid() AND p.created_by <> auth.uid() AND NOT public.is_my_nutritionist(p.created_by);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.my_archived_plans() FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_my_archived_plans() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_archived_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_archived_plans() TO authenticated;

-- 2) Marcação por plano ----------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT c.conname INTO v_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.meal_plan_checks'::regclass AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) = 'UNIQUE (client_id, check_date, meal)';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE meal_plan_checks DROP CONSTRAINT %I', v_name);
  END IF;
END;
$$;

ALTER TABLE meal_plan_checks DROP CONSTRAINT IF EXISTS meal_plan_checks_plan_day_meal_key;
ALTER TABLE meal_plan_checks ADD CONSTRAINT meal_plan_checks_plan_day_meal_key UNIQUE (client_id, plan_id, check_date, meal);

-- 3) Fim do acompanhamento -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other uuid;
  c uuid := NEW.client_id;
  n uuid := NEW.nutritionist_id;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status <> 'active') THEN
    PERFORM public.notify(n, 'patient_joined', c, jsonb_build_object(
      'name', public.profile_name(c), 'client_id', c));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'ended' THEN
    v_other := CASE WHEN auth.uid() = c THEN n ELSE c END;

    UPDATE food_swap_requests
    SET status = 'canceled', resolved_at = now()
    WHERE client_id = c AND nutritionist_id = n AND status = 'pending';

    -- Avisos deste acompanhamento levam a telas que a pessoa não vê mais: ficam lidos.
    UPDATE notifications SET read_at = now()
    WHERE read_at IS NULL AND (
      (user_id = c AND (
        (kind = 'message' AND ref_id = n)
        OR (kind = 'plan_updated' AND ref_id IN (SELECT id FROM meal_plans WHERE client_id = c AND created_by = n))
        OR (kind = 'swap_answered' AND ref_id IN (SELECT id FROM food_swap_requests WHERE client_id = c AND nutritionist_id = n))
        OR (kind IN ('appointment_scheduled', 'appointment_canceled', 'appointment_reminder')
            AND ref_id IN (SELECT id FROM appointments WHERE client_id = c AND nutritionist_id = n))
        OR (kind = 'goals_updated' AND EXISTS (SELECT 1 FROM nutrition_goals g WHERE g.user_id = c AND g.set_by = n))
      ))
      OR (user_id = n AND (
        (kind IN ('message', 'patient_joined') AND ref_id = c)
        OR (kind = 'swap_requested' AND ref_id IN (SELECT id FROM food_swap_requests WHERE client_id = c AND nutritionist_id = n))
        OR (kind IN ('appointment_scheduled', 'appointment_canceled', 'appointment_reminder')
            AND ref_id IN (SELECT id FROM appointments WHERE client_id = c AND nutritionist_id = n))
      ))
    );

    -- As metas continuam, mas não são mais "do nutricionista".
    UPDATE nutrition_goals SET set_by = NULL WHERE user_id = c AND set_by = n;

    PERFORM public.notify(v_other, 'link_ended', NEW.id, jsonb_build_object(
      'name', public.profile_name(CASE WHEN v_other = c THEN n ELSE c END)));
  END IF;
  RETURN NEW;
END;
$$;

-- Acompanhamentos já encerrados antes desta correção.
UPDATE nutrition_goals g SET set_by = NULL
WHERE g.set_by IS NOT NULL AND g.set_by <> g.user_id
  AND NOT EXISTS (SELECT 1 FROM nutritionist_clients c WHERE c.client_id = g.user_id AND c.nutritionist_id = g.set_by AND c.status = 'active');

-- Recomeçar o acompanhamento mantém a data de início (created_at); só o consentimento é renovado.
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

  -- Já é paciente ativo: não conta de novo no limite.
  IF NOT EXISTS (SELECT 1 FROM nutritionist_clients
                 WHERE nutritionist_id = v_invite.nutritionist_id AND client_id = auth.uid() AND status = 'active')
     AND public.patient_limit_reached(v_invite.nutritionist_id) THEN
    RAISE EXCEPTION 'patient_limit';
  END IF;

  INSERT INTO nutritionist_clients (nutritionist_id, client_id, status, consent_at)
  VALUES (v_invite.nutritionist_id, auth.uid(), 'active', now())
  ON CONFLICT (nutritionist_id, client_id)
  DO UPDATE SET status = 'active', ended_at = NULL, consent_at = now();

  UPDATE nutritionist_invites
  SET used_by = auth.uid(), used_at = now()
  WHERE code = v_invite.code;

  RETURN v_invite.nutritionist_id;
END;
$$;

-- 4) e 5) Item que sai do plano --------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'swap_requested', 'swap_answered', 'patient_joined', 'link_ended', 'plan_updated', 'goals_updated', 'message',
  'appointment_scheduled', 'appointment_canceled', 'appointment_reminder',
  'verification_requested', 'verification_reviewed', 'announcement', 'plan_item_removed'
));

-- Avisa o paciente (e o nutricionista autor do plano) e tira os itens com a receita ou o alimento.
-- Quem está apagando não recebe aviso.
CREATE OR REPLACE FUNCTION public.remove_plan_items_of(p_recipe uuid, p_food uuid, p_label text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v record;
  v_me uuid := auth.uid();
BEGIN
  FOR v IN
    SELECT DISTINCT p.id, p.client_id, p.created_by, p.title
    FROM meal_plan_items i JOIN meal_plans p ON p.id = i.plan_id
    WHERE (p_recipe IS NOT NULL AND i.recipe_id = p_recipe) OR (p_food IS NOT NULL AND i.food_id = p_food)
  LOOP
    IF v.client_id IS DISTINCT FROM v_me THEN
      PERFORM public.notify(v.client_id, 'plan_item_removed', v.id, jsonb_build_object('item', p_label, 'title', v.title));
    END IF;
    IF v.created_by <> v.client_id AND v.created_by IS DISTINCT FROM v_me THEN
      PERFORM public.notify(v.created_by, 'plan_item_removed', v.id, jsonb_build_object(
        'item', p_label, 'title', v.title, 'name', public.profile_name(v.client_id), 'client_id', v.client_id));
    END IF;
  END LOOP;

  DELETE FROM meal_plan_items
  WHERE (p_recipe IS NOT NULL AND recipe_id = p_recipe) OR (p_food IS NOT NULL AND food_id = p_food);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_plan_items_of(uuid, uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.before_recipe_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.remove_plan_items_of(OLD.id, NULL, OLD.title);

  -- Pedido de troca por esta receita: o aberto é cancelado; sem motivo escrito, ganha um (a regra
  -- "receita, alimento ou motivo" travava a exclusão).
  UPDATE food_swap_requests
  SET status = CASE WHEN status = 'pending' THEN 'canceled' ELSE status END,
      resolved_at = coalesce(resolved_at, now()),
      reason = CASE WHEN char_length(reason) = 0 THEN left('Receita removida: ' || OLD.title, 300) ELSE reason END
  WHERE requested_recipe_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_recipe_delete ON recipes;
CREATE TRIGGER trg_before_recipe_delete
  BEFORE DELETE ON recipes
  FOR EACH ROW EXECUTE FUNCTION public.before_recipe_delete();

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_food record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Assinatura que ainda cobra (ativa com renovação, ou com pagamento pendente): cancelar antes.
  IF EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = auth.uid()
      AND stripe_subscription_id IS NOT NULL
      AND ((status = 'active' AND auto_renew IS DISTINCT FROM false) OR status = 'pending')
  ) THEN
    RAISE EXCEPTION 'active_subscription';
  END IF;

  -- Alimentos próprios usados em planos de outras pessoas saem desses planos, com aviso.
  FOR v_food IN
    SELECT DISTINCT f.id, f.name FROM foods f JOIN meal_plan_items i ON i.food_id = f.id
    WHERE f.owner_id = auth.uid()
  LOOP
    PERFORM public.remove_plan_items_of(NULL, v_food.id, v_food.name);
  END LOOP;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 6) Salvar plano numa transação -------------------------------------------------------------
-- SECURITY INVOKER: as mesmas regras (RLS) de quem chama valem para o plano e os itens.
CREATE OR REPLACE FUNCTION public.save_meal_plan(p_plan uuid, p_client uuid, p_title text, p_notes text, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_id uuid := p_plan;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 400 THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO meal_plans (client_id, created_by, title, notes)
    VALUES (p_client, auth.uid(), coalesce(nullif(left(trim(p_title), 120), ''), 'Plano alimentar'), left(coalesce(p_notes, ''), 2000))
    RETURNING id INTO v_id;
  ELSE
    UPDATE meal_plans
    SET title = coalesce(nullif(left(trim(p_title), 120), ''), 'Plano alimentar'),
        notes = left(coalesce(p_notes, ''), 2000),
        updated_at = now()
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'plan_not_found';
    END IF;
    DELETE FROM meal_plan_items WHERE plan_id = v_id;
  END IF;

  INSERT INTO meal_plan_items (plan_id, day, meal, recipe_id, servings, food_id, grams, measure_label, option_group, note)
  SELECT v_id, x.day, x.meal,
         CASE WHEN x.food_id IS NULL THEN x.recipe_id END,
         CASE WHEN x.food_id IS NULL THEN coalesce(x.servings, 1) ELSE 1 END,
         x.food_id,
         CASE WHEN x.food_id IS NOT NULL THEN x.grams END,
         CASE WHEN x.food_id IS NOT NULL THEN nullif(left(coalesce(x.measure_label, ''), 120), '') END,
         x.option_group,
         left(coalesce(x.note, ''), 300)
  FROM jsonb_to_recordset(p_items) AS x(day smallint, meal text, recipe_id uuid, servings numeric, food_id uuid, grams numeric,
                                        measure_label text, option_group smallint, note text);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_meal_plan(uuid, uuid, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_meal_plan(uuid, uuid, text, text, jsonb) TO authenticated;
