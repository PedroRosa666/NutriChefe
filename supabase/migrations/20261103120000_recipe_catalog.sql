/*
  Catálogo de receitas paginado.

  1. recipes.review_count: quantas avaliações a receita tem, mantido pelo banco junto com a
     nota (rating). A grade mostra "4.5 (12 avaliações)" sem baixar as avaliações.
  2. search_recipes(...): a busca e os filtros da tela inicial rodam no servidor, com a mesma
     regra do app (sem acento, maiúsculas ou ordem das palavras). Devolve linhas de recipes,
     então o app escolhe as colunas e pagina com range (de 24 em 24). SECURITY INVOKER:
     valem as regras de quem pode ver cada receita (escondidas, exclusivas).
*/

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_recipe_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE recipes r
  SET rating = coalesce(s.avg_rating, 0), review_count = s.n
  FROM (
    SELECT round(avg(rating::numeric), 1) AS avg_rating, count(*)::int AS n
    FROM reviews
    WHERE recipe_id = coalesce(NEW.recipe_id, OLD.recipe_id)
  ) s
  WHERE r.id = coalesce(NEW.recipe_id, OLD.recipe_id);
  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.update_recipe_rating() FROM public, anon, authenticated;

UPDATE recipes r
SET review_count = (SELECT count(*) FROM reviews v WHERE v.recipe_id = r.id),
    rating = coalesce((SELECT round(avg(v.rating::numeric), 1) FROM reviews v WHERE v.recipe_id = r.id), 0);

CREATE OR REPLACE FUNCTION public.search_recipes(
  p_query text DEFAULT '',
  p_category text DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_min_rating numeric DEFAULT NULL,
  p_prep text DEFAULT NULL
)
RETURNS SETOF recipes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT r.*
  FROM recipes r
  WHERE public.search_match(coalesce(r.title, '') || ' ' || coalesce(r.description, ''), p_query)
    AND (p_category IS NULL OR p_category = 'all' OR r.category = p_category)
    AND (p_difficulty IS NULL OR r.difficulty = p_difficulty)
    AND (p_min_rating IS NULL OR r.rating >= p_min_rating)
    AND CASE p_prep
          WHEN 'quick' THEN r.prep_time <= 15
          WHEN 'medium' THEN r.prep_time <= 30
          WHEN 'long' THEN r.prep_time > 30
          ELSE true
        END
  ORDER BY r.created_at DESC, r.id;
$$;

REVOKE ALL ON FUNCTION public.search_recipes(text, text, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.search_recipes(text, text, text, numeric, text) TO anon, authenticated;
