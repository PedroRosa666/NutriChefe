/*
  # Mensagens entre nutricionista e paciente

  - care_messages: uma conversa por par nutricionista/paciente. Só existe enquanto o
    acompanhamento estiver ativo: ao encerrar, nenhum dos dois lê nem escreve (o histórico
    fica guardado e volta se o acompanhamento recomeçar).
  - Quem recebe marca como lida (mark_messages_read).
  - Cada mensagem gera o aviso "message" para quem recebe (agrupado por conversa enquanto
    não for lido), que também vira notificação no celular.
  - Limite contra abuso: 60 mensagens por hora por pessoa.
  - As tabelas antigas "conversations"/"messages" (mentoria antiga) não são usadas.
*/

CREATE TABLE IF NOT EXISTS care_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id IN (nutritionist_id, client_id))
);

CREATE INDEX IF NOT EXISTS idx_care_messages_pair ON care_messages(nutritionist_id, client_id, created_at DESC);

ALTER TABLE care_messages ENABLE ROW LEVEL SECURITY;

-- Ler: as duas pontas, só com o acompanhamento ativo.
DROP POLICY IF EXISTS "Members read messages" ON care_messages;
CREATE POLICY "Members read messages"
  ON care_messages FOR SELECT TO authenticated
  USING (
    (nutritionist_id = auth.uid() AND public.is_my_patient(client_id))
    OR (client_id = auth.uid() AND public.is_my_nutritionist(nutritionist_id))
  );

-- Escrever: só em nome próprio e com o acompanhamento ativo.
DROP POLICY IF EXISTS "Members send messages" ON care_messages;
CREATE POLICY "Members send messages"
  ON care_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND read_at IS NULL
    AND (
      (nutritionist_id = auth.uid() AND public.is_my_patient(client_id))
      OR (client_id = auth.uid() AND public.is_my_nutritionist(nutritionist_id))
    )
  );

REVOKE UPDATE, DELETE ON care_messages FROM anon, authenticated;

-- Quem recebe marca como lidas as mensagens da outra pessoa nesta conversa.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_nutritionist uuid, p_client uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() NOT IN (p_nutritionist, p_client) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  UPDATE care_messages
  SET read_at = now()
  WHERE nutritionist_id = p_nutritionist AND client_id = p_client
    AND sender_id <> auth.uid() AND read_at IS NULL;
  -- O aviso dessa conversa também deixa de ser novo.
  UPDATE notifications
  SET read_at = now()
  WHERE user_id = auth.uid() AND kind = 'message' AND read_at IS NULL
    AND ref_id = CASE WHEN auth.uid() = p_nutritionist THEN p_client ELSE p_nutritionist END;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, uuid) TO authenticated;

-- Avisos: novo tipo "message".
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'swap_requested', 'swap_answered', 'patient_joined', 'link_ended', 'plan_updated', 'goals_updated', 'message'
));

CREATE OR REPLACE FUNCTION public.on_care_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid := CASE WHEN NEW.sender_id = NEW.nutritionist_id THEN NEW.client_id ELSE NEW.nutritionist_id END;
BEGIN
  IF (SELECT count(*) FROM care_messages WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 hour') > 60 THEN
    RAISE EXCEPTION 'too_many_messages';
  END IF;
  -- ref_id = quem enviou: várias mensagens seguidas viram um aviso só, com a mais recente.
  PERFORM public.notify(v_recipient, 'message', NEW.sender_id, jsonb_build_object(
    'name', public.profile_name(NEW.sender_id),
    'preview', left(NEW.body, 120),
    'client_id', NEW.client_id,
    'from_nutritionist', NEW.sender_id = NEW.nutritionist_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_care_message ON care_messages;
CREATE TRIGGER trg_on_care_message
  AFTER INSERT ON care_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_care_message();

-- Realtime: a conversa aberta recebe as mensagens na hora.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'care_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE care_messages;
  END IF;
END;
$$;
