/*
  # Receita e perfil público só de nutricionista com CRN aprovado

  Auditoria de 12/11/2026:

  1. Qualquer conta logada publicava receita no catálogo pela API (a tela só mostra o botão ao
     nutricionista, mas `save_recipe` e a política de INSERT conferiam só `author_id = auth.uid()`).
     A receita aparece para todos, entra nas páginas de busca e no catálogo que a IA lê.
     Agora criar receita exige nutricionista com CRN aprovado, ou administrador. A regra fica num
     gatilho de INSERT, para valer igual na função e na gravação direta. Sem usuário (chave de
     serviço, carga por SQL) nada muda. Editar a própria receita continua como era.

  2. Perfil de nutricionista sem CRN aprovado abria por link para qualquer visitante (só a lista
     filtrava). Agora o visitante lê apenas perfil público com CRN aprovado; o dono continua vendo o
     próprio, e paciente e nutricionista com acompanhamento ativo continuam se vendo
     ("Linked profile rows").
*/

-- 1) Receita nova: autor verificado ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recipes_require_verified_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND user_type = 'Nutritionist' AND crn_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'crn_not_verified';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.recipes_require_verified_author() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_recipes_require_verified_author ON recipes;
CREATE TRIGGER trg_recipes_require_verified_author
  BEFORE INSERT ON recipes
  FOR EACH ROW EXECUTE FUNCTION public.recipes_require_verified_author();

-- 2) Perfil público: só com CRN aprovado ----------------------------------------------------------
DROP POLICY IF EXISTS "Public profile rows" ON profiles;

CREATE POLICY "Public profile rows"
  ON profiles FOR SELECT TO anon, authenticated
  USING (
    id = auth.uid()
    OR (
      user_type = 'Nutritionist'
      AND coalesce(profile_visibility, 'public') = 'public'
      AND crn_status = 'approved'
    )
  );
