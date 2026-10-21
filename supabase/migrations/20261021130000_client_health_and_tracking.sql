/*
  # Metas, diário alimentar, perfil de saúde e histórico de peso no banco

  Antes:
    - `nutrition_goals` era usada pelo app mas nunca criada nas migrations.
    - Metas e diário ficavam só no localStorage, sem separar por usuário
      (outro login no mesmo navegador via os dados do anterior) e se perdiam
      ao trocar de aparelho.

  Agora:
    1. nutrition_goals          -> metas diárias por usuário (1 linha por usuário)
    2. nutrition_log_entries    -> diário alimentar
    3. client_health_profiles   -> dados de saúde (privados; `profiles` é público)
    4. weight_logs              -> histórico de peso

  Todas com RLS: cada usuário só lê e escreve as próprias linhas.
*/

-- 1) Metas diárias ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calories numeric(8,1) NOT NULL DEFAULT 2000,
  protein numeric(8,1) NOT NULL DEFAULT 50,
  carbs numeric(8,1) NOT NULL DEFAULT 250,
  fat numeric(8,1) NOT NULL DEFAULT 70,
  fiber numeric(8,1) NOT NULL DEFAULT 25,
  active_goals text[] NOT NULL DEFAULT ARRAY['calories', 'protein', 'carbs', 'fat', 'fiber'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Caso a tabela já exista no projeto (criada manualmente), garante as colunas.
ALTER TABLE nutrition_goals ADD COLUMN IF NOT EXISTS active_goals text[] DEFAULT ARRAY['calories', 'protein', 'carbs', 'fat', 'fiber'];
ALTER TABLE nutrition_goals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Necessário para o upsert por usuário. A tabela já existe em produção (criada
-- fora das migrations): remove linhas duplicadas por usuário, mantendo uma.
DELETE FROM nutrition_goals a
USING nutrition_goals b
WHERE a.user_id = b.user_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS nutrition_goals_user_id_key ON nutrition_goals(user_id);

ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own nutrition goals" ON nutrition_goals;
CREATE POLICY "Users manage own nutrition goals"
  ON nutrition_goals FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) Diário alimentar -------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_title text NOT NULL,
  servings numeric(5,1) NOT NULL DEFAULT 1 CHECK (servings > 0 AND servings <= 50),
  -- Valores por porção no momento do registro (a receita pode mudar depois).
  per_serving jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_log_user_date ON nutrition_log_entries(user_id, entry_date DESC);

ALTER TABLE nutrition_log_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own nutrition log" ON nutrition_log_entries;
CREATE POLICY "Users manage own nutrition log"
  ON nutrition_log_entries FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3) Perfil de saúde (dados sensíveis: fora da tabela pública `profiles`) ----
CREATE TABLE IF NOT EXISTS client_health_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  birth_date date,
  sex text CHECK (sex IN ('female', 'male')),
  height_cm numeric(5,1) CHECK (height_cm IS NULL OR height_cm BETWEEN 50 AND 260),
  weight_kg numeric(5,1) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 20 AND 400),
  target_weight_kg numeric(5,1) CHECK (target_weight_kg IS NULL OR target_weight_kg BETWEEN 20 AND 400),
  activity_level text CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text CHECK (goal IN ('lose', 'maintain', 'gain')),
  dietary_preferences text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_health_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own health profile" ON client_health_profiles;
CREATE POLICY "Users manage own health profile"
  ON client_health_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4) Histórico de peso ------------------------------------------------------
CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_on date NOT NULL DEFAULT current_date,
  weight_kg numeric(5,1) NOT NULL CHECK (weight_kg BETWEEN 20 AND 400),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, logged_on)
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own weight logs" ON weight_logs;
CREATE POLICY "Users manage own weight logs"
  ON weight_logs FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
