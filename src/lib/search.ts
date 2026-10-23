// Uma regra de busca para o app inteiro: sem diferença de acento, maiúsculas, pontuação
// ou ordem das palavras ("salmao toscana" acha "Salmão à Toscana").
import { normalizeText } from '../../supabase/functions/_shared/recipe-search';

/** As palavras da busca, já normalizadas (vazio quando não há o que buscar). */
function searchWords(query: string): string[] {
  return normalizeText(query).split(' ').filter(Boolean);
}

/** Todas as palavras da busca aparecem em algum dos textos? Busca vazia aceita tudo. */
export function matchesSearch(query: string | string[], ...texts: unknown[]): boolean {
  const words = Array.isArray(query) ? query : searchWords(query);
  if (!words.length) return true;
  const haystack = normalizeText(texts.map((t) => (Array.isArray(t) ? t.join(' ') : t ?? '')).join(' '));
  return words.every((w) => haystack.includes(w));
}
