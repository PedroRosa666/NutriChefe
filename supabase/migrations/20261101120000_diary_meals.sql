/*
  Diário por refeição.

  - nutrition_log_entries.meal: a refeição do registro (café, almoço, lanche, jantar),
    as mesmas do plano alimentar. Opcional: registros antigos ficam sem refeição e
    aparecem em "Outros" no diário.
  - A política existente ("Users manage own nutrition log", FOR ALL) já deixa o próprio
    paciente editar seus registros (porções e refeição); nada muda para o nutricionista,
    que só lê.
*/

ALTER TABLE nutrition_log_entries
  ADD COLUMN IF NOT EXISTS meal text
  CHECK (meal IS NULL OR meal IN ('breakfast', 'lunch', 'snack', 'dinner'));
