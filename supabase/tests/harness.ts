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

  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, user_type text,
    profile_visibility text DEFAULT 'public', last_seen timestamptz DEFAULT now()
  );
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  CREATE TABLE user_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    status text, stripe_subscription_id text, auto_renew boolean
  );
  CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, author_id uuid, description text, image text,
    prep_time int, difficulty text, rating numeric DEFAULT 0, category text, ingredients text[], instructions text[],
    nutrition_facts jsonb, updated_at timestamptz
  );
  ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Qualquer pessoa pode visualizar receitas" ON recipes FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY "Autores podem atualizar suas receitas" ON recipes FOR UPDATE TO authenticated USING (auth.uid() = author_id);
  CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE, user_id uuid, rating int);
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Qualquer pessoa pode visualizar avaliações" ON reviews FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY "Usuários podem criar avaliações" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE FUNCTION public.update_recipe_rating() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN RETURN NULL; END; $fn$;
  CREATE TRIGGER update_recipe_rating_trigger AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION public.update_recipe_rating();
  CREATE TABLE favorites (user_id uuid, recipe_id uuid);
  CREATE TABLE nutrition_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, recipe_id uuid);
  CREATE TABLE client_health_profiles (user_id uuid PRIMARY KEY);
  CREATE TABLE weight_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
  CREATE TABLE nutrition_goals (user_id uuid PRIMARY KEY, calories int);
  GRANT SELECT ON recipes TO anon, authenticated;
  -- Como em produção (20261021140000): leitura de perfis só por coluna.
  REVOKE ALL ON profiles FROM anon, authenticated;
  GRANT SELECT (id, full_name, user_type, profile_visibility, last_seen) ON profiles TO anon, authenticated;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BASE);
  for (const file of MIGRATIONS) {
    const sql = readFileSync(fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)), 'utf8')
      // pg_net não existe no PGlite: usa o de mentira criado em BASE.
      .replace(/CREATE EXTENSION IF NOT EXISTS pg_net[^;]*;/, '');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Falha na migration ${file}: ${(error as Error).message}`);
    }
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
