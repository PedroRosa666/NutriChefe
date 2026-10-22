/*
  # Notificações no celular (Web Push)

  1. push_subscriptions: cada aparelho/navegador em que a pessoa ativou as notificações.
     O usuário só mexe nas próprias inscrições.
  2. notifications.pushed_at: quando o aviso foi enviado ao celular. Um aviso agrupado
     (ex.: várias edições do plano) só gera nova notificação se a anterior tiver mais de 10 minutos.
  3. Ao criar (ou reabrir) um aviso, o banco chama a função send-push (Edge Function) com o id
     do aviso, via pg_net. A função confere no banco se o aviso existe, é recente e ainda não foi
     enviado; por isso não precisa de segredo na chamada.
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
  p256dh text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth text NOT NULL CHECK (char_length(auth) <= 100),
  user_agent text NOT NULL DEFAULT '' CHECK (char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- O mesmo navegador pode passar para outra conta (ex.: celular da família): a inscrição muda de dono.
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_user_agent, ''), 300))
  ON CONFLICT (endpoint)
  DO UPDATE SET user_id = auth.uid(), p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
                user_agent = EXCLUDED.user_agent, created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Agrupar um aviso só "reabre" o envio se o último foi há mais de 10 minutos.
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
  SET data = p_data, created_at = now(),
      pushed_at = CASE WHEN pushed_at > now() - interval '10 minutes' THEN pushed_at ELSE NULL END
  WHERE user_id = p_user AND kind = p_kind AND ref_id IS NOT DISTINCT FROM p_ref AND read_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO notifications (user_id, kind, ref_id, data) VALUES (p_user, p_kind, p_ref, p_data);
  END IF;

  DELETE FROM notifications WHERE user_id = p_user AND read_at < now() - interval '60 days';
END;
$$;

REVOKE ALL ON FUNCTION public.notify(uuid, text, uuid, jsonb) FROM public, anon, authenticated;

-- Chama a função de envio. Falha de rede aqui nunca impede o aviso de ser gravado.
CREATE OR REPLACE FUNCTION public.dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pushed_at IS NOT NULL OR NEW.read_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://ptmfcodrlfufrzkxrtxg.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('notification_id', NEW.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_push failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_push ON notifications;
CREATE TRIGGER trg_dispatch_push
  AFTER INSERT OR UPDATE OF created_at ON notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push();

-- A função de envio (com a chave de serviço) marca o aviso como enviado só uma vez.
CREATE OR REPLACE FUNCTION public.claim_push(p_notification uuid)
RETURNS SETOF notifications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notifications
  SET pushed_at = now()
  WHERE id = p_notification AND pushed_at IS NULL AND read_at IS NULL
    AND created_at > now() - interval '5 minutes'
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_push(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push(uuid) TO service_role;
