/*
  # Esconder e-mail e dados de cobrança da tabela pública `profiles`

  Problema (verificado em produção):
    A policy de SELECT de `profiles` é `USING (true)` e a tabela tinha SELECT
    em todas as colunas para `anon`. Com a chave pública do site, qualquer
    pessoa lia o e-mail de todos os usuários e o `stripe_customer_id`.
    Além disso, o próprio usuário podia mudar `user_type` (virar
    "Nutritionist" e ganhar a Mentoria IA sem pagar) e `stripe_customer_id`.

  Correção (permissões por coluna; RLS continua valendo para as linhas):
    - SELECT só nas colunas públicas. `email` e `stripe_customer_id` ficam
      só para o service role (Edge Functions). O app lê o e-mail da sessão.
    - UPDATE só nas colunas que o usuário edita no app.
    - INSERT continua com o trigger `handle_new_user` (SECURITY DEFINER).
*/

REVOKE SELECT, UPDATE ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, full_name, user_type, avatar_url, bio, created_at, updated_at, last_seen,
  specializations, professional_bio, years_of_experience, education, certifications,
  approach, consultation_price, consultation_types, consultation_duration,
  accepts_health_insurance, health_insurances, phone, whatsapp, instagram, website,
  clinic_address, profile_visibility, accepting_new_clients
) ON public.profiles TO anon, authenticated;

GRANT UPDATE (
  full_name, avatar_url, bio, last_seen,
  specializations, professional_bio, years_of_experience, education, certifications,
  approach, consultation_price, consultation_types, consultation_duration,
  accepts_health_insurance, health_insurances, phone, whatsapp, instagram, website,
  clinic_address, profile_visibility, accepting_new_clients, updated_at
) ON public.profiles TO authenticated;

