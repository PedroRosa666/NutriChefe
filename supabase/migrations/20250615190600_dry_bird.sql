/*
  # Atualizar campos nutricionais para suportar decimais

  1. Alterações
    - Modificar campos de nutrition_facts para suportar valores decimais
    - Garantir que todos os valores nutricionais sejam armazenados como NUMERIC com precisão decimal
    - Atualizar função de cálculo de rating para manter precisão

  2. Segurança
    - Manter todas as políticas RLS existentes
    - Preservar integridade dos dados existentes
*/

-- Não é necessário alterar a estrutura da tabela pois JSONB já suporta números decimais
-- Apenas garantir que as funções lidem corretamente com decimais

-- Atualizar função de cálculo de rating para manter precisão decimal
CREATE OR REPLACE FUNCTION update_recipe_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE recipes 
  SET rating = (
    SELECT COALESCE(ROUND(AVG(rating::numeric), 1), 0) 
    FROM reviews 
    WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id)
  )
  WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Recriar o trigger para garantir que use a função atualizada
DROP TRIGGER IF EXISTS update_recipe_rating_trigger ON reviews;
CREATE TRIGGER update_recipe_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_recipe_rating();