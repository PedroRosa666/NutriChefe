/*
  Limpeza da auditoria de 29/10/2026 (aprovada pelo dono do app).

  - Schema "legacy": 8 tabelas da primeira versão (mentorias, mensagens antigas), sem uso no app nem
    em funções. Backup feito antes (fora do repositório, com as 15 linhas que restavam).
  - Colunas sem uso: ai_conversations.ai_config_id e ai_configuration_id (vazias; a configuração da
    IA é lida pelo servidor a cada mensagem) e profiles.last_seen (ninguém lê nem grava).
  - Privacidade: telefone, WhatsApp, Instagram, site e endereço de consultório são só de
    nutricionista. Perfis de pacientes podem ficar visíveis (autor de avaliação), então esses
    campos ficam sempre vazios para quem não é nutricionista.
  - Limite de pacientes do plano grátis num lugar só: free_patient_limit().
*/

-- 1) Tabelas antigas -------------------------------------------------------------------------------
DROP SCHEMA IF EXISTS legacy CASCADE;

-- 2) Colunas sem uso ---------------------------------------------------------------------------------
ALTER TABLE ai_conversations DROP COLUMN IF EXISTS ai_configuration_id;
ALTER TABLE ai_conversations DROP COLUMN IF EXISTS ai_config_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS last_seen;

-- 3) Contato só de nutricionista -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_contact_only_nutritionists()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.user_type IS DISTINCT FROM 'Nutritionist' THEN
    NEW.phone := NULL;
    NEW.whatsapp := NULL;
    NEW.instagram := NULL;
    NEW.website := NULL;
    NEW.clinic_address := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.profile_contact_only_nutritionists() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_profile_contact_only_nutritionists ON profiles;
CREATE TRIGGER trg_profile_contact_only_nutritionists BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_contact_only_nutritionists();

UPDATE profiles SET phone = NULL, whatsapp = NULL, instagram = NULL, website = NULL, clinic_address = NULL
WHERE user_type IS DISTINCT FROM 'Nutritionist'
  AND (phone IS NOT NULL OR whatsapp IS NOT NULL OR instagram IS NOT NULL OR website IS NOT NULL OR clinic_address IS NOT NULL);

-- 4) Limite do plano grátis --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.free_patient_limit()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 5 $$;
REVOKE ALL ON FUNCTION public.free_patient_limit() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.free_patient_limit() TO authenticated;

CREATE OR REPLACE FUNCTION public.patient_limit_reached(p_nutritionist uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT public.has_feature(p_nutritionist, 'nutritionist_pro')
     AND (SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = p_nutritionist AND status = 'active')
         >= public.free_patient_limit();
$$;

CREATE OR REPLACE FUNCTION public.my_premium()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ai', public.has_feature(auth.uid(), 'ai_mentoring'),
    'nutritionist_pro', public.has_feature(auth.uid(), 'nutritionist_pro'),
    'ai_via_nutritionist', (
      SELECT c.nutritionist_id FROM nutritionist_clients c
      WHERE c.client_id = auth.uid() AND c.status = 'active' AND public.has_feature(c.nutritionist_id, 'nutritionist_pro')
      ORDER BY c.created_at LIMIT 1
    ),
    'active_patients', (SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = auth.uid() AND status = 'active'),
    'free_patient_limit', public.free_patient_limit(),
    'admin', public.is_admin(),
    'demo', coalesce((SELECT is_demo FROM profiles WHERE id = auth.uid()), false),
    'visitor', public.is_demo_visitor(auth.uid())
  );
$$;
