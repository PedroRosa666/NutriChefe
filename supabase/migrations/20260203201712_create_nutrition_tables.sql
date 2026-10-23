/*
  # Criar tabelas de nutrição

  1. Nova Tabela: nutrition_goals
    - id (uuid, primary key)
    - user_id (uuid, foreign key para auth.users)
    - calories (numeric)
    - protein (numeric)
    - carbs (numeric)
    - fat (numeric)
    - fiber (numeric)
    - created_at (timestamp)
    - updated_at (timestamp)

  2. Nova Tabela: nutrition_log
    - id (uuid, primary key)
    - user_id (uuid, foreign key para auth.users)
    - recipe_id (uuid, foreign key para recipes)
    - recipe_title (text)
    - servings (numeric)
    - calories (numeric)
    - protein (numeric)
    - carbs (numeric)
    - fat (numeric)
    - fiber (numeric)
    - date (date)
    - created_at (timestamp)

  3. Segurança
    - Enable RLS em ambas as tabelas
    - Usuários só podem ver suas próprias metas e registros
*/

-- Criar tabela nutrition_goals
CREATE TABLE IF NOT EXISTS nutrition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calories numeric DEFAULT 2000.0,
  protein numeric DEFAULT 50.0,
  carbs numeric DEFAULT 250.0,
  fat numeric DEFAULT 70.0,
  fiber numeric DEFAULT 25.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Criar tabela nutrition_log
CREATE TABLE IF NOT EXISTS nutrition_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id integer NOT NULL,
  recipe_title text NOT NULL,
  servings numeric DEFAULT 1.0,
  calories numeric DEFAULT 0,
  protein numeric DEFAULT 0,
  carbs numeric DEFAULT 0,
  fat numeric DEFAULT 0,
  fiber numeric DEFAULT 0,
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

ALTER TABLE nutrition_log ENABLE ROW LEVEL SECURITY;

-- Políticas para nutrition_goals
CREATE POLICY "Usuários podem ver suas próprias metas"
  ON nutrition_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias metas"
  ON nutrition_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas"
  ON nutrition_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para nutrition_log
CREATE POLICY "Usuários podem ver seus próprios registros"
  ON nutrition_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios registros"
  ON nutrition_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios registros"
  ON nutrition_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS nutrition_goals_user_id ON nutrition_goals(user_id);

CREATE INDEX IF NOT EXISTS nutrition_log_user_id ON nutrition_log(user_id);

CREATE INDEX IF NOT EXISTS nutrition_log_date ON nutrition_log(date);

CREATE INDEX IF NOT EXISTS nutrition_log_user_date ON nutrition_log(user_id, date);
