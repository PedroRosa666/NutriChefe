/*
  Nome e foto de quem escreveu a receita ou a avaliação, sem o resto do perfil.

  Até aqui, a política "Public profile rows" liberava a linha inteira de `profiles` de qualquer autor
  de receita ou avaliação. Com isso, o nutricionista que marcou o perfil como privado continuava com
  telefone, WhatsApp, endereço e preço visíveis para qualquer visitante, desde que tivesse uma receita.

  Agora o app busca o autor por estas duas funções (relacionamento calculado do PostgREST:
  `profiles:author_card(full_name, user_type, avatar_url)` no select de recipes), que devolvem só
  id, nome, tipo e foto. A política é apertada na migration seguinte, depois que o app novo estiver
  no ar (o app antigo ainda lê o autor direto de `profiles`).

  `profile_cards` só existe como tipo de retorno: é security_invoker, então lida direto ela obedece
  às mesmas regras de `profiles`.
*/

CREATE OR REPLACE VIEW public.profile_cards WITH (security_invoker = true) AS
  SELECT id, full_name, user_type, avatar_url FROM public.profiles;

REVOKE ALL ON public.profile_cards FROM anon, authenticated;
GRANT SELECT ON public.profile_cards TO anon, authenticated;

-- A linha recebida é conferida contra a tabela: uma linha inventada (author_id de outra pessoa)
-- não devolve nada, então só aparece quem de fato é autor daquela receita.
CREATE OR REPLACE FUNCTION public.author_card(r public.recipes)
RETURNS SETOF public.profile_cards
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
ROWS 1
AS $$
  SELECT p.id, p.full_name, p.user_type, p.avatar_url
  FROM profiles p
  WHERE p.id = r.author_id
    AND EXISTS (SELECT 1 FROM recipes x WHERE x.id = r.id AND x.author_id = r.author_id);
$$;

CREATE OR REPLACE FUNCTION public.reviewer_card(v public.reviews)
RETURNS SETOF public.profile_cards
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
ROWS 1
AS $$
  SELECT p.id, p.full_name, p.user_type, p.avatar_url
  FROM profiles p
  WHERE p.id = v.user_id
    AND EXISTS (SELECT 1 FROM reviews x WHERE x.id = v.id AND x.user_id = v.user_id);
$$;

REVOKE ALL ON FUNCTION public.author_card(public.recipes) FROM public;
REVOKE ALL ON FUNCTION public.reviewer_card(public.reviews) FROM public;
GRANT EXECUTE ON FUNCTION public.author_card(public.recipes) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reviewer_card(public.reviews) TO anon, authenticated;
