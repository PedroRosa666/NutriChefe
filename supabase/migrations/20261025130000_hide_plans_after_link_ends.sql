/*
  # Planos de um nutricionista somem para o paciente quando o acompanhamento acaba

  Bug: depois de encerrar o acompanhamento (ou trocar de nutricionista), o paciente continuava
  vendo os planos feitos pelo nutricionista antigo, com o botão "Trocar", e o pedido dava erro.

  Agora o paciente vê um plano se ele mesmo fez, ou se foi feito por um nutricionista com
  acompanhamento ATIVO. O mesmo vale para os itens do plano e para os pedidos de troca.
  Nada é apagado: se o paciente voltar a ser acompanhado pelo mesmo nutricionista, tudo reaparece.

  Ao encerrar, os pedidos de troca em aberto daquele acompanhamento são cancelados.
*/

-- Plano visível: o próprio cliente no plano que ele fez; o paciente no plano do nutricionista
-- atual; o nutricionista no plano que fez para um paciente ativo.
CREATE OR REPLACE FUNCTION public.can_view_meal_plan(p_plan uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meal_plans p
    WHERE p.id = p_plan
      AND (
        (p.client_id = auth.uid() AND (p.created_by = auth.uid() OR public.is_my_nutritionist(p.created_by)))
        OR (p.created_by = auth.uid() AND public.is_my_patient(p.client_id))
      )
  );
$$;

DROP POLICY IF EXISTS "View meal plans" ON meal_plans;
CREATE POLICY "View meal plans"
  ON meal_plans FOR SELECT TO authenticated
  USING (
    (client_id = auth.uid() AND (created_by = auth.uid() OR public.is_my_nutritionist(created_by)))
    OR (created_by = auth.uid() AND public.is_my_patient(client_id))
  );

DROP POLICY IF EXISTS "View own swap requests" ON food_swap_requests;
CREATE POLICY "View own swap requests"
  ON food_swap_requests FOR SELECT TO authenticated
  USING (
    (client_id = auth.uid() AND public.is_my_nutritionist(nutritionist_id))
    OR (nutritionist_id = auth.uid() AND public.is_my_patient(client_id))
  );

-- Encerrar o acompanhamento: avisa a outra pessoa e cancela os pedidos de troca em aberto.
CREATE OR REPLACE FUNCTION public.notify_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other uuid;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status <> 'active') THEN
    PERFORM public.notify(NEW.nutritionist_id, 'patient_joined', NEW.client_id, jsonb_build_object(
      'name', public.profile_name(NEW.client_id), 'client_id', NEW.client_id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'ended' THEN
    v_other := CASE WHEN auth.uid() = NEW.client_id THEN NEW.nutritionist_id ELSE NEW.client_id END;
    PERFORM public.notify(v_other, 'link_ended', NEW.id, jsonb_build_object(
      'name', public.profile_name(CASE WHEN v_other = NEW.client_id THEN NEW.nutritionist_id ELSE NEW.client_id END)));

    UPDATE food_swap_requests
    SET status = 'canceled', resolved_at = now()
    WHERE client_id = NEW.client_id AND nutritionist_id = NEW.nutritionist_id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

-- Pedidos que já estavam abertos em acompanhamentos encerrados antes desta correção.
UPDATE food_swap_requests r
SET status = 'canceled', resolved_at = now()
WHERE r.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM nutritionist_clients c
    WHERE c.nutritionist_id = r.nutritionist_id AND c.client_id = r.client_id AND c.status = 'active'
  );
