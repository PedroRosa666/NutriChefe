/*
  # Premium do nutricionista

  - Plano "Premium Nutricionista" (features: ai_mentoring + nutritionist_pro). O preço do Stripe
    (stripe_price_id) é preenchido depois; até lá o botão de assinar fica indisponível.
  - has_feature(): assinatura ativa e não vencida com o recurso.
  - Plano grátis: até 5 pacientes ativos. Convite e aceite recusam com 'patient_limit'.
  - IA para os pacientes: paciente de nutricionista Premium usa a IA sem assinar (ai_access()).
  - patients_attention(): para o painel "Precisa de atenção" (último registro, última marcação de
    refeição, trocas pendentes e mensagens não lidas de cada paciente ativo).
  - pro_nutritionist_ids(): nutricionistas Premium, para o destaque na lista pública.
  - ai_usage: novos tipos de uso ('plan' = plano gerado pela IA; 'patient_chat' = IA paga pelo nutricionista).
*/

INSERT INTO subscription_plans (name, description, price, currency, billing_period, features, is_active)
SELECT 'Premium Nutricionista',
       'IA para montar planos, assistente para os pacientes, relatórios, pacientes ilimitados e destaque.',
       49.90, 'BRL', 'monthly', '["ai_mentoring", "nutritionist_pro"]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium Nutricionista');

CREATE OR REPLACE FUNCTION public.has_feature(p_user uuid, p_feature text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_subscriptions s
    JOIN subscription_plans p ON p.id = s.plan_id
    WHERE s.user_id = p_user
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND coalesce(p.features, '[]'::jsonb) ? p_feature
  );
$$;

REVOKE ALL ON FUNCTION public.has_feature(uuid, text) FROM public, anon, authenticated;

-- Para a tela: o próprio usuário pergunta pelos seus recursos.
CREATE OR REPLACE FUNCTION public.my_premium()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ai', public.has_feature(auth.uid(), 'ai_mentoring'),
    'nutritionist_pro', public.has_feature(auth.uid(), 'nutritionist_pro'),
    -- Paciente de nutricionista Premium: usa a IA pelo plano do nutricionista.
    'ai_via_nutritionist', (
      SELECT c.nutritionist_id FROM nutritionist_clients c
      WHERE c.client_id = auth.uid() AND c.status = 'active' AND public.has_feature(c.nutritionist_id, 'nutritionist_pro')
      ORDER BY c.created_at LIMIT 1
    ),
    'active_patients', (SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = auth.uid() AND status = 'active'),
    'free_patient_limit', 5
  );
$$;

REVOKE ALL ON FUNCTION public.my_premium() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_premium() TO authenticated;

-- Para a função ai-chat (service role): de onde vem o acesso à IA.
CREATE OR REPLACE FUNCTION public.ai_access(p_user uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_feature(p_user, 'ai_mentoring') THEN
      jsonb_build_object('source', 'own', 'nutritionist_pro', public.has_feature(p_user, 'nutritionist_pro'))
    ELSE coalesce((
      SELECT jsonb_build_object('source', 'nutritionist', 'nutritionist_id', c.nutritionist_id)
      FROM nutritionist_clients c
      WHERE c.client_id = p_user AND c.status = 'active' AND public.has_feature(c.nutritionist_id, 'nutritionist_pro')
      ORDER BY c.created_at LIMIT 1
    ), jsonb_build_object('source', null))
  END;
$$;

REVOKE ALL ON FUNCTION public.ai_access(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_access(uuid) TO service_role;

ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_kind_check;
ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_kind_check CHECK (kind IN ('chat', 'photo', 'plan', 'patient_chat'));

-- Limite de pacientes no plano grátis -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.patient_limit_reached(p_nutritionist uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT public.has_feature(p_nutritionist, 'nutritionist_pro')
     AND (SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = p_nutritionist AND status = 'active') >= 5;
$$;

REVOKE ALL ON FUNCTION public.patient_limit_reached(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_nutritionist_invite()
RETURNS nutritionist_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row nutritionist_invites;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Nutritionist') THEN
    RAISE EXCEPTION 'only_nutritionists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND crn_status = 'approved') THEN
    RAISE EXCEPTION 'crn_not_verified';
  END IF;
  IF public.patient_limit_reached(auth.uid()) THEN
    RAISE EXCEPTION 'patient_limit';
  END IF;
  -- Limite simples contra abuso: 20 convites em aberto por nutricionista.
  IF (SELECT count(*) FROM nutritionist_invites
      WHERE nutritionist_id = auth.uid() AND used_at IS NULL AND expires_at > now()) >= 20 THEN
    RAISE EXCEPTION 'too_many_invites';
  END IF;

  LOOP
    -- 8 caracteres hexadecimais (sem O nem I, fácil de ditar).
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM nutritionist_invites WHERE code = v_code);
  END LOOP;

  INSERT INTO nutritionist_invites (code, nutritionist_id)
  VALUES (v_code, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

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
  DO UPDATE SET status = 'active', ended_at = NULL, created_at = now(), consent_at = now();

  UPDATE nutritionist_invites
  SET used_by = auth.uid(), used_at = now()
  WHERE code = v_invite.code;

  RETURN v_invite.nutritionist_id;
END;
$$;

-- Painel "Precisa de atenção" ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.patients_attention()
RETURNS TABLE (
  client_id uuid,
  full_name text,
  last_log date,
  last_check date,
  pending_swaps integer,
  unread_messages integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.client_id,
         p.full_name,
         (SELECT max(e.entry_date) FROM nutrition_log_entries e WHERE e.user_id = c.client_id),
         (SELECT max(k.check_date) FROM meal_plan_checks k
           JOIN meal_plans mp ON mp.id = k.plan_id
           WHERE k.client_id = c.client_id AND mp.created_by = c.nutritionist_id),
         (SELECT count(*)::int FROM food_swap_requests s
           WHERE s.client_id = c.client_id AND s.nutritionist_id = c.nutritionist_id AND s.status = 'pending'),
         (SELECT count(*)::int FROM care_messages m
           WHERE m.client_id = c.client_id AND m.nutritionist_id = c.nutritionist_id
             AND m.sender_id = c.client_id AND m.read_at IS NULL)
  FROM nutritionist_clients c
  JOIN profiles p ON p.id = c.client_id
  WHERE c.nutritionist_id = auth.uid() AND c.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.patients_attention() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.patients_attention() TO authenticated;

-- Destaque na lista pública -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pro_nutritionist_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM profiles p
  WHERE p.user_type = 'Nutritionist' AND p.crn_status = 'approved' AND public.has_feature(p.id, 'nutritionist_pro');
$$;

REVOKE ALL ON FUNCTION public.pro_nutritionist_ids() FROM public;
GRANT EXECUTE ON FUNCTION public.pro_nutritionist_ids() TO anon, authenticated;
