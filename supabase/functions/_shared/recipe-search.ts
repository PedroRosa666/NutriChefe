/**
 * Busca de receitas por ingrediente, filtros e tipo de prato.
 *
 * Usada pela Edge Function `ai-chat` (com o plano montado pelo Gemini) e pelo
 * app quando a IA está indisponível (com o plano montado por `parseQueryLocally`).
 * Não tem dependências: roda em Deno e no navegador.
 *
 * Como o casamento funciona: textos viram "radicais" (minúsculo, sem acento,
 * sem plural e sem a vogal final), então "Morangos", "morango" e "MORANGO"
 * são iguais, e "sal" não casa com "salmão". Um ingrediente pedido casa com
 * uma linha da receita quando todos os radicais dele estão naquela linha
 * ("leite de coco" não casa com uma receita que tem "leite" e "coco ralado"
 * em linhas diferentes).
 */

export interface SearchableRecipe {
  id: string;
  title: string;
  description: string;
  category: string;
  ingredients: string[];
  instructions?: string[];
  prepTime: number;
  difficulty: string;
  rating: number;
  calories: number;
  protein: number;
  author?: string;
  image?: string;
  createdAt?: string;
}

export interface IngredientQuery {
  name: string;
  variants?: string[];
}

export type SearchSort = 'relevance' | 'rating' | 'quick' | 'newest' | 'low_calories' | 'high_protein';

export interface RecipeSearchQuery {
  include?: IngredientQuery[];
  exclude?: string[];
  /** Chave da categoria: vegan, vegetarian, glutenFree, lowCarb, highProtein. */
  category?: string;
  difficulty?: string;
  maxPrepTime?: number;
  minRating?: number;
  maxCalories?: number;
  minProtein?: number;
  /** Tipo de prato ou ocasião: bolo, salada, sobremesa, café da manhã... */
  keywords?: string[];
  /** Receitas que a IA indicou como próximas do tipo de prato pedido. */
  conceptIds?: string[];
  /** Ingredientes parecidos, usados só quando nenhuma receita tem os pedidos. */
  substitutes?: string[];
  sort?: SearchSort;
  limit?: number;
}

/**
 * exact: tudo atendido. partial: só parte dos ingredientes. relaxed: ingredientes
 * atendidos, mas algum filtro foi solto. related: nenhuma receita com o ingrediente,
 * mostrando parecidas. none: nada a mostrar. browse: pedido sem critérios.
 */
export type SearchMode = 'exact' | 'partial' | 'relaxed' | 'related' | 'none' | 'browse';

export interface RecipeHit {
  recipe: SearchableRecipe;
  score: number;
  /** Ingredientes pedidos (ou substitutos) encontrados nesta receita. */
  matched: string[];
}

export interface RecipeSearchResult {
  mode: SearchMode;
  hits: RecipeHit[];
  /** Filtros soltos para encontrar resultado (rótulos em português). */
  relaxed: string[];
  /** Ingredientes pedidos que nenhuma receita mostrada contém. */
  missing: string[];
  /** Ingredientes que existem no catálogo, mas só em receitas com algo excluído (alergia ou "sem X"). */
  blocked: string[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  vegan: 'Vegana',
  vegetarian: 'Vegetariana',
  glutenFree: 'Sem glúten',
  lowCarb: 'Baixo carboidrato',
  highProtein: 'Rica em proteína',
};

const DIFFICULTY_LABELS: Record<string, string> = { easy: 'fácil', medium: 'média', hard: 'difícil' };

// =============================================================================
// Texto
// =============================================================================

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'em', 'no',
  'na', 'nos', 'nas', 'com', 'para', 'pra', 'por', 'ao', 'aos', 'the', 'of', 'and', 'with',
]);

/** Radical simples para português (e plurais em inglês). Precisa ser igual dos dois lados, não perfeito. */
export function stem(token: string): string {
  let w = token;
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('oes') || w.endsWith('aes')) w = `${w.slice(0, -3)}ao`;
  else if (w.endsWith('ais')) w = `${w.slice(0, -3)}al`;
  else if (w.endsWith('eis')) w = `${w.slice(0, -3)}el`;
  else if (w.endsWith('ns')) w = `${w.slice(0, -2)}m`;
  else if (/(r|z|s)es$/.test(w)) w = w.slice(0, -2);
  else if (/[aeiou]s$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && /[aeo]$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function stems(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
    .map(stem);
}

// =============================================================================
// Alergias: um termo vira o grupo de alimentos que o contém
// =============================================================================

interface AllergenGroup {
  keys: string[];
  foods: string[];
  /** Linhas com estes trechos não contam (ex.: "leite de coco" não tem lactose). */
  except?: string[];
}

const ALLERGEN_GROUPS: AllergenGroup[] = [
  {
    keys: ['lactose', 'leite', 'laticinio', 'lacteo', 'derivados de leite', 'caseina'],
    foods: ['leite', 'queijo', 'iogurte', 'manteiga', 'creme de leite', 'requeijao', 'ricota', 'mussarela', 'muçarela',
      'parmesao', 'nata', 'chantilly', 'cream cheese', 'leite condensado', 'doce de leite', 'whey', 'coalhada',
      'cottage', 'ghee', 'kefir'],
    except: ['leite de coco', 'leite vegetal', 'leite de amendoa', 'leite de aveia', 'leite de soja', 'leite de castanha',
      'leite de arroz', 'sem lactose', 'manteiga de amendoim', 'manteiga de cacau', 'creme de coco', 'iogurte vegetal',
      'iogurte de coco', 'queijo vegano'],
  },
  {
    keys: ['gluten', 'trigo', 'celiac'],
    foods: ['trigo', 'farinha de trigo', 'pao', 'macarrao', 'massa', 'cevada', 'centeio', 'malte', 'semolina', 'bulgur',
      'triguilho', 'cuscuz marroquino', 'biscoito', 'torrada', 'farinha de rosca', 'cerveja'],
    except: ['sem gluten', 'pao sem gluten', 'massa sem gluten', 'macarrao de arroz'],
  },
  { keys: ['amendoim'], foods: ['amendoim', 'pasta de amendoim', 'manteiga de amendoim'] },
  {
    keys: ['castanha', 'noz', 'nozes', 'oleaginosa', 'amendoa'],
    foods: ['castanha', 'noz', 'amendoa', 'avela', 'pistache', 'macadamia', 'caju', 'peca'],
  },
  {
    keys: ['frutos do mar', 'fruto do mar', 'crustaceo', 'camarao', 'marisco', 'molusco'],
    foods: ['camarao', 'lagosta', 'caranguejo', 'siri', 'lula', 'polvo', 'marisco', 'mexilhao', 'ostra', 'vieira'],
  },
  {
    keys: ['peixe'],
    foods: ['peixe', 'salmao', 'atum', 'tilapia', 'sardinha', 'bacalhau', 'merluza', 'pescada', 'truta', 'anchova'],
  },
  { keys: ['ovo'], foods: ['ovo', 'gema', 'clara de ovo', 'maionese'], except: ['sem ovo'] },
  { keys: ['soja'], foods: ['soja', 'shoyu', 'molho de soja', 'tofu', 'edamame', 'misso'] },
];

/** Expande alergias/restrições em termos de busca ("lactose" -> leite, queijo, manteiga...). */
export function expandAllergens(terms: string[]): { terms: string[]; except: string[] } {
  const out = new Set<string>();
  const except = new Set<string>();
  for (const raw of terms) {
    const n = normalizeText(raw);
    if (n.length < 2) continue;
    out.add(n);
    for (const group of ALLERGEN_GROUPS) {
      if (group.keys.some((k) => n.includes(k))) {
        group.foods.forEach((f) => out.add(normalizeText(f)));
        group.except?.forEach((e) => except.add(normalizeText(e)));
      }
    }
  }
  return { terms: [...out], except: [...except] };
}

// =============================================================================
// Índice
// =============================================================================

interface IndexedRecipe {
  recipe: SearchableRecipe;
  lines: { norm: string; stems: Set<string> }[];
  title: Set<string>;
  description: Set<string>;
  everything: Set<string>;
}

function indexRecipe(recipe: SearchableRecipe): IndexedRecipe {
  const lines = (recipe.ingredients ?? []).map((line) => ({ norm: normalizeText(line), stems: new Set(stems(line)) }));
  const title = new Set(stems(recipe.title));
  const description = new Set(stems(recipe.description ?? ''));
  const everything = new Set<string>([...title, ...description, ...stems(CATEGORY_LABELS[recipe.category] ?? recipe.category)]);
  return { recipe, lines, title, description, everything };
}

const containsAll = (set: Set<string>, terms: string[]) => terms.length > 0 && terms.every((t) => set.has(t));

type Where = 'ingredients' | 'title' | 'description' | null;

function findIngredient(r: IndexedRecipe, query: IngredientQuery): Where {
  const forms = [query.name, ...(query.variants ?? [])].map(stems).filter((s) => s.length > 0);
  if (forms.some((f) => r.lines.some((l) => containsAll(l.stems, f)))) return 'ingredients';
  if (forms.some((f) => containsAll(r.title, f))) return 'title';
  if (forms.some((f) => containsAll(r.description, f))) return 'description';
  return null;
}

function hasExcluded(r: IndexedRecipe, terms: string[][], except: string[]): boolean {
  const lines = [...r.lines, { norm: normalizeText(r.recipe.title), stems: r.title }];
  return lines.some((line) =>
    !except.some((e) => line.norm.includes(e)) && terms.some((t) => containsAll(line.stems, t)),
  );
}

// =============================================================================
// Filtros
// =============================================================================

type FilterKey = 'minRating' | 'maxPrepTime' | 'difficulty' | 'keywords' | 'maxCalories' | 'minProtein' | 'category';

// Ordem em que os filtros são soltos quando não há resultado (do menos ao mais importante).
const RELAX_ORDER: FilterKey[] = ['minRating', 'maxPrepTime', 'difficulty', 'keywords', 'maxCalories', 'minProtein', 'category'];

const FILTER_LABELS: Record<FilterKey, string> = {
  minRating: 'avaliação mínima',
  maxPrepTime: 'tempo de preparo',
  difficulty: 'dificuldade',
  keywords: 'tipo de prato',
  maxCalories: 'limite de calorias',
  minProtein: 'proteína mínima',
  category: 'categoria',
};

function activeFilters(q: RecipeSearchQuery): FilterKey[] {
  return RELAX_ORDER.filter((k) => {
    if (k === 'keywords') return Boolean(q.keywords?.length || q.conceptIds?.length);
    const v = q[k];
    return typeof v === 'number' ? v > 0 : Boolean(v);
  });
}

function matchesKeywords(r: IndexedRecipe, q: RecipeSearchQuery): boolean {
  if (q.conceptIds?.includes(r.recipe.id)) return true;
  return (q.keywords ?? []).some((k) => containsAll(r.everything, stems(k)));
}

function passes(r: IndexedRecipe, q: RecipeSearchQuery, filters: FilterKey[]): boolean {
  const rec = r.recipe;
  return filters.every((k) => {
    switch (k) {
      case 'category': return rec.category === q.category;
      case 'difficulty': return rec.difficulty === q.difficulty;
      case 'maxPrepTime': return rec.prepTime > 0 && rec.prepTime <= (q.maxPrepTime as number);
      case 'minRating': return rec.rating >= (q.minRating as number);
      case 'maxCalories': return rec.calories > 0 && rec.calories <= (q.maxCalories as number);
      case 'minProtein': return rec.protein >= (q.minProtein as number);
      case 'keywords': return matchesKeywords(r, q);
    }
  });
}

// =============================================================================
// Busca
// =============================================================================

const WHERE_SCORE: Record<Exclude<Where, null>, number> = { ingredients: 10, title: 7, description: 3 };

function score(r: IndexedRecipe, q: RecipeSearchQuery, matchedWhere: Where[]): number {
  let s = matchedWhere.reduce((acc, w) => acc + (w ? WHERE_SCORE[w] : 0), 0);
  if (q.conceptIds?.includes(r.recipe.id)) s += 4;
  if ((q.keywords ?? []).some((k) => containsAll(r.title, stems(k)))) s += 3;
  return s + r.recipe.rating * 0.6;
}

function sortHits(hits: RecipeHit[], sort: SearchSort = 'relevance'): RecipeHit[] {
  const byRelevance = (a: RecipeHit, b: RecipeHit) => b.score - a.score || b.recipe.rating - a.recipe.rating;
  const cmp: Record<SearchSort, (a: RecipeHit, b: RecipeHit) => number> = {
    relevance: byRelevance,
    rating: (a, b) => b.recipe.rating - a.recipe.rating || byRelevance(a, b),
    quick: (a, b) => (a.recipe.prepTime || 999) - (b.recipe.prepTime || 999) || byRelevance(a, b),
    newest: (a, b) => (b.recipe.createdAt ?? '').localeCompare(a.recipe.createdAt ?? '') || byRelevance(a, b),
    low_calories: (a, b) => (a.recipe.calories || 9999) - (b.recipe.calories || 9999) || byRelevance(a, b),
    high_protein: (a, b) => b.recipe.protein - a.recipe.protein || byRelevance(a, b),
  };
  return hits.slice().sort(cmp[sort] ?? byRelevance);
}

/** Receitas sem nenhum ingrediente das alergias/restrições (com grupos expandidos). */
export function withoutAllergens<T extends SearchableRecipe>(recipes: T[], allergies: string[]): T[] {
  const blocked = expandAllergens(allergies);
  const blockedStems = blocked.terms.map(stems).filter((s) => s.length > 0);
  if (!blockedStems.length) return recipes;
  return recipes.filter((r) => !hasExcluded(indexRecipe(r), blockedStems, blocked.except));
}

/** Receitas que contêm todos os ingredientes informados (mesma regra da busca da IA). */
export function recipesWithIngredients<T extends SearchableRecipe>(recipes: T[], ingredients: string[]): { recipe: T; matched: string[] }[] {
  const queries = ingredients.map((name) => ({ name })).filter((q) => stems(q.name).length > 0);
  return recipes
    .map((recipe) => {
      const indexed = indexRecipe(recipe);
      const matched = queries.filter((q) => ['ingredients', 'title'].includes(findIngredient(indexed, q) ?? '')).map((q) => q.name);
      return { recipe, matched };
    })
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || b.recipe.rating - a.recipe.rating);
}

export function searchRecipes(
  recipes: SearchableRecipe[],
  query: RecipeSearchQuery,
  allergies: string[] = [],
): RecipeSearchResult {
  const limit = Math.min(Math.max(query.limit || 6, 1), 12);
  const blocked = expandAllergens([...(query.exclude ?? []), ...allergies]);
  const blockedStems = blocked.terms.map(stems).filter((s) => s.length > 0);

  const indexed = recipes.map(indexRecipe);
  const pool = indexed.filter((r) => !blockedStems.length || !hasExcluded(r, blockedStems, blocked.except));

  const includes = (query.include ?? []).filter((i) => stems(i.name).length > 0);
  const filters = activeFilters(query);

  const finish = (mode: SearchMode, hits: RecipeHit[], relaxed: string[] = []): RecipeSearchResult => {
    const shown = sortHits(hits, query.sort).slice(0, limit);
    const missing = mode === 'related' || mode === 'none'
      ? includes.map((i) => i.name)
      : includes.filter((i) => !shown.some((h) => h.matched.includes(i.name))).map((i) => i.name);
    const blockedNames = mode === 'related' || mode === 'none'
      ? missing.filter((name) => indexed.some((r) => findIngredient(r, includes.find((i) => i.name === name)!) === 'ingredients'))
      : [];
    return { mode, hits: shown, relaxed, missing, blocked: blockedNames };
  };

  // Tenta com todos os filtros e depois soltando um por vez, do menos importante ao mais.
  const withRelax = (build: (active: FilterKey[]) => RecipeHit[]): { hits: RecipeHit[]; relaxed: string[] } => {
    let active = filters.slice();
    const relaxed: string[] = [];
    for (;;) {
      const hits = build(active);
      if (hits.length || !active.length) return { hits, relaxed };
      const drop = RELAX_ORDER.find((k) => active.includes(k)) as FilterKey;
      active = active.filter((k) => k !== drop);
      relaxed.push(FILTER_LABELS[drop]);
    }
  };

  if (includes.length) {
    const located = pool.map((r) => ({ r, where: includes.map((i) => findIngredient(r, i)) }));

    const all = withRelax((active) =>
      located
        .filter(({ r, where }) => where.every(Boolean) && passes(r, query, active))
        .map(({ r, where }) => ({ recipe: r.recipe, score: score(r, query, where), matched: includes.map((i) => i.name) })),
    );
    if (all.hits.length) return finish(all.relaxed.length ? 'relaxed' : 'exact', all.hits, all.relaxed);

    if (includes.length > 1) {
      const some = withRelax((active) =>
        located
          .filter(({ r, where }) => where.some(Boolean) && passes(r, query, active))
          .map(({ r, where }) => ({
            recipe: r.recipe,
            score: score(r, query, where),
            matched: includes.filter((_, i) => where[i]).map((i) => i.name),
          })),
      );
      if (some.hits.length) return finish('partial', some.hits, some.relaxed);
    }

    const substitutes = (query.substitutes ?? []).filter((s) => stems(s).length > 0);
    if (substitutes.length) {
      const related = pool
        .map((r) => {
          const found = substitutes.filter((s) => findIngredient(r, { name: s }) === 'ingredients');
          return { r, found };
        })
        .filter(({ found }) => found.length)
        .map(({ r, found }) => ({ recipe: r.recipe, score: found.length * 10 + r.recipe.rating * 0.6, matched: found }));
      if (related.length) return finish('related', related);
    }

    return finish('none', []);
  }

  if (!filters.length) {
    return finish('browse', pool.map((r) => ({ recipe: r.recipe, score: r.recipe.rating, matched: [] })));
  }

  const filtered = withRelax((active) =>
    pool.filter((r) => passes(r, query, active)).map((r) => ({ recipe: r.recipe, score: score(r, query, []), matched: [] })),
  );
  if (filtered.hits.length) return finish(filtered.relaxed.length ? 'relaxed' : 'exact', filtered.hits, filtered.relaxed);
  return finish('none', []);
}

// =============================================================================
// Plano local (sem IA): entende pedidos comuns pelo vocabulário do catálogo
// =============================================================================

const DISH_WORDS = [
  'bolo', 'torta', 'salada', 'sopa', 'caldo', 'panqueca', 'omelete', 'smoothie', 'vitamina', 'suco', 'cookie', 'biscoito',
  'muffin', 'risoto', 'bowl', 'wrap', 'sanduiche', 'lanche', 'sobremesa', 'doce', 'mousse', 'pudim', 'creme', 'molho',
  'hamburguer', 'pizza', 'estrogonofe', 'crepe', 'tapioca', 'granola', 'barrinha', 'brownie', 'sorvete', 'salgado',
  'cafe da manha', 'almoco', 'jantar', 'petisco', 'entrada', 'acompanhamento', 'bebida', 'pao', 'massa', 'macarrao',
];

const KNOWN_FOODS = [
  'morango', 'banana', 'maca', 'manga', 'abacaxi', 'laranja', 'limao', 'uva', 'pera', 'pessego', 'melao', 'melancia',
  'kiwi', 'mamao', 'maracuja', 'goiaba', 'framboesa', 'amora', 'mirtilo', 'abacate', 'acai', 'coco', 'figo', 'tamara',
  'brocolis', 'couve flor', 'cenoura', 'abobrinha', 'berinjela', 'espinafre', 'couve', 'alface', 'rucula', 'repolho',
  'beterraba', 'pepino', 'pimentao', 'tomate', 'abobora', 'mandioca', 'batata', 'batata doce', 'inhame', 'quiabo',
  'vagem', 'ervilha', 'milho', 'cogumelo', 'palmito', 'cebola', 'alho', 'gengibre', 'feijao', 'lentilha',
  'grao de bico', 'soja', 'tofu', 'carne', 'carne moida', 'frango', 'peru', 'porco', 'bacon', 'linguica', 'salmao',
  'tilapia', 'atum', 'sardinha', 'bacalhau', 'peixe', 'camarao', 'ovo', 'leite', 'queijo', 'iogurte', 'ricota',
  'requeijao', 'arroz', 'aveia', 'quinoa', 'chia', 'linhaca', 'castanha', 'nozes', 'amendoa', 'amendoim', 'chocolate',
  'cacau', 'mel', 'canela', 'whey', 'tapioca', 'farinha', 'macarrao', 'massa',
];

const DISH_STEMS = DISH_WORDS.map(stems);
const FOOD_STEMS = KNOWN_FOODS.map(stems);

const LOCAL_CATEGORY: [RegExp, string][] = [
  [/\bvegan[oa]s?\b|\bvegan\b/, 'vegan'],
  [/\bvegetarian[oa]s?\b|\bveggie\b/, 'vegetarian'],
  [/\bsem gluten\b|\bgluten free\b/, 'glutenFree'],
  [/\blow ?carb\b|\bbaixo carbo/, 'lowCarb'],
  [/\b(rica?s? em|alta|muita) proteina\b|\bproteic[oa]s?\b|\bhigh protein\b/, 'highProtein'],
];

const FILLER = new Set([
  'receita', 'quero', 'queria', 'gostaria', 'me', 'mostra', 'mostre', 'mostrar', 'traga', 'tem', 'tenho', 'ter', 'algo',
  'alguma', 'algum', 'ideia', 'ideias', 'sugestao', 'sugere', 'sugira', 'fazer', 'faco', 'preparar', 'cozinhar', 'usar',
  'usando', 'que', 'qual', 'quais', 'pode', 'poderia', 'voce', 'oi', 'ola', 'por', 'favor', 'aqui', 'casa', 'sobrando',
  'gostoso', 'gostosa', 'boa', 'bom', 'facil', 'faceis', 'rapido', 'rapida', 'min', 'minuto', 'kcal', 'caloria',
  'estrela', 'nota', 'sem', 'leve', 'leves', 'saudavel', 'saudaveis', 'hoje', 'agora', 'pro', 'pra', 'mais', 'menos',
  'ate', 'top', 'melhor', 'melhores', 'vegana', 'vegano', 'vegetariana', 'vegetariano', 'gluten', 'low', 'carb',
  'proteina', 'rica', 'baixo', 'alta', 'muita', 'eu', 'minha', 'meu', 'isso', 'esse', 'essa', 'tipo',
  // Medidas e preparo que aparecem nas linhas de ingredientes, mas não são ingredientes.
  'xicara', 'colher', 'cha', 'picado', 'ralado', 'cozido', 'fatia', 'pitada', 'gosto', 'dente', 'unidade', 'grande',
  'pequeno', 'medio', 'litro', 'ml', 'grama', 'kg', 'copo', 'lata', 'pacote', 'folha', 'ramo', 'cubo', 'fresco',
  // Conversa comum ("oi, tudo bem?") que também aparece no modo de preparo.
  'tudo', 'bem', 'muito', 'pouco', 'como', 'quando', 'onde', 'porque', 'obrigado', 'obrigada', 'valeu', 'sim', 'nao',
  'dia', 'noite', 'tarde', 'semana', 'gente', 'coisa', 'jeito', 'forma', 'vez', 'outro', 'outra', 'novo', 'nova',
].map(stem));

/** Monta um plano de busca sem IA. Ingredientes = palavras conhecidas do catálogo ou de uma lista de alimentos. */
export function parseQueryLocally(text: string, recipes: SearchableRecipe[]): RecipeSearchQuery & { isRecipeRequest: boolean } {
  const n = normalizeText(text);
  const q: RecipeSearchQuery & { isRecipeRequest: boolean } = { isRecipeRequest: false };

  for (const [re, key] of LOCAL_CATEGORY) if (re.test(n)) { q.category = key; break; }
  if (/\bfac(il|eis)\b|\bsimples\b/.test(n)) q.difficulty = 'easy';
  else if (/\bdificil|dificeis|elaborad/.test(n)) q.difficulty = 'hard';

  const minutes = n.match(/\b(\d{1,3})\s*(min|minuto)/);
  if (minutes) q.maxPrepTime = Number(minutes[1]);
  else if (/\brapid[oa]s?\b|\bpratic[oa]s?\b/.test(n)) q.maxPrepTime = 20;

  const kcal = n.match(/\b(\d{2,4})\s*(kcal|caloria)/);
  if (kcal) q.maxCalories = Number(kcal[1]);
  const stars = n.match(/\b([1-5](?:[.,]5)?)\s*(\+|estrela)/);
  if (stars) q.minRating = Number(stars[1].replace(',', '.'));
  if (/\bmelhor(es)? avaliad|\bmais bem avaliad|\bmelhores\b/.test(n)) q.sort = 'rating';
  if (/\bmenos calori|\bmais leve/.test(n)) q.sort = 'low_calories';

  // "sem X" vira exclusão; o resto do texto é procurado como ingrediente ou tipo de prato.
  const exclude: string[] = [];
  const rest = n.replace(/\bsem ([a-z]+(?: de [a-z]+)?)/g, (_, what: string) => {
    if (what !== 'gluten') exclude.push(what);
    return ' ';
  });
  if (/\bsem gluten\b/.test(n) && q.category !== 'glutenFree') exclude.push('gluten');
  if (exclude.length) q.exclude = exclude;

  const catalogStems = new Set<string>();
  for (const r of recipes) for (const line of r.ingredients ?? []) stems(line).forEach((s) => catalogStems.add(s));

  const words = rest.split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  const tokens = words.map(stem);
  const include: IngredientQuery[] = [];
  const keywords: string[] = [];
  const used = new Set<number>();

  // Primeiro nomes compostos ("grão de bico", "batata doce", "café da manhã"), depois palavras soltas.
  const takePhrases = (list: string[][], onMatch: (words: string[]) => void) => {
    for (const phrase of list.filter((p) => p.length > 1)) {
      for (let i = 0; i + phrase.length <= tokens.length; i++) {
        if (phrase.every((p, j) => tokens[i + j] === p && !used.has(i + j))) {
          phrase.forEach((_, j) => used.add(i + j));
          onMatch(phrase);
        }
      }
    }
  };
  takePhrases(DISH_STEMS, (p) => keywords.push(DISH_WORDS[DISH_STEMS.indexOf(p)]));
  takePhrases(FOOD_STEMS, (p) => include.push({ name: KNOWN_FOODS[FOOD_STEMS.indexOf(p)] }));

  tokens.forEach((t, i) => {
    if (used.has(i) || FILLER.has(t) || t.length < 3) return;
    const dish = DISH_STEMS.findIndex((d) => d.length === 1 && d[0] === t);
    if (dish >= 0) keywords.push(DISH_WORDS[dish]);
    else if (catalogStems.has(t) || FOOD_STEMS.some((f) => f.length === 1 && f[0] === t)) include.push({ name: words[i] });
  });

  if (include.length) q.include = include.filter((v, i, arr) => arr.findIndex((x) => stems(x.name).join() === stems(v.name).join()) === i);
  if (keywords.length) q.keywords = [...new Set(keywords)];
  q.isRecipeRequest = Boolean(
    /\breceit|\bprato\b|\bcomida\b|\bcozinh|\bfazer\b|\bpreparar\b|\bideia/.test(n) ||
      q.include?.length || q.keywords?.length || q.category || q.difficulty || q.maxPrepTime || q.maxCalories || q.minRating,
  );
  return q;
}

// =============================================================================
// Texto de resposta sem IA
// =============================================================================

const joinPt = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;

export function describeQuery(q: RecipeSearchQuery): string {
  const parts: string[] = [];
  if (q.include?.length) parts.push(`com ${joinPt(q.include.map((i) => i.name))}`);
  if (q.exclude?.length) parts.push(`sem ${joinPt(q.exclude)}`);
  if (q.category && CATEGORY_LABELS[q.category]) parts.push(CATEGORY_LABELS[q.category].toLowerCase());
  if (q.keywords?.length) parts.push(`tipo ${joinPt(q.keywords)}`);
  if (q.difficulty && DIFFICULTY_LABELS[q.difficulty]) parts.push(`dificuldade ${DIFFICULTY_LABELS[q.difficulty]}`);
  if (q.maxPrepTime) parts.push(`até ${q.maxPrepTime} min`);
  if (q.maxCalories) parts.push(`até ${q.maxCalories} kcal`);
  if (q.minProtein) parts.push(`pelo menos ${q.minProtein} g de proteína`);
  if (q.minRating) parts.push(`nota ${q.minRating}+`);
  return parts.join(', ');
}

export function composeLocalReply(q: RecipeSearchQuery, result: RecipeSearchResult): string {
  const asked = describeQuery(q);
  const missing = joinPt(result.missing.map((m) => `**${m}**`));
  switch (result.mode) {
    case 'exact':
      return asked ? `Encontrei estas receitas ${asked}:` : 'Separei estas receitas para você:';
    case 'relaxed':
      return `Não achei receitas com todos os critérios, então soltei ${joinPt(result.relaxed)}. Estas são as mais próximas${asked ? ` (${asked})` : ''}:`;
    case 'partial':
      return `Nenhuma receita tem tudo junto. Estas têm parte do que você pediu${missing ? ` (faltando ${missing})` : ''}:`;
    case 'related':
      return result.blocked.length
        ? `As receitas com ${missing} do catálogo levam algo que você pediu para evitar. Estas usam ingredientes parecidos:`
        : `Ainda não temos receitas com ${missing} no catálogo. Estas usam ingredientes parecidos e podem te agradar:`;
    case 'none':
      if (result.blocked.length) {
        return `As receitas com ${missing} do catálogo levam algo que você pediu para evitar${q.exclude?.length ? ` (${joinPt(q.exclude)})` : ' (alergias do seu perfil)'}.`;
      }
      return missing
        ? `Ainda não temos receitas com ${missing} no catálogo. Tente outro ingrediente ou peça uma sugestão de preparo.`
        : 'Não encontrei receitas com esses critérios. Tente tirar algum filtro.';
    case 'browse':
      return 'Estas são algumas das receitas mais bem avaliadas do catálogo:';
  }
}
