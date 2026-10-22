/*
  # Catálogo de alimentos

  - `foods`: alimentos da Tabela TACO (4ª edição, NEPA/UNICAMP) e alimentos cadastrados por nutricionistas.
    Valores sempre por 100 g; `measures` guarda medidas caseiras ([{ "label": "1 fatia", "grams": 25 }]).
  - Linhas da TACO: `taco_id` preenchido e `owner_id` nulo. Visíveis para todos.
  - Alimentos próprios: `owner_id` = nutricionista. Visíveis só para ele e para os pacientes
    com acompanhamento ativo (`nutritionist_clients.status = 'active'`).
  - Os dados da TACO são carregados por 20261022150100_foods_taco_seed.sql.
*/

CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taco_id integer UNIQUE,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  category text NOT NULL DEFAULT 'Outros' CHECK (char_length(category) BETWEEN 1 AND 80),
  kcal numeric(7,1) NOT NULL DEFAULT 0 CHECK (kcal BETWEEN 0 AND 950),
  protein numeric(6,1) NOT NULL DEFAULT 0 CHECK (protein BETWEEN 0 AND 100),
  carbs numeric(6,1) NOT NULL DEFAULT 0 CHECK (carbs BETWEEN 0 AND 100),
  fat numeric(6,1) NOT NULL DEFAULT 0 CHECK (fat BETWEEN 0 AND 100),
  fiber numeric(6,1) NOT NULL DEFAULT 0 CHECK (fiber BETWEEN 0 AND 100),
  sodium numeric(7,1) CHECK (sodium IS NULL OR sodium BETWEEN 0 AND 40000), -- mg
  -- Demais nutrientes por 100 g (umidade, kJ, colesterol, tipos de gordura, minerais e vitaminas).
  -- Chave ausente = não analisado na fonte (diferente de zero). Lista e unidades: src/lib/nutrients.ts.
  nutrients jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(nutrients) = 'object'),
  measures jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(measures) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ou é da TACO (sem dono) ou é de um nutricionista (sem taco_id).
  CHECK ((taco_id IS NULL) <> (owner_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_foods_owner ON foods(owner_id) WHERE owner_id IS NOT NULL;

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Paciente vê os alimentos próprios do nutricionista que o acompanha.
CREATE OR REPLACE FUNCTION public.is_my_nutritionist(p_nutritionist uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM nutritionist_clients
    WHERE nutritionist_id = p_nutritionist
      AND client_id = auth.uid()
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_my_nutritionist(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_my_nutritionist(uuid) TO authenticated;

DROP POLICY IF EXISTS "Foods are visible to allowed users" ON foods;
DROP POLICY IF EXISTS "Nutritionists insert own foods" ON foods;
DROP POLICY IF EXISTS "Nutritionists update own foods" ON foods;
DROP POLICY IF EXISTS "Nutritionists delete own foods" ON foods;

CREATE POLICY "Foods are visible to allowed users"
ON foods FOR SELECT
TO anon, authenticated
USING (
  owner_id IS NULL
  OR owner_id = auth.uid()
  OR public.is_my_nutritionist(owner_id)
);

CREATE POLICY "Nutritionists insert own foods"
ON foods FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND taco_id IS NULL
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Nutritionist')
);

CREATE POLICY "Nutritionists update own foods"
ON foods FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid() AND taco_id IS NULL);

CREATE POLICY "Nutritionists delete own foods"
ON foods FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_foods_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_foods_updated_at ON foods;
CREATE TRIGGER trg_foods_updated_at
BEFORE UPDATE ON foods
FOR EACH ROW EXECUTE FUNCTION public.touch_foods_updated_at();
