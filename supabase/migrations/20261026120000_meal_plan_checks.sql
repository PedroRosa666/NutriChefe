/*
  # Adesão ao plano alimentar

  O paciente marca, para cada refeição do plano num dia, se seguiu:
    ate      -> comeu o que estava no plano (chosen: quais opções dos grupos "escolha 1")
    other    -> comeu outra coisa (note: o que foi, opcional)
    skipped  -> pulou a refeição
  Uma marcação por paciente, dia e refeição. O nutricionista com acompanhamento ativo lê
  as marcações dos planos que ele fez, para ver a % de adesão e onde o paciente sai do plano.
*/

CREATE TABLE IF NOT EXISTS meal_plan_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  check_date date NOT NULL,
  meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'snack', 'dinner')),
  status text NOT NULL CHECK (status IN ('ate', 'other', 'skipped')),
  chosen jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(chosen) = 'array' AND jsonb_array_length(chosen) <= 20),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, check_date, meal)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_checks_plan ON meal_plan_checks(plan_id, check_date DESC);

ALTER TABLE meal_plan_checks ENABLE ROW LEVEL SECURITY;

-- Paciente: só as próprias marcações, de planos que ele consegue ver (dele ou do nutricionista atual),
-- e nunca para datas futuras nem mais antigas que 30 dias.
DROP POLICY IF EXISTS "Clients read own checks" ON meal_plan_checks;
CREATE POLICY "Clients read own checks"
  ON meal_plan_checks FOR SELECT TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Clients write own checks" ON meal_plan_checks;
CREATE POLICY "Clients write own checks"
  ON meal_plan_checks FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid() AND public.can_view_meal_plan(plan_id)
    AND check_date <= current_date + 1 AND check_date >= current_date - 30
  );

DROP POLICY IF EXISTS "Clients update own checks" ON meal_plan_checks;
CREATE POLICY "Clients update own checks"
  ON meal_plan_checks FOR UPDATE TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (
    client_id = auth.uid() AND public.can_view_meal_plan(plan_id)
    AND check_date <= current_date + 1 AND check_date >= current_date - 30
  );

DROP POLICY IF EXISTS "Clients delete own checks" ON meal_plan_checks;
CREATE POLICY "Clients delete own checks"
  ON meal_plan_checks FOR DELETE TO authenticated
  USING (client_id = auth.uid());

-- Nutricionista: marcações dos planos que ele fez, enquanto o acompanhamento estiver ativo.
DROP POLICY IF EXISTS "Nutritionists read patient checks" ON meal_plan_checks;
CREATE POLICY "Nutritionists read patient checks"
  ON meal_plan_checks FOR SELECT TO authenticated
  USING (
    public.is_my_patient(client_id)
    AND EXISTS (SELECT 1 FROM meal_plans p WHERE p.id = plan_id AND p.created_by = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.touch_meal_plan_checks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_meal_plan_checks ON meal_plan_checks;
CREATE TRIGGER trg_touch_meal_plan_checks
  BEFORE UPDATE ON meal_plan_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_meal_plan_checks();
