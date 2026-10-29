/*
  Correções da auditoria de 29/10/2026.

  - profiles: quem está logado ainda podia INSERIR a própria linha escolhendo qualquer coluna
    (crn_status = 'approved' pulava a verificação do CRN, is_demo, user_type). A linha é criada só
    pelo gatilho do cadastro (handle_new_user); o app nunca insere. Sai a permissão e a política.
  - ai_configurations: qualquer cliente com IA lia a configuração (e as instruções) da IA de todos
    os nutricionistas, mesmo com a assinatura vencida. Agora só a do nutricionista que o acompanha,
    com a mesma regra da IA (has_feature confere a validade).
  - Demonstração: visitante só se vincula ao próprio par (antes podia se vincular às contas demo do
    Laboratório); nutricionistas demo não entram na lista de nutricionistas Premium; pares vencidos
    são apagados de hora em hora (antes, só quando outro visitante abria a demo).
  - nutrition_goals: três políticas antigas repetiam "Users manage own nutrition goals".
*/

-- 1) profiles: linha criada só pelo cadastro --------------------------------------------------------
DROP POLICY IF EXISTS "Usuários podem inserir próprio perfil" ON profiles;
REVOKE INSERT, DELETE ON profiles FROM anon, authenticated;

-- 2) Configuração da IA: só a do nutricionista que acompanha ---------------------------------------
DROP POLICY IF EXISTS "Premium clients can view AI configs" ON ai_configurations;
CREATE POLICY "Linked clients read their nutritionist AI config" ON ai_configurations FOR SELECT TO authenticated
  USING (public.ai_link_active(auth.uid(), nutritionist_id));

-- 3) Demonstração -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demo_link_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_demo_visitor(NEW.client_id) OR public.is_demo_visitor(NEW.nutritionist_id) THEN
    -- Visitante: só o próprio par.
    IF NOT EXISTS (SELECT 1 FROM demo_visitors
                   WHERE patient_id = NEW.client_id AND nutritionist_id = NEW.nutritionist_id) THEN
      RAISE EXCEPTION 'demo_readonly';
    END IF;
  ELSIF (SELECT is_demo FROM profiles WHERE id = NEW.client_id)
        IS DISTINCT FROM (SELECT is_demo FROM profiles WHERE id = NEW.nutritionist_id) THEN
    -- Conta demo (Laboratório) só com conta demo.
    RAISE EXCEPTION 'demo_readonly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pro_nutritionist_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM profiles p
  WHERE p.user_type = 'Nutritionist' AND p.crn_status = 'approved' AND NOT p.is_demo
    AND public.has_feature(p.id, 'nutritionist_pro');
$$;

-- Pares vencidos: apagar a conta apaga os dados dela (cascata), como em delete_my_account.
CREATE OR REPLACE FUNCTION public.cleanup_demo_visitors()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_rows integer;
BEGIN
  WITH expired AS (SELECT patient_id, nutritionist_id FROM demo_visitors WHERE expires_at < now() LIMIT 200)
  SELECT coalesce(array_agg(u), '{}') INTO v_ids
  FROM (SELECT patient_id AS u FROM expired UNION ALL SELECT nutritionist_id FROM expired) x;
  IF cardinality(v_ids) = 0 THEN
    RETURN 0;
  END IF;
  -- As duas contas de cada par num comando só: os dados de uma apontam para a outra.
  DELETE FROM auth.users WHERE id = ANY (v_ids);
  DELETE FROM demo_visitors WHERE patient_id = ANY (v_ids) OR nutritionist_id = ANY (v_ids);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_demo_visitors() FROM public, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'demo-visitors-cleanup';
    PERFORM cron.schedule('demo-visitors-cleanup', '17 * * * *', 'SELECT public.cleanup_demo_visitors()');
  END IF;
END;
$$;

-- 4) Políticas repetidas -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias metas" ON nutrition_goals;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias metas" ON nutrition_goals;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias metas" ON nutrition_goals;
