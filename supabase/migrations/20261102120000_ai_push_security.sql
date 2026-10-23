/*
  Segurança da Mentoria IA e das inscrições de notificação (auditoria de 23/10/2026: F01-F04).

  1. Conversas da IA: quem participa não muda depois de criada. O usuário só altera título,
     arquivamento e data da última mensagem (antes dava para trocar o paciente da conversa).
  2. Só o titular (client_id) escreve mensagens na própria conversa. O nutricionista ligado
     não escreve no histórico do paciente.
  3. O nutricionista só lê conversas de um paciente enquanto o acompanhamento está ativo.
     Ao encerrar, o acesso acaba na hora, como a Política de Privacidade promete.
  4. Criar conversa segue a mesma regra do servidor (ai_access): assinatura própria com IA,
     ou paciente ativo de um nutricionista Premium. Antes o paciente incluído era barrado.
  5. push_subscriptions: gravar só pela função que confere o endereço; o usuário pode ler e
     apagar as próprias. Endereços novos passam pela mesma lista também no banco.
*/

-- Políticas antigas (nomes podem variar entre bancos): remove todas e recria.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('ai_conversations', 'ai_messages', 'push_subscriptions')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- O usuário logado está em acompanhamento ativo com este nutricionista?
CREATE OR REPLACE FUNCTION public.ai_link_active(p_client uuid, p_nutritionist uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IN (p_client, p_nutritionist) AND EXISTS (
    SELECT 1 FROM nutritionist_clients
    WHERE client_id = p_client AND nutritionist_id = p_nutritionist AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.ai_link_active(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_link_active(uuid, uuid) TO authenticated;

-- O usuário logado pode abrir conversa com a IA (ligada a este nutricionista, se houver)?
CREATE OR REPLACE FUNCTION public.can_start_ai(p_nutritionist uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_nutritionist IS NULL OR p_nutritionist = auth.uid() THEN public.has_feature(auth.uid(), 'ai_mentoring')
    ELSE public.ai_link_active(auth.uid(), p_nutritionist)
      AND (public.has_feature(auth.uid(), 'ai_mentoring') OR public.has_feature(p_nutritionist, 'nutritionist_pro'))
  END;
$$;

REVOKE ALL ON FUNCTION public.can_start_ai(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_start_ai(uuid) TO authenticated;

-- 1) Conversas ---------------------------------------------------------------------------
CREATE POLICY "AI conversations: owner or active nutritionist reads"
  ON ai_conversations FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR (nutritionist_id = auth.uid() AND public.ai_link_active(client_id, nutritionist_id))
  );

CREATE POLICY "AI conversations: owner creates when entitled"
  ON ai_conversations FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid() AND public.can_start_ai(nutritionist_id));

CREATE POLICY "AI conversations: owner updates"
  ON ai_conversations FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Participantes e configuração ficam fixos: só estas colunas são editáveis.
REVOKE UPDATE ON ai_conversations FROM anon, authenticated;
GRANT UPDATE (title, is_active, last_message_at) ON ai_conversations TO authenticated;
REVOKE DELETE ON ai_conversations FROM anon, authenticated;

-- A data da última mensagem é atualizada pelo banco, não depende do que o usuário pode editar.
CREATE OR REPLACE FUNCTION public.update_ai_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE ai_conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- 2) Mensagens ---------------------------------------------------------------------------
CREATE POLICY "AI messages: owner or active nutritionist reads"
  ON ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id
        AND (
          ac.client_id = auth.uid()
          OR (ac.nutritionist_id = auth.uid() AND public.ai_link_active(ac.client_id, ac.nutritionist_id))
        )
    )
  );

CREATE POLICY "AI messages: owner writes in own active conversation"
  ON ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id
        AND ac.client_id = auth.uid()
        AND ac.is_active
    )
  );

-- Mensagens não são editadas nem apagadas pelo app.
REVOKE UPDATE, DELETE ON ai_messages FROM anon, authenticated;

-- 3) Inscrições de notificação -------------------------------------------------------------
CREATE POLICY "Push subscriptions: owner reads"
  ON push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Push subscriptions: owner deletes"
  ON push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Gravar só por save_push_subscription (SECURITY DEFINER, confere o endereço).
REVOKE INSERT, UPDATE ON push_subscriptions FROM anon, authenticated;

-- A mesma lista também no banco, para qualquer caminho de escrita. NOT VALID: vale para
-- gravações novas sem reprovar inscrições antigas.
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_check;
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_check
  CHECK (endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/')
  NOT VALID;
