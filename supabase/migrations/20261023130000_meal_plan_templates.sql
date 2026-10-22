/*
  # Modelos de plano alimentar

  O nutricionista (ou qualquer usuário) salva um cardápio semanal como modelo e o aplica
  depois ao montar o plano de outro paciente. Só o dono vê e mexe nos próprios modelos.

  items guarda os itens sem ids, no mesmo formato de meal_plan_items:
    [{ "day", "meal", "recipe_id", "servings", "food_id", "grams", "measure_label", "option_group", "note" }]
  Receitas ou alimentos que deixarem de existir são ignorados ao aplicar o modelo.
*/

CREATE TABLE IF NOT EXISTS meal_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 400),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_templates_owner ON meal_plan_templates(owner_id, updated_at DESC);

ALTER TABLE meal_plan_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own templates" ON meal_plan_templates;
CREATE POLICY "Owners manage own templates"
  ON meal_plan_templates FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
