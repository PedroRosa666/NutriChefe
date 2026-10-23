// Colunas públicas de `profiles`. `email` e `stripe_customer_id` não podem ser
// lidas pelo app (permissão por coluna): `select('*')` nessa tabela falha.
// String literal (sem montar dinamicamente) para o tipo do supabase-js funcionar.
export const PUBLIC_PROFILE_COLUMNS =
  'id, full_name, user_type, avatar_url, bio, created_at, updated_at, specializations, professional_bio, years_of_experience, education, certifications, approach, consultation_price, consultation_types, consultation_duration, accepts_health_insurance, health_insurances, phone, whatsapp, instagram, website, clinic_address, profile_visibility, accepting_new_clients, crn_status, crn_region, crn_number' as const;
