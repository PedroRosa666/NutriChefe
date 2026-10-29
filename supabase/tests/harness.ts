// Banco de teste: Postgres de verdade (PGlite, em memória) com as migrations reais
// de pacientes, alimentos, planos, trocas, avisos e modelos. As tabelas mais antigas
// que elas referenciam (perfis, receitas, diário...) entram como versões mínimas.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite, type Transaction } from '@electric-sql/pglite';

const MIGRATIONS = [
  '20261021150000_patients_plans_shopping.sql',
  '20261022150000_foods_catalog.sql',
  '20261022160000_meal_plan_foods.sql',
  '20261022170000_food_swap_requests.sql',
  '20261023120000_notifications.sql',
  '20261023130000_meal_plan_templates.sql',
  '20261024120000_swap_recipes.sql',
  '20261024130000_privacy_lgpd.sql',
  '20261024140000_client_errors.sql',
  '20261025120000_push_notifications.sql',
  '20261025130000_hide_plans_after_link_ends.sql',
  '20261026120000_meal_plan_checks.sql',
  '20261026130000_care_messages.sql',
  '20261026140000_appointments.sql',
  '20261027120000_security_hardening.sql',
  '20261027130000_nutritionist_verification.sql',
  '20261028120000_nutritionist_premium.sql',
  '20261029120000_admin_panel.sql',
  '20261030120000_client_premium.sql',
  '20261031120000_data_consistency.sql',
  '20261101120000_diary_meals.sql',
  '20261102120000_ai_push_security.sql',
  '20261102130000_checks_search_billing.sql',
  '20261103120000_recipe_catalog.sql',
  '20261104120000_base_hardening.sql',
  '20261105120000_plan_versions.sql',
  '20261106120000_custom_meals.sql',
  '20261107120000_recipe_yield.sql',
  '20261108120000_recipe_calc.sql',
  '20261110120000_demo_visitors.sql',
];

// O que o Supabase já traz pronto (papéis, auth.uid, publicação do Realtime) e as
// tabelas antigas, só com as colunas que as migrations acima usam.
const BASE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

  CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

  CREATE PUBLICATION supabase_realtime;

  -- pg_net de mentira: só anota as chamadas HTTP que o banco faria.
  CREATE SCHEMA net;
  CREATE TABLE net.calls (url text, body jsonb);
  CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb) RETURNS bigint LANGUAGE sql
    AS $$ INSERT INTO net.calls VALUES (url, body); SELECT 1::bigint $$;

  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, last_sign_in_at timestamptz, banned_until timestamptz);
  CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, user_type text,
    profile_visibility text DEFAULT 'public', last_seen timestamptz DEFAULT now(), created_at timestamptz DEFAULT now()
  );
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  CREATE TABLE subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, price numeric NOT NULL,
    currency text NOT NULL, billing_period text NOT NULL, features jsonb, is_active boolean, stripe_price_id text,
    updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE user_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES subscription_plans(id), status text, stripe_subscription_id text, auto_renew boolean,
    expires_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, author_id uuid, description text, image text,
    -- Mesmos tipos de produção (jsonb).
    prep_time int, difficulty text, rating numeric DEFAULT 0, category text, ingredients jsonb, instructions jsonb,
    nutrition_facts jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz
  );
  ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Qualquer pessoa pode visualizar receitas" ON recipes FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY "Autores podem atualizar suas receitas" ON recipes FOR UPDATE TO authenticated USING (auth.uid() = author_id);
  CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE, user_id uuid, rating int, comment text, created_at timestamptz DEFAULT now());
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Qualquer pessoa pode visualizar avaliações" ON reviews FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY "Usuários podem criar avaliações" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE FUNCTION public.update_recipe_rating() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END; $fn$;
  CREATE TRIGGER update_recipe_rating_trigger AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION public.update_recipe_rating();
  CREATE TABLE favorites (user_id uuid, recipe_id uuid);
  CREATE TABLE nutrition_log_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, recipe_id uuid, entry_date date, recipe_title text,
    servings numeric, per_serving jsonb
  );
  CREATE TABLE client_health_profiles (
    user_id uuid PRIMARY KEY, birth_date date, sex text, height_cm numeric, weight_kg numeric, target_weight_kg numeric,
    activity_level text, goal text, dietary_preferences text[], allergies text[], notes text, updated_at timestamptz
  );
  CREATE TABLE weight_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, logged_on date, weight_kg numeric);
  CREATE TABLE nutrition_goals (user_id uuid PRIMARY KEY, calories int, protein int, carbs int, fat int, fiber int, set_by uuid);
  -- Mentoria IA como criada em 2025 (20250908130344), com as políticas antigas.
  CREATE TABLE ai_configurations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nutritionist_id uuid REFERENCES profiles(id) ON DELETE CASCADE);
  CREATE TABLE ai_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    nutritionist_id uuid REFERENCES profiles(id) ON DELETE SET NULL, ai_config_id uuid REFERENCES ai_configurations(id) ON DELETE SET NULL,
    title text, last_message_at timestamptz DEFAULT now(), is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE ai_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    sender_type text NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'ai')), content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now()
  );
  ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view their own AI conversations" ON ai_conversations FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR nutritionist_id = auth.uid());
  CREATE POLICY "Users can update their AI conversations" ON ai_conversations FOR UPDATE TO authenticated
    USING (client_id = auth.uid() OR nutritionist_id = auth.uid());
  CREATE POLICY "Users can send messages to their AI conversations" ON ai_messages FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM ai_conversations ac WHERE ac.id = ai_messages.conversation_id
      AND (ac.client_id = auth.uid() OR ac.nutritionist_id = auth.uid())));
  CREATE FUNCTION public.update_ai_conversation_last_message() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN UPDATE ai_conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id; RETURN NEW; END; $fn$;
  CREATE TRIGGER update_ai_conversation_last_message_trigger AFTER INSERT ON ai_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_ai_conversation_last_message();
  -- Tabelas da primeira versão (sem uso), como "messages" em produção: sem RLS.
  CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content text);
  CREATE TABLE client_goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid);
  ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON recipes TO anon, authenticated;
  -- Como em produção (20261021140000): leitura de perfis só por coluna.
  REVOKE ALL ON profiles FROM anon, authenticated;
  GRANT SELECT (id, full_name, user_type, profile_visibility, last_seen) ON profiles TO anon, authenticated;
`;

/** Aplica uma migration (pelo nome do arquivo) num banco de teste. */
export async function applyMigration(db: PGlite, file: string) {
  const sql = readFileSync(fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)), 'utf8')
    // pg_net não existe no PGlite: usa o de mentira criado em BASE.
    .replace(/CREATE EXTENSION IF NOT EXISTS pg_net[^;]*;/, '');
  try {
    await db.exec(sql);
  } catch (error) {
    throw new Error(`Falha na migration ${file}: ${(error as Error).message}`);
  }
}

/**
 * Banco com as migrations. `until`: para antes dessa migration (para gravar dados no formato
 * antigo e testar a conversão aplicando-a depois com applyMigration).
 */
export async function createTestDb(options: { until?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BASE);
  for (const file of MIGRATIONS) {
    if (file === options.until) break;
    await applyMigration(db, file);
  }
  return db;
}

/** Roda `fn` como o usuário logado `uid` (papel authenticated, com RLS), numa transação. */
export function asUser<T>(db: PGlite, uid: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('SET LOCAL ROLE authenticated');
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    return fn(tx);
  });
}
