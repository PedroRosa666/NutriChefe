/*
  # Normalizar especializações dos nutricionistas

  1. Alterações
    - Normaliza todas as especializações existentes no banco de dados
    - Converte traduções em português e inglês para chaves padronizadas
    - Garante que todas as especializações usem o formato de chave (ex: 'clinical', 'weightLoss')
  
  2. Objetivo
    - Garantir que a tradução funcione corretamente independente da língua
    - Evitar duplicações de especializações devido a diferentes traduções
*/

DO $$
DECLARE
  profile_record RECORD;
  normalized_specs text[];
  spec text;
BEGIN
  FOR profile_record IN 
    SELECT id, specializations 
    FROM profiles 
    WHERE specializations IS NOT NULL 
      AND array_length(specializations, 1) > 0
  LOOP
    normalized_specs := ARRAY[]::text[];
    
    FOREACH spec IN ARRAY profile_record.specializations
    LOOP
      normalized_specs := array_append(
        normalized_specs,
        CASE spec
          -- Sports Nutrition
          WHEN 'Sports Nutrition' THEN 'sports'
          WHEN 'Nutrição Esportiva' THEN 'sports'
          WHEN 'sports' THEN 'sports'
          
          -- Clinical Nutrition
          WHEN 'Clinical Nutrition' THEN 'clinical'
          WHEN 'Nutrição Clínica' THEN 'clinical'
          WHEN 'clinical' THEN 'clinical'
          
          -- Weight Loss
          WHEN 'Weight Loss' THEN 'weightLoss'
          WHEN 'Emagrecimento' THEN 'weightLoss'
          WHEN 'weightLoss' THEN 'weightLoss'
          
          -- Women's Health
          WHEN 'Women''s Health' THEN 'womensHealth'
          WHEN 'Saúde da Mulher' THEN 'womensHealth'
          WHEN 'womensHealth' THEN 'womensHealth'
          
          -- Pediatric Nutrition
          WHEN 'Pediatric Nutrition' THEN 'pediatric'
          WHEN 'Nutrição Pediátrica' THEN 'pediatric'
          WHEN 'pediatric' THEN 'pediatric'
          
          -- Geriatric Nutrition
          WHEN 'Geriatric Nutrition' THEN 'geriatric'
          WHEN 'Nutrição Geriátrica' THEN 'geriatric'
          WHEN 'geriatric' THEN 'geriatric'
          
          -- Vegetarian/Vegan
          WHEN 'Vegetarian/Vegan' THEN 'vegetarian'
          WHEN 'Vegetariano/Vegano' THEN 'vegetarian'
          WHEN 'vegetarian' THEN 'vegetarian'
          
          -- Diabetes Management
          WHEN 'Diabetes Management' THEN 'diabetes'
          WHEN 'Controle de Diabetes' THEN 'diabetes'
          WHEN 'diabetes' THEN 'diabetes'
          
          -- Cardiovascular Health
          WHEN 'Cardiovascular Health' THEN 'cardiovascular'
          WHEN 'Saúde Cardiovascular' THEN 'cardiovascular'
          WHEN 'cardiovascular' THEN 'cardiovascular'
          
          -- Gastrointestinal Health
          WHEN 'Gastrointestinal Health' THEN 'gastrointestinal'
          WHEN 'Saúde Gastrointestinal' THEN 'gastrointestinal'
          WHEN 'gastrointestinal' THEN 'gastrointestinal'
          
          ELSE spec
        END
      );
    END LOOP;
    
    -- Remove duplicatas
    normalized_specs := ARRAY(SELECT DISTINCT unnest(normalized_specs));
    
    -- Atualiza o perfil com as especializações normalizadas
    UPDATE profiles
    SET specializations = normalized_specs
    WHERE id = profile_record.id;
  END LOOP;
END $$;
