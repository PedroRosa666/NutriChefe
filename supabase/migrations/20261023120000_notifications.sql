/*
  # Avisos (notificações dentro do app)

  - Cada aviso pertence a um usuário (user_id) e é criado só pelos gatilhos abaixo, nunca pelo app.
  - Tipos:
      swap_requested  -> nutricionista: paciente pediu troca de um item do plano
      swap_answered   -> paciente: nutricionista aprovou ou recusou a troca
      patient_joined  -> nutricionista: paciente aceitou o convite
      link_ended      -> a outra pessoa encerrou o acompanhamento
      plan_updated    -> paciente: nutricionista criou ou alterou um plano
      goals_updated   -> paciente: nutricionista definiu as metas diárias
  - data guarda o nome de quem gerou o aviso e o necessário para abrir a tela certa.
  - O usuário lê, marca como lido e apaga os próprios avisos. Realtime ligado para chegar na hora.
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('swap_requested', 'swap_answered', 'patient_joined', 'link_ended', 'plan_updated', 'goals_updated')),
  ref_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own notifications" ON notifications;
CREATE POLICY "Users mark own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- O app só marca como lido; o resto é escrito pelos gatilhos.
REVOKE INSERT, UPDATE ON notifications FROM anon, authenticated;
GRANT UPDATE (read_at) ON notifications TO authenticated;

-- Cria o aviso. Se já houver um não lido do mesmo tipo e assunto, só o atualiza
-- (ex.: várias edições seguidas do plano viram um aviso só).
CREATE OR REPLACE FUNCTION public.notify(p_user uuid, p_kind text, p_ref uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  UPDATE notifications
  SET data = p_data, created_at = now()
  WHERE user_id = p_user AND kind = p_kind AND ref_id IS NOT DISTINCT FROM p_ref AND read_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO notifications (user_id, kind, ref_id, data) VALUES (p_user, p_kind, p_ref, p_data);
  END IF;

  -- Faxina: avisos lidos com mais de 60 dias.
  DELETE FROM notifications WHERE user_id = p_user AND read_at < now() - interval '60 days';
END;
$$;

REVOKE ALL ON FUNCTION public.notify(uuid, text, uuid, jsonb) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.profile_name(p_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(full_name), ''), '') FROM profiles WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.profile_name(uuid) FROM public, anon, authenticated;

-- Trocas ----------------------------------------------------------------------
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
      'offered', NEW.counter_food_id IS NOT NULL));
    -- O pedido foi respondido: o aviso do nutricionista já não precisa ficar como novo.
    UPDATE notifications SET read_at = now()
    WHERE user_id = NEW.nutritionist_id AND kind = 'swap_requested' AND ref_id = NEW.id AND read_at IS NULL;
  ELSIF OLD.status = 'pending' AND NEW.status = 'canceled' THEN
    -- Paciente desistiu: some com o aviso que ainda não foi visto.
    DELETE FROM notifications
    WHERE user_id = NEW.nutritionist_id AND kind = 'swap_requested' AND ref_id = NEW.id AND read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_swap ON food_swap_requests;
CREATE TRIGGER trg_notify_swap
  AFTER INSERT OR UPDATE OF status ON food_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_swap_change();

-- Vínculo nutricionista <-> paciente ------------------------------------------
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
    -- Avisa quem NÃO encerrou.
    v_other := CASE WHEN auth.uid() = NEW.client_id THEN NEW.nutritionist_id ELSE NEW.client_id END;
    PERFORM public.notify(v_other, 'link_ended', NEW.id, jsonb_build_object(
      'name', public.profile_name(CASE WHEN v_other = NEW.client_id THEN NEW.nutritionist_id ELSE NEW.client_id END)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_link ON nutritionist_clients;
CREATE TRIGGER trg_notify_link
  AFTER INSERT OR UPDATE OF status ON nutritionist_clients
  FOR EACH ROW EXECUTE FUNCTION public.notify_link_change();

-- Plano feito pelo nutricionista -----------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by = NEW.client_id THEN
    RETURN NEW;
  END IF;
  -- Mudança feita ao responder uma troca já gerou o aviso swap_answered (mesma transação).
  IF EXISTS (SELECT 1 FROM food_swap_requests WHERE plan_id = NEW.id AND resolved_at = now()) THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify(NEW.client_id, 'plan_updated', NEW.id, jsonb_build_object(
    'name', public.profile_name(NEW.created_by), 'title', NEW.title, 'new', TG_OP = 'INSERT'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_plan ON meal_plans;
CREATE TRIGGER trg_notify_plan
  AFTER INSERT OR UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.notify_plan_change();

-- Metas definidas pelo nutricionista -------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_goals_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.set_by IS NULL OR NEW.set_by = NEW.user_id OR NEW.set_by <> auth.uid() THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify(NEW.user_id, 'goals_updated', NEW.user_id, jsonb_build_object(
    'name', public.profile_name(NEW.set_by)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_goals ON nutrition_goals;
CREATE TRIGGER trg_notify_goals
  AFTER INSERT OR UPDATE ON nutrition_goals
  FOR EACH ROW EXECUTE FUNCTION public.notify_goals_change();

-- Realtime: o sino atualiza sem recarregar a página.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END;
$$;
