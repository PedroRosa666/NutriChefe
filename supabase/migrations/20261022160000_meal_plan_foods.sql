/*
  # Alimentos e lista de substituição no plano alimentar

  - Cada item do plano é uma receita OU um alimento do catálogo (`foods`).
    Alimento: `grams` (quantidade total) e `measure_label` (texto mostrado, ex.: "2 × 1 fatia (50 g)").
  - `option_group`: itens da mesma refeição (dia + refeição) com o mesmo número são opções
    equivalentes ("escolha 1"). Nulo = item fixo.
  - Alimento usado em plano não pode ser excluído (ON DELETE RESTRICT): o app avisa o nutricionista.
  - Remove 4 alimentos da TACO que vieram sem energia nem macronutrientes na fonte
    (leite integral, leite desnatado UHT, iogurte sabor abacaxi e coco verde): com 0 kcal
    eles distorceriam os cálculos. O nutricionista pode cadastrá-los em "Meus alimentos".
*/

ALTER TABLE meal_plan_items ALTER COLUMN recipe_id DROP NOT NULL;

ALTER TABLE meal_plan_items
  ADD COLUMN IF NOT EXISTS food_id uuid REFERENCES foods(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS grams numeric(7,1) CHECK (grams IS NULL OR (grams > 0 AND grams <= 5000)),
  ADD COLUMN IF NOT EXISTS measure_label text CHECK (measure_label IS NULL OR char_length(measure_label) <= 120),
  ADD COLUMN IF NOT EXISTS option_group smallint CHECK (option_group IS NULL OR option_group BETWEEN 1 AND 99);

ALTER TABLE meal_plan_items DROP CONSTRAINT IF EXISTS meal_plan_items_recipe_or_food;
ALTER TABLE meal_plan_items ADD CONSTRAINT meal_plan_items_recipe_or_food CHECK (
  (recipe_id IS NOT NULL AND food_id IS NULL)
  OR (food_id IS NOT NULL AND recipe_id IS NULL AND grams IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_items_food ON meal_plan_items(food_id) WHERE food_id IS NOT NULL;

DELETE FROM foods WHERE taco_id IN (450, 457, 458, 591);
