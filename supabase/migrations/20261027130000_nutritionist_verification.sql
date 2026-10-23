/*
  # Verificação do CRN dos nutricionistas

  - app_admins: quem administra o app. Só se entra nela pelo SQL Editor (o app não grava aqui).
  - profiles.crn_status: none (nunca enviou) | pending | approved | rejected. Só muda pelas funções abaixo.
    profiles.crn_region / crn_number: o registro aprovado (aparece no perfil público).
  - nutritionist_verifications: o pedido (nome como no registro, CRN, foto da carteira e selfie
    segurando a carteira). Um por nutricionista; reenviar substitui o anterior.
  - Bucket privado `nutritionist-docs`: cada nutricionista envia só na própria pasta; só ele e os
    administradores abrem. Depois da análise, o app do administrador apaga as fotos.
  - Avisos: verification_requested -> administradores; verification_reviewed -> nutricionista.
  - Sem CRN aprovado o nutricionista não cria convites (não consegue ter pacientes).
  - Os nutricionistas que já existiam ficam aprovados.
*/

CREATE TABLE IF NOT EXISTS app_admins (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crn_status text NOT NULL DEFAULT 'none';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crn_region smallint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crn_number text;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_crn_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_crn_status_check CHECK (crn_status IN ('none', 'pending', 'approved', 'rejected'));

-- Leitura pública (selo "CRN verificado"); não entram no GRANT UPDATE, então o usuário não muda.
GRANT SELECT (crn_status, crn_region, crn_number) ON public.profiles TO anon, authenticated;

UPDATE profiles SET crn_status = 'approved' WHERE user_type = 'Nutritionist' AND crn_status = 'none';

CREATE TABLE IF NOT EXISTS nutritionist_verifications (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 3 AND 150),
  crn_region smallint NOT NULL CHECK (crn_region BETWEEN 1 AND 20),
  crn_number text NOT NULL CHECK (crn_number ~ '^[0-9]{1,7}$'),
  card_path text NOT NULL,
  selfie_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason text NOT NULL DEFAULT '' CHECK (char_length(reject_reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nutritionist_verifications_pending ON nutritionist_verifications(created_at) WHERE status = 'pending';

ALTER TABLE nutritionist_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own or admin reads verification" ON nutritionist_verifications;
CREATE POLICY "Own or admin reads verification"
  ON nutritionist_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON nutritionist_verifications FROM anon, authenticated;

-- Avisos: novos tipos.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'swap_requested', 'swap_answered', 'patient_joined', 'link_ended', 'plan_updated', 'goals_updated', 'message',
  'appointment_scheduled', 'appointment_canceled', 'appointment_reminder',
  'verification_requested', 'verification_reviewed'
));

-- Nutricionista envia (ou reenvia) o pedido. As fotos já devem estar na própria pasta do bucket.
CREATE OR REPLACE FUNCTION public.submit_crn_verification(
  p_full_name text, p_crn_region smallint, p_crn_number text, p_card_path text, p_selfie_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_number text := regexp_replace(coalesce(p_crn_number, ''), '\D', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Nutritionist') THEN
    RAISE EXCEPTION 'only_nutritionists';
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND crn_status = 'approved') THEN
    RAISE EXCEPTION 'already_approved';
  END IF;
  IF split_part(coalesce(p_card_path, ''), '/', 1) <> auth.uid()::text
     OR split_part(coalesce(p_selfie_path, ''), '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'invalid_files';
  END IF;

  INSERT INTO nutritionist_verifications (user_id, full_name, crn_region, crn_number, card_path, selfie_path)
  VALUES (auth.uid(), trim(p_full_name), p_crn_region, v_number, p_card_path, p_selfie_path)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name, crn_region = EXCLUDED.crn_region, crn_number = EXCLUDED.crn_number,
    card_path = EXCLUDED.card_path, selfie_path = EXCLUDED.selfie_path,
    status = 'pending', reject_reason = '', created_at = now(), reviewed_at = NULL, reviewed_by = NULL;

  UPDATE profiles SET crn_status = 'pending' WHERE id = auth.uid();

  FOR v_admin IN SELECT user_id FROM app_admins LOOP
    PERFORM public.notify(v_admin, 'verification_requested', auth.uid(),
      jsonb_build_object('name', trim(p_full_name), 'crn', 'CRN-' || p_crn_region || ' ' || v_number));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_crn_verification(text, smallint, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_crn_verification(text, smallint, text, text, text) TO authenticated;

-- Administrador aprova ou recusa. Recusar exige um motivo (aparece para o nutricionista).
CREATE OR REPLACE FUNCTION public.review_crn_verification(p_user uuid, p_approve boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row nutritionist_verifications;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO v_row FROM nutritionist_verifications WHERE user_id = p_user AND status = 'pending' FOR UPDATE;
  IF v_row.user_id IS NULL THEN
    RAISE EXCEPTION 'not_pending';
  END IF;
  IF NOT p_approve AND coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  UPDATE nutritionist_verifications
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reject_reason = CASE WHEN p_approve THEN '' ELSE left(trim(p_reason), 300) END,
      reviewed_at = now(), reviewed_by = auth.uid()
  WHERE user_id = p_user;

  UPDATE profiles
  SET crn_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      crn_region = CASE WHEN p_approve THEN v_row.crn_region ELSE crn_region END,
      crn_number = CASE WHEN p_approve THEN v_row.crn_number ELSE crn_number END
  WHERE id = p_user;

  -- O aviso de pedido some para todos os administradores.
  UPDATE notifications SET read_at = now()
  WHERE kind = 'verification_requested' AND ref_id = p_user AND read_at IS NULL;

  PERFORM public.notify(p_user, 'verification_reviewed', p_user,
    jsonb_build_object('approved', p_approve, 'reason', CASE WHEN p_approve THEN '' ELSE left(trim(p_reason), 300) END));
END;
$$;

REVOKE ALL ON FUNCTION public.review_crn_verification(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_crn_verification(uuid, boolean, text) TO authenticated;

-- Convites só com CRN aprovado.
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

-- Bucket privado dos documentos -------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN; -- banco de teste (sem Storage)
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('nutritionist-docs', 'nutritionist-docs', false, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
  ON CONFLICT (id) DO UPDATE SET
    public = false, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

  DROP POLICY IF EXISTS "Nutritionist uploads own docs" ON storage.objects;
  DROP POLICY IF EXISTS "Owner or admin reads docs" ON storage.objects;
  DROP POLICY IF EXISTS "Owner or admin deletes docs" ON storage.objects;

  CREATE POLICY "Nutritionist uploads own docs"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'nutritionist-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

  CREATE POLICY "Owner or admin reads docs"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'nutritionist-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

  CREATE POLICY "Owner or admin deletes docs"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'nutritionist-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
END;
$$;
