/*
  Segredo do disparo de notificações num lugar só: o Vault (nome push_webhook_secret).

  - push_webhook_secret(): lê o valor. Só o service_role executa (a Edge Function send-push) e o
    gatilho dispatch_push usa a mesma função. Assim o valor nasce no banco e não precisa ser copiado
    para os segredos da função (duas cópias podiam ficar diferentes e os avisos parariam).
  - Sem Vault ou sem o segredo gravado, devolve NULL: o envio funciona sem segredo, como antes.
  - Para trocar o segredo: SELECT vault.update_secret(id, novo_valor) na linha de nome
    push_webhook_secret. A função send-push relê o valor quando recebe um que não confere.
*/
CREATE OR REPLACE FUNCTION public.push_webhook_secret()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = $1 LIMIT 1'
    INTO v_secret USING 'push_webhook_secret';
  RETURN nullif(v_secret, '');
END;
$$;
REVOKE ALL ON FUNCTION public.push_webhook_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_webhook_secret() TO service_role;

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
    v_secret := public.push_webhook_secret();
    IF v_secret IS NOT NULL THEN
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
