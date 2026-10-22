/*
  # Privacidade (LGPD)

  1. nutritionist_clients.consent_at: quando o paciente autorizou o compartilhamento dos dados
     de saúde com o nutricionista. O app só chama redeem_nutritionist_invite depois que o paciente
     marca a autorização; a função grava o momento.
  2. delete_my_account(): o próprio usuário apaga a conta. Apaga o usuário em auth.users, e as
     chaves com ON DELETE CASCADE levam junto perfil, diário, peso, metas, planos, trocas, avisos,
     modelos, alimentos e receitas próprias. Com assinatura ativa que renova sozinha, recusa
     ('active_subscription'): primeiro é preciso cancelar no portal de pagamento, senão a cobrança continua.
*/

ALTER TABLE nutritionist_clients ADD COLUMN IF NOT EXISTS consent_at timestamptz;

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

  INSERT INTO nutritionist_clients (nutritionist_id, client_id, status, consent_at)
  VALUES (v_invite.nutritionist_id, auth.uid(), 'active', now())
  ON CONFLICT (nutritionist_id, client_id)
  DO UPDATE SET status = 'active', ended_at = NULL, created_at = now(), consent_at = now();

  UPDATE nutritionist_invites
  SET used_by = auth.uid(), used_at = now()
  WHERE code = v_invite.code;

  RETURN v_invite.nutritionist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND stripe_subscription_id IS NOT NULL
      AND auto_renew IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'active_subscription';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
