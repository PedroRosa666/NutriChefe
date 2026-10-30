/*
  Perfil privado fica privado.

  A política "Public profile rows" (20261027120000_security_hardening.sql) também liberava a linha
  inteira de quem escreveu uma receita ou avaliação, sem olhar `profile_visibility`. O nome e a foto
  do autor agora vêm de author_card/reviewer_card (20261115120000_author_cards.sql), então essas
  duas condições saem: o visitante só lê direto o perfil de nutricionista público.

  Quem continua vendo mais, como antes: o próprio dono, e (com login) o nutricionista e o paciente
  com acompanhamento ativo ("Linked profile rows").
*/

DROP POLICY IF EXISTS "Public profile rows" ON profiles;

CREATE POLICY "Public profile rows"
  ON profiles FOR SELECT TO anon, authenticated
  USING (
    id = auth.uid()
    OR (user_type = 'Nutritionist' AND coalesce(profile_visibility, 'public') = 'public')
  );
