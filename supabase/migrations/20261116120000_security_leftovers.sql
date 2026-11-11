/*
  Restos da auditoria de segurança de 30/10/2026.

  1. CRN que deixa de estar aprovado encerra os acompanhamentos ativos e vence os convites em aberto
     do nutricionista. Antes o vínculo continuava e ele seguia lendo os dados dos pacientes. Encerrar
     (em vez de conferir o CRN em cada regra) vale para todos os caminhos de uma vez e usa o fluxo
     de encerramento que já existe (avisa o paciente, cancela consultas e trocas, esconde planos).
  2. Demonstração: o limite de pares por visitante e por dia passa a ser contado e reservado numa
     transação só (claim_demo_start). Antes eram duas contagens soltas: pedidos simultâneos passavam.
  3. send-push: o gatilho manda um segredo no cabeçalho quando ele existe no Vault
     (push_webhook_secret). A função só exige o segredo quando ele está configurado nela.
*/

-- 1) CRN revogado -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_links_on_crn_revoked()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.crn_status = 'approved' AND NEW.crn_status <> 'approved' THEN
    UPDATE nutritionist_clients SET status = 'ended', ended_at = now()
    WHERE nutritionist_id = NEW.id AND status = 'active';
    UPDATE nutritionist_invites SET expires_at = now()
    WHERE nutritionist_id = NEW.id AND used_at IS NULL AND expires_at > now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.end_links_on_crn_revoked() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_end_links_on_crn_revoked ON profiles;
CREATE TRIGGER trg_end_links_on_crn_revoked
  AFTER UPDATE OF crn_status ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.end_links_on_crn_revoked();

-- 2) Demonstração: reserva atômica ------------------------------------------------------------------
-- Uma linha por tentativa de abrir a demo (só o hash do IP). Sem políticas: só a Edge Function.
CREATE TABLE IF NOT EXISTS demo_starts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_starts_ip ON demo_starts(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_demo_starts_created ON demo_starts(created_at);
ALTER TABLE demo_starts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demo_starts FROM anon, authenticated;

-- true = pode criar o par (a tentativa já ficou contada). Uma chamada por vez (trava da transação).
CREATE OR REPLACE FUNCTION public.claim_demo_start(p_ip_hash text, p_per_ip_hour integer, p_per_day integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('claim_demo_start'));
  DELETE FROM demo_starts WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM demo_starts WHERE ip_hash = p_ip_hash AND created_at > now() - interval '1 hour') >= p_per_ip_hour
     OR (SELECT count(*) FROM demo_starts) >= p_per_day THEN
    RETURN false;
  END IF;
  INSERT INTO demo_starts (ip_hash) VALUES (p_ip_hash);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_demo_start(text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_demo_start(text, integer, integer) TO service_role;

-- 3) send-push com segredo --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_headers jsonb := '{"Content-Type": "application/json"}'::jsonb;
BEGIN
  IF NEW.pushed_at IS NOT NULL OR NEW.read_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;
  -- Falha de rede (ou do Vault) aqui nunca impede o aviso de ser gravado.
  BEGIN
    IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
      EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
        INTO v_secret USING 'push_webhook_secret';
    END IF;
    IF coalesce(v_secret, '') <> '' THEN
      v_headers := v_headers || jsonb_build_object('x-push-secret', v_secret);
    END IF;
    PERFORM net.http_post(
      url := 'https://ptmfcodrlfufrzkxrtxg.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('notification_id', NEW.id),
      headers := v_headers
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_push failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
