/*
  # Adicionar campo para rastrear metas ativas

  1. Modificação na tabela nutrition_goals
    - Adicionar coluna active_goals (array de strings indicando quais metas estão ativas)
    - Valores possíveis: 'calories', 'protein', 'carbs', 'fat', 'fiber'
    - Default: todas as metas ativas

  2. Descrição
    - Permite que usuários selecionem quais metas querem acompanhar
    - Dados reais do banco de dados
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nutrition_goals' AND column_name = 'active_goals'
  ) THEN
    ALTER TABLE nutrition_goals ADD COLUMN active_goals text[] DEFAULT ARRAY['calories', 'protein', 'carbs', 'fat', 'fiber'];
  END IF;
END $$;
