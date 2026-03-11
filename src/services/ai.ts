// src/services/ai.ts
import { supabase } from '../lib/supabase';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import { getGeminiResponse } from './gemini';

// =============================================================================
// Tipos
// =============================================================================
type Difficulty = 'easy' | 'medium' | 'hard';
type SiteCategory =
  | 'Vegana'
  | 'Baixo Carboidrato'
  | 'Rica em Proteína'
  | 'Sem Glúten'
  | 'Vegetariana';

type SortKey = 'rating' | 'prepTime' | 'newest';

interface RecipeRow {
  id: string;
  title: string;
  description: string;
  image: string;
  prep_time: number;
  difficulty: Difficulty;
  rating: number | null;
  category: string;
  ingredients: string[];
  author_id?: string | null;
  author_name?: string | null;
  nutrition_facts?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    [k: string]: any;
  } | null;
  reviews?: { rating: number }[];
  created_at?: string;
  updated_at?: string;
}

interface AppRecipeCard {
  id: number;
  title: string;
  description: string;
  author: string;
  rating: number;
}

interface ParsedFilters {
  category?: SiteCategory;
  difficulty?: Difficulty;
  maxPrep?: number;
  minPrep?: number;
  minRating?: number;
  wantAll?: boolean;
  plainSearch?: string;
  ingredients?: string[];
  limit?: number;
  sort?: SortKey;
  hasStructuredFilter?: boolean;
}

// =============================================================================
// Vocabulário
// =============================================================================
const DIFFICULTY_SYNONYMS: Record<Difficulty, string[]> = {
  easy: ['fácil', 'facil', 'fáceis', 'faceis', 'facinha', 'facinho', 'simples', 'iniciante', 'tranquila', 'descomplicada', 'easy', 'simple', 'beginner', 'quick'],
  medium: ['médio', 'medio', 'intermediário', 'intermediario', 'média', 'mediana', 'medium', 'average', 'intermediate', 'normal'],
  hard: ['difícil', 'dificil', 'difíceis', 'dificeis', 'avançado', 'avancado', 'complexo', 'trabalhosa', 'desafiadora', 'hard', 'difficult', 'advanced', 'complex', 'challenging'],
};

const CATEGORY_LABELS: SiteCategory[] = [
  'Vegana',
  'Baixo Carboidrato',
  'Rica em Proteína',
  'Sem Glúten',
  'Vegetariana',
];

const CATEGORY_SYNONYMS: Record<SiteCategory, string[]> = {
  'Vegana': ['vegana', 'vegano', 'vegan'],
  'Baixo Carboidrato': ['baixo carboidrato', 'low carb', 'pouco carbo', 'baixo carb', 'lowcarb'],
  'Rica em Proteína': ['rica em proteína', 'muita proteina', 'alta proteína', 'alto teor proteico', 'proteica', 'proteinado', 'protein rich', 'high protein'],
  'Sem Glúten': ['sem glúten', 'sem gluten', 'gluten free', 'sg', 'livre de glúten'],
  'Vegetariana': ['vegetariana', 'vegetariano', 'veggie', 'ovo-lacto', 'ovolacto', 'vegetarian'],
};

const CATEGORY_EN_ALIASES: Record<string, SiteCategory> = {
  'vegan': 'Vegana',
  'vegetarian': 'Vegetariana',
  'gluten-free': 'Sem Glúten',
  'gluten free': 'Sem Glúten',
  'low carb': 'Baixo Carboidrato',
  'low-carb': 'Baixo Carboidrato',
  'high protein': 'Rica em Proteína',
  'protein rich': 'Rica em Proteína',
};

const NUM_RE = /(\d+(?:[.,]\d+)?)/;

// Palavras que indicam busca por ingrediente
const INGREDIENT_TRIGGERS = [
  'com ', 'usando ', 'que tenha ', 'que tenham ', 'que use ', 'que usem ',
  'feita com ', 'feitas com ', 'feito com ', 'feitos com ',
  'a base de ', 'à base de ', 'contendo ', 'ingrediente ',
  'usando ', 'utilizando ', 'que leve ', 'que levem ',
];

// Palavras genéricas a ignorar
const STOPWORDS = new Set([
  'receita', 'receitas', 'quero', 'queria', 'gostaria', 'me', 'mostra', 'mostrar', 'mostre', 'traga', 'trazer',
  'uma', 'umas', 'um', 'uns', 'de', 'do', 'da', 'no', 'na', 'em', 'pra', 'para', 'por', 'a', 'o', 'as', 'os',
  'ai', 'ia', 'porfavor', 'por', 'favor', 'bom', 'boa',
]);

// =============================================================================
// Utils
// =============================================================================
function uuidToNumericId(uuid: string): number {
  const hex = uuid.replace(/-/g, '').slice(0, 8);
  return parseInt(hex, 16);
}

function toSafeString(v: any): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

function normalize(s: any): string {
  return toSafeString(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function round1(n: number | null | undefined): number {
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return Math.round(Number(n) * 10) / 10;
}

function avgRating(reviews?: { rating: number }[] | null): number {
  if (!reviews?.length) return 0;
  const m = reviews.reduce((a, r) => a + (r.rating ?? 0), 0) / reviews.length;
  return round1(m);
}

function mapRowToCard(r: RecipeRow): AppRecipeCard {
  const rating = (typeof r.rating === 'number' ? r.rating : avgRating(r.reviews)) || 0;
  return {
    id: uuidToNumericId(r.id),
    title: r.title,
    description: r.description,
    author: r.author_name || 'NutriChefe',
    rating,
  };
}

function canonicalSiteCategory(value: string): SiteCategory | null {
  const n = normalize(value).trim();
  if (CATEGORY_EN_ALIASES[n]) return CATEGORY_EN_ALIASES[n];
  for (const cat of CATEGORY_LABELS) {
    const syns = CATEGORY_SYNONYMS[cat].map(normalize);
    if (syns.some(s => n === s || n.includes(s) || s.includes(n))) return cat;
  }
  return null;
}

function normalizeDifficultyValue(value: string): Difficulty {
  const n = normalize(value);
  if (n === 'easy' || n === 'medium' || n === 'hard') return n as Difficulty;
  if (/\bfac(eis|il|inha|inho|inhas|inhos)?\b/.test(n) || n.includes('simples')) return 'easy';
  if (/\bmedi/.test(n)) return 'medium';
  if (/\bdific/.test(n) || /\bhard\b/.test(n) || /\bdifficult\b/.test(n)) return 'hard';
  return 'medium';
}

// =============================================================================
// Extrator de ingredientes do texto natural
// =============================================================================
function extractIngredients(q: string): string[] {
  const text = normalize(q);
  const ingredients: string[] = [];

  // 1) Detecta padrões explícitos: "com banana", "usando frango", "que tenha aveia"
  for (const trigger of INGREDIENT_TRIGGERS) {
    const trigNorm = normalize(trigger);
    const idx = text.indexOf(trigNorm);
    if (idx === -1) continue;

    const after = text.slice(idx + trigNorm.length).trim();
    // Pega até o próximo conector ou fim
    const segment = after.split(/\b(e |, |ou |\.|pra |para )/)[0].trim();
    if (segment && segment.length > 2 && !STOPWORDS.has(segment)) {
      // Split por "e" ou vírgula para múltiplos ingredientes
      const parts = segment.split(/\s*(?:,|e )\s*/).map(s => s.trim()).filter(s => s.length > 2);
      ingredients.push(...parts);
    }
  }

  // 2) Tenta identificar alimentos conhecidos diretamente no texto
  // Lista ampla de alimentos comuns em receitas brasileiras
  const COMMON_FOODS = [
    'banana', 'maca', 'abacate', 'morango', 'limao', 'laranja', 'mamao', 'abacaxi', 'uva', 'manga',
    'frango', 'carne', 'peixe', 'atum', 'salmao', 'camarao', 'ovo', 'ovos', 'carne moida', 'peito',
    'arroz', 'feijao', 'lentilha', 'grao de bico', 'ervilha', 'milho', 'batata', 'batata doce', 'inhame',
    'aveia', 'quinoa', 'chia', 'linhaça', 'amendoim', 'castanha', 'nozes', 'amendoas',
    'leite', 'iogurte', 'queijo', 'requeijao', 'manteiga', 'creme de leite', 'leite de coco',
    'chocolate', 'cacau', 'mel', 'acucar', 'adocante', 'stevia',
    'tomate', 'cebola', 'alho', 'cenoura', 'brocolis', 'espinafre', 'couve', 'abobrinha', 'berinjela',
    'cogumelo', 'champignon', 'shitake',
    'farinha', 'farinha de trigo', 'farinha de aveia', 'amido', 'polvilho', 'fuba',
    'whey', 'proteina', 'colagem',
    'azeite', 'oleo', 'vinagre', 'molho de tomate', 'extrato de tomate',
    'gengibre', 'canela', 'curcuma', 'curry', 'oregano', 'manjericao',
    'pasta de amendoim', 'tahine',
  ];

  // Só extrair alimentos se não houver ingrediente já detectado por trigger
  if (ingredients.length === 0) {
    for (const food of COMMON_FOODS) {
      const foodNorm = normalize(food);
      // Verifica se o alimento aparece como palavra completa no texto
      const regex = new RegExp(`\\b${foodNorm.replace(/\s+/g, '\\s+')}\\b`);
      if (regex.test(text)) {
        // Garante que não é parte de uma negação ("sem banana")
        const negRegex = new RegExp(`\\bsem\\s+${foodNorm}\\b`);
        if (!negRegex.test(text)) {
          ingredients.push(food);
        }
      }
    }
  }

  // Deduplica
  return Array.from(new Set(ingredients.filter(Boolean)));
}

// =============================================================================
// Parser de linguagem natural -> filtros
// =============================================================================
function parseCount(text: string): number | undefined {
  const m = text.match(/\b(top|s[oó]|somente|apenas|mostrar|mostra|traga|trazer)?\s*(\d{1,3})\b/);
  if (!m) return undefined;
  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, 100);
}

function parseSort(text: string): SortKey | undefined {
  if (/\b(nota|avalia|melhores|melhor|maior(es)? nota|rank|mais bem avaliadas?)\b/.test(text)) return 'rating';
  if (/\btempo|rapidez|mais r[aá]pidas?|r[aá]pido(s)? primeiro\b/.test(text)) return 'prepTime';
  if (/\bnovo(s)?|recent(es)?|mais recente(s)?\b/.test(text)) return 'newest';
  return undefined;
}

function pickPlainSearchSource(q: string): string | undefined {
  const tokens = normalize(q)
    .split(/\s+/)
    .filter(Boolean)
    .filter(tok => !STOPWORDS.has(tok))
    .join(' ')
    .trim();
  if (!tokens || tokens.length <= 2) return undefined;
  return tokens;
}

function parseQueryToFilters(q: string): ParsedFilters {
  const text = normalize(q);
  const f: ParsedFilters = {};

  // Categoria
  for (const cat of CATEGORY_LABELS) {
    const syns = CATEGORY_SYNONYMS[cat].map(normalize);
    if (syns.some(s => text.includes(s))) {
      f.category = cat;
      break;
    }
  }

  // Dificuldade
  for (const [key, syns] of Object.entries(DIFFICULTY_SYNONYMS)) {
    if (syns.some(s => text.includes(normalize(s)))) {
      f.difficulty = key as Difficulty;
      break;
    }
  }
  if (!f.difficulty) {
    if (/\bfac(eis|il|inha|inho|inhas|inhos)?\b/.test(text) || /\beasy\b|\bsimple\b/.test(text)) f.difficulty = 'easy';
    else if (/\bm[eé]di[oa]\b|\bmedium\b/.test(text)) f.difficulty = 'medium';
    else if (/\bdific(?:eis|il)\b|\bhard\b|\bdifficult\b/.test(text)) f.difficulty = 'hard';
  }

  // Tempo
  if (/\br[aá]pid[oa]s?\b/.test(text) || /\b<=?\s*15\b/.test(text)) f.maxPrep = 15;
  if (/\bm[eé]di[oa]\b/.test(text) || /\b<=?\s*30\b/.test(text)) f.maxPrep = f.maxPrep ?? 30;
  if (/\blongo?s?\b|\b>?\s*30\b/.test(text)) f.minPrep = 31;
  const mTime = text.match(new RegExp(`\\b(em|ate|até|<=?)\\s*${NUM_RE.source}\\s*(min|mins|minutos)\\b`));
  if (mTime) {
    const mins = parseFloat(mTime[2].replace(',', '.'));
    if (!isNaN(mins)) f.maxPrep = Math.min(f.maxPrep ?? Infinity, mins);
  }

  // Avaliação
  const starPlus = text.match(new RegExp(`${NUM_RE.source}\\s*(\\+|mais)?\\s*(\\*|estrela|estrelas)?`));
  if (starPlus) {
    const val = parseFloat(starPlus[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0 && val <= 5) {
      if (/\+|mais/.test(starPlus[2] || '') || /estrela|\*/.test(starPlus[3] || '')) {
        f.minRating = val;
      }
    }
  }
  if (/\b4\+\b/.test(text)) f.minRating = Math.max(f.minRating ?? 0, 4);
  if (/\b4[.,]5\+\b/.test(text)) f.minRating = Math.max(f.minRating ?? 0, 4.5);
  if (/\b5\s*(\*|estrelas?)?\b/.test(text)) f.minRating = 5;

  // Todos
  if (/\btod[ao]s?\b|\bqualquer\b/.test(text)) f.wantAll = true;

  // Quantidade e ordenação
  f.limit = parseCount(text) ?? undefined;
  f.sort = parseSort(text) ?? undefined;

  // Ingredientes (NOVO)
  const detectedIngredients = extractIngredients(q);
  if (detectedIngredients.length > 0) {
    f.ingredients = detectedIngredients;
  }

  // Marcador de filtro estruturado
  f.hasStructuredFilter = Boolean(
    f.category || f.difficulty || f.maxPrep || f.minPrep || f.minRating || f.ingredients?.length
  );

  // Busca textual livre (quando nenhum filtro estruturado encontrado)
  const maybePlain = pickPlainSearchSource(q);
  if (!f.hasStructuredFilter && maybePlain) f.plainSearch = maybePlain;

  return f;
}

// =============================================================================
// DB — busca receitas com ingredientes
// =============================================================================
async function fetchRecipesFromDB(): Promise<RecipeRow[]> {
  try {
    const { data: recipeRows, error: recipesErr } = await supabase
      .from('recipes')
      .select('id, title, description, image, prep_time, difficulty, category, rating, nutrition_facts, ingredients, author_id, created_at, updated_at');

    if (recipesErr) {
      console.warn('Erro ao buscar receitas:', recipesErr);
      return [];
    }

    const rows = (recipeRows || []) as Array<{
      id: string;
      title: string;
      description: string;
      image: string;
      prep_time: number;
      difficulty: string;
      category: string;
      rating: number | null;
      nutrition_facts?: any | null;
      ingredients?: any;
      author_id: string | null;
      created_at?: string;
      updated_at?: string;
    }>;

    if (rows.length === 0) return [];

    // Autores
    const authorIds = Array.from(new Set(rows.map(r => r.author_id).filter(Boolean))) as string[];
    let authorsMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', authorIds);
      if (profiles) {
        authorsMap = Object.fromEntries(
          profiles.map(p => [p.id as string, (p.full_name as string) || 'NutriChefe'])
        );
      }
    }

    // Reviews -> média
    const recipeIds = rows.map(r => r.id);
    const { data: reviews } = await supabase
      .from('reviews')
      .select('recipe_id, rating')
      .in('recipe_id', recipeIds);

    const ratingsAgg: Record<string, { sum: number; count: number }> = {};
    if (reviews?.length) {
      for (const r of reviews as Array<{ recipe_id: string; rating: number }>) {
        if (!ratingsAgg[r.recipe_id]) ratingsAgg[r.recipe_id] = { sum: 0, count: 0 };
        ratingsAgg[r.recipe_id].sum += r.rating ?? 0;
        ratingsAgg[r.recipe_id].count += 1;
      }
    }

    const result: RecipeRow[] = rows.map(r => {
      const agg = ratingsAgg[r.id];
      let effectiveRating: number | null = null;
      if (agg && agg.count > 0) {
        effectiveRating = round1(agg.sum / agg.count);
      } else if (r.rating !== null && r.rating !== undefined) {
        const num = Number(r.rating);
        effectiveRating = Number.isFinite(num) && num > 0 ? round1(num) : null;
      }

      const catCanon = canonicalSiteCategory(r.category) ?? r.category;
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        image: r.image,
        prep_time: r.prep_time,
        difficulty: normalizeDifficultyValue(r.difficulty),
        category: catCanon,
        rating: effectiveRating,
        ingredients,
        author_id: r.author_id,
        author_name: (r.author_id && authorsMap[r.author_id]) ? authorsMap[r.author_id] : 'NutriChefe',
        nutrition_facts: r.nutrition_facts || null,
        reviews: [],
        created_at: r.created_at,
        updated_at: r.updated_at,
      } as RecipeRow;
    });

    return result;
  } catch (error) {
    console.warn('Erro crítico em fetchRecipesFromDB:', error);
    return [];
  }
}

// =============================================================================
// Filtro por ingredientes — busca flexível
// =============================================================================
function recipeMatchesIngredients(recipe: RecipeRow, requestedIngredients: string[]): boolean {
  if (!requestedIngredients.length) return true;

  const ingredientText = [
    ...recipe.ingredients.map(normalize),
    normalize(recipe.title),
    normalize(recipe.description),
  ].join(' ');

  // A receita precisa ter pelo menos UM dos ingredientes pedidos
  return requestedIngredients.some(ing => {
    const ingNorm = normalize(ing);
    return ingredientText.includes(ingNorm);
  });
}

// Calcula score de relevância para ordenar por ingredientes
function ingredientScore(recipe: RecipeRow, requestedIngredients: string[]): number {
  if (!requestedIngredients.length) return 0;
  const ingredientText = recipe.ingredients.map(normalize).join(' ');
  let score = 0;
  for (const ing of requestedIngredients) {
    if (ingredientText.includes(normalize(ing))) score += 2;
    else if (normalize(recipe.title).includes(normalize(ing))) score += 1;
  }
  return score;
}

// =============================================================================
// Filtro + ordenação + relaxamento
// =============================================================================
function applyFiltersBase(rows: RecipeRow[], f: ParsedFilters): RecipeRow[] {
  let list = rows.slice();

  if (f.category) {
    list = list.filter(r => (canonicalSiteCategory(r.category) ?? r.category) === f.category);
  }

  if (f.difficulty) {
    list = list.filter(r => r.difficulty === f.difficulty);
  }

  if (typeof f.maxPrep === 'number') list = list.filter(r => r.prep_time <= (f.maxPrep as number));
  if (typeof f.minPrep === 'number') list = list.filter(r => r.prep_time >= (f.minPrep as number));

  if (typeof f.minRating === 'number') {
    list = list.filter(r => (typeof r.rating === 'number' ? r.rating : 0) >= (f.minRating as number));
  }

  // Filtro por ingredientes (NOVO)
  if (f.ingredients?.length) {
    list = list.filter(r => recipeMatchesIngredients(r, f.ingredients!));
  }

  if (f.plainSearch) {
    const n = normalize(f.plainSearch);
    list = list.filter(r =>
      normalize(r.title).includes(n) ||
      normalize(r.description || '').includes(n)
    );
  }

  return list;
}

function sortList(list: RecipeRow[], sort?: SortKey, ingredients?: string[]): RecipeRow[] {
  const arr = list.slice();

  // Se há ingredientes, ordena por relevância primeiro
  if (ingredients?.length) {
    arr.sort((a, b) => {
      const scoreB = ingredientScore(b, ingredients) + (b.rating ?? 0) * 0.5;
      const scoreA = ingredientScore(a, ingredients) + (a.rating ?? 0) * 0.5;
      return scoreB - scoreA;
    });
    return arr;
  }

  if (sort === 'prepTime') {
    arr.sort((a, b) => a.prep_time - b.prep_time || ((b.rating ?? 0) - (a.rating ?? 0)));
  } else if (sort === 'newest') {
    arr.sort((a, b) => (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime()));
  } else {
    arr.sort((a, b) => {
      const ar = a.rating ?? 0;
      const br = b.rating ?? 0;
      if (br !== ar) return br - ar;
      return a.prep_time - b.prep_time;
    });
  }
  return arr;
}

function capAndMap(list: RecipeRow[], limit = 12): AppRecipeCard[] {
  return list.slice(0, limit).map(mapRowToCard);
}

function progressiveRelax(rows: RecipeRow[], f: ParsedFilters): { list: RecipeRow[]; relaxed: string[] } {
  const relaxed: string[] = [];

  // Ordem de relaxamento: avaliação → tempo → categoria → dificuldade → ingredientes (parcial)
  const attempts: Array<{ label: string; tweak: (g: ParsedFilters) => void }> = [
    { label: 'avaliação mínima', tweak: g => { if (typeof g.minRating === 'number') delete g.minRating; } },
    { label: 'tempo de preparo', tweak: g => { if (typeof g.maxPrep === 'number') delete g.maxPrep; } },
    { label: 'categoria', tweak: g => { if (g.category) delete g.category; } },
    { label: 'dificuldade', tweak: g => { if (g.difficulty) delete g.difficulty; } },
    {
      label: 'ingredientes (busca parcial)',
      tweak: g => {
        if (g.ingredients && g.ingredients.length > 1) {
          g.ingredients = [g.ingredients[0]];
        }
      }
    },
  ];

  for (const attempt of attempts) {
    const g = { ...f, ingredients: f.ingredients ? [...f.ingredients] : undefined };
    attempt.tweak(g);
    const current = applyFiltersBase(rows, g);
    if (current.length > 0) {
      relaxed.push(attempt.label);
      return { list: current, relaxed };
    }
  }

  return { list: rows.slice(), relaxed: ['todos os filtros'] };
}

// =============================================================================
// Intents
// =============================================================================
type ChatIntent =
  | 'recipe_search'
  | 'nutrition_recipe'
  | 'nutrition_general'
  | 'cooking_tips'
  | 'substitutions'
  | 'site_info'
  | 'greetings'
  | 'thanks'
  | 'help'
  | 'fallback';

function detectUserIntent(q: string): ChatIntent {
  const t = normalize(q);
  if (!t || t.length < 2) return 'fallback';

  const hasIngredient = extractIngredients(q).length > 0;

  const looksLikeRecipe =
    hasIngredient ||
    /\breceit/.test(t) ||
    /\bprato|\bcomida|\bculiinari/.test(t) ||
    CATEGORY_LABELS.some(cat => t.includes(normalize(cat))) ||
    Object.values(DIFFICULTY_SYNONYMS).some(syns => syns.some(s => t.includes(normalize(s)))) ||
    /\b(15|30)\b\s*(min|mins|minutos)|\b(r[aá]pid|m[eé]di|longo)\b/.test(t) ||
    /\b(4|4[.,]5|5)\s*(\+|estrelas?|\*)?/.test(t) ||
    /\bfac(eis|il|inha|inho|inhas|inhos)?\b|\bhard\b|\bdifficult\b/.test(t);

  if (looksLikeRecipe) return 'recipe_search';

  if (/\bnutri(c|ç)[aã]o|\bcaloria|\bprote[ií]na|\bcarbo|\bgordur|fibra|\bmacro|\bmicro/.test(t)) {
    if (/\breceit|nome|t[ií]tulo|\bdessa\b|\bdesta\b/.test(t)) return 'nutrition_recipe';
    return 'nutrition_general';
  }

  if (/\bdica|\bt[eé]cnica|\bassar|\bfritar|\btemperatur|ponto|forno|frigideira|air ?fryer|panela/.test(t))
    return 'cooking_tips';

  if (/\bsubstit|posso trocar|alternativa|sem (ovo|leite|gl[úu]ten|a[çc]ucar|lactose)/.test(t))
    return 'substitutions';

  if (/\bsite|plano|assinatura|categorias?|filtros?|avalia[cç][aã]o|min[ií]ma|privacidade|dados|como funciona|sobre\b/.test(t))
    return 'site_info';

  if (/\b(oi|ol[aá]|bom dia|boa tarde|boa noite|hello|hey|e ai|fala|tudo bem)\b/.test(t)) return 'greetings';
  if (/\b(obrigad|valeu|agrade[cç]o|muito obrigad|thanks)\b/.test(t)) return 'thanks';
  if (/\bajuda|como usar|n[aã]o sei|d[úu]vida|como funciona|qual\b/.test(t)) return 'help';

  return 'fallback';
}

// =============================================================================
// Respostas pré-definidas
// =============================================================================
function siteInfoAnswer(): AIResponse {
  const content = [
    'Aqui no **NutriChefe** você pode buscar receitas de várias formas:',
    '• Por **ingrediente**: "receitas com banana", "frango com brócolis"',
    '• Por **categoria**: Vegana, Baixo Carboidrato, Rica em Proteína, Sem Glúten, Vegetariana',
    '• Por **dificuldade**: fácil, médio, difícil',
    '• Por **tempo**: rápida (≤15 min), média (≤30 min), demorada (>30 min)',
    '• Por **avaliação**: 4+, 4.5+ ou 5 estrelas',
    '',
    'Fale do seu jeito — "receita fácil com aveia", "vegana rápida 4.5+", "com banana e aveia"… eu entendo!',
  ].join('\n');
  return { content, recipes: [], suggestions: ['receitas com frango', 'vegana fácil', 'com aveia rápida'] };
}

function greetingsAnswer(): AIResponse {
  return {
    content: 'Olá! Sou a assistente do NutriChefe. Posso ajudar com receitas por ingrediente, categoria, dificuldade e muito mais. O que você está procurando hoje?',
    recipes: [],
    suggestions: ['receitas com banana', 'vegana rápida', 'rica em proteína fácil'],
  };
}

function thanksAnswer(): AIResponse {
  return { content: 'De nada! Se precisar de mais receitas ou dicas, é só chamar.', recipes: [], suggestions: [] };
}

function helpAnswer(): AIResponse {
  return {
    content: [
      'Posso ajudar com:',
      '• **Receitas por ingrediente**: "quero receita com banana", "tem algo com frango e batata doce?"',
      '• **Filtros combinados**: "vegana fácil em 20 min 4 estrelas"',
      '• **Dicas de cozinha**: "como assar frango no forno", "dica para air fryer"',
      '• **Substituições**: "como substituir ovo na receita", "sem lactose"',
      '• **Nutrição**: "receitas ricas em proteína para ganhar massa"',
      '',
      'Fale naturalmente, sem precisar de comandos especiais!',
    ].join('\n'),
    recipes: [],
    suggestions: ['receitas com chia', 'sem glúten fácil', 'rica em proteína 30 min'],
  };
}

function cookingTipsAnswer(q: string): AIResponse {
  const t = normalize(q);
  const tips: string[] = [];
  if (/\barroz\b/.test(t)) tips.push('Arroz soltinho: lave até a água sair clara; refogue; 1:1,6 arroz:água; fogo baixo; descansar 5 min.');
  if (/\bfrango|peito\b/.test(t)) tips.push('Frango suculento: sele bem quente 2–3 min por lado; finalize tampado; descanse 3–5 min antes de cortar.');
  if (/\bforno|assar\b/.test(t)) tips.push('Assados: pré-aqueça sempre; não lote a assadeira; use termômetro (frango 74°C no centro).');
  if (/\bair ?fryer\b/.test(t)) tips.push('Air fryer: pré-aqueça 3 min; pincele um fio de óleo; vire na metade do tempo; não sobrecarregue o cesto.');
  if (!tips.length) tips.push('Dica de ouro: pré-aqueça sempre, tempere com antecedência, não lote panelas e deixe as carnes descansarem após o cozimento.');
  return { content: tips.join('\n'), recipes: [], suggestions: ['receitas rápidas no forno', 'frango grelhado fácil'] };
}

function substitutionsAnswer(q: string): AIResponse {
  const t = normalize(q);
  const lines: string[] = [];
  if (/\bovo\b/.test(t)) lines.push('**Sem ovo**: 1 ovo = 1 c.s. linhaça/chia moída + 3 c.s. água (gel 10 min) ou 1/4 xíc. purê de maçã/banana.');
  if (/\bleite|lactose\b/.test(t)) lines.push('**Sem leite**: bebidas vegetais (aveia, amêndoas, soja) na mesma proporção. Em molhos, leite de coco dá mais corpo.');
  if (/\bgluten|gl[úu]ten\b/.test(t)) lines.push('**Sem glúten**: blend de farinha de arroz + fécula de batata + polvilho doce + goma xantana (0,5–1%).');
  if (/\ba[çc][uú]car\b/.test(t)) lines.push('**Menos açúcar**: reduza 10–20% sem afetar estrutura; use adoçantes culinários conforme indicação do fabricante.');
  if (!lines.length)
    lines.push('Substituições frequentes:\n• **Ovo**: gel de linhaça/chia ou purê de frutas\n• **Leite**: bebidas vegetais\n• **Trigo**: mix sem glúten + goma xantana\n• **Açúcar**: redução gradual ou adoçante culinário');
  return { content: lines.join('\n'), recipes: [], suggestions: ['bolos sem ovo', 'pão sem glúten', 'vegana fácil'] };
}

function nutritionGeneralAnswer(q: string): AIResponse {
  const t = normalize(q);
  const blocks: string[] = [];
  if (/\bprote[ií]na|ganhar massa|hipertrof|m[úu]sculo/.test(t)) blocks.push('**Proteína**: 1,6–2,2 g/kg/dia, distribuídas em 3–5 refeições; priorize fontes magras e variadas.');
  if (/\bemagrec|déficit|deficit/.test(t)) blocks.push('**Emagrecimento**: déficit calórico moderado + proteína elevada + fibras para saciedade; evite ultraprocessados.');
  if (/\bcarbo|energia|corrida|bike|treino/.test(t)) blocks.push('**Carboidratos**: integrais no dia a dia; fácil digestão pré-treino intenso; pós-treino combine com proteína.');
  if (/\bgordur|colesterol|hdl|ldl/.test(t)) blocks.push('**Gorduras boas**: azeite, abacate, castanhas, peixes; limite trans e saturadas em excesso.');
  if (/\bfibra|intest|saciedad/.test(t)) blocks.push('**Fibras**: 25–35 g/dia; aumente gradualmente e beba mais água. Fontes: feijões, aveia, frutas, verduras.');
  if (!blocks.length) blocks.push('Nutrição equilibrada: variedade de alimentos in natura, controle de ultraprocessados, hidratação e sono de qualidade.');
  blocks.push('\n*Orientação educativa — para plano personalizado, consulte um nutricionista.*');
  return { content: blocks.join('\n'), recipes: [], suggestions: ['rica em proteína 30 min', 'baixo carbo fácil'] };
}

function nutritionForRecipeAnswer(query: string, rows: RecipeRow[]): AIResponse {
  const t = normalize(query);
  const found = rows.find(r => normalize(r.title).includes(t)) || rows.find(r => t.includes(normalize(r.title)));
  if (!found) {
    return {
      content: 'Me diga o **nome da receita** que você quer os dados nutricionais.',
      recipes: [],
      suggestions: [],
    };
  }
  const nf = found.nutrition_facts || {};
  const parts = [
    `**${found.title}** — informações nutricionais por porção:`,
    `• Calorias: ${round1(nf.calories)} kcal`,
    `• Proteínas: ${round1(nf.protein)} g`,
    `• Carboidratos: ${round1(nf.carbs)} g`,
    `• Gorduras: ${round1(nf.fat)} g`,
    `• Fibras: ${round1(nf.fiber)} g`,
    `\n*Valores estimados; podem variar conforme porções e marcas.*`,
  ];
  return { content: parts.join('\n'), recipes: [], suggestions: [] };
}

// =============================================================================
// Helpers de texto natural
// =============================================================================
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed = 0): T {
  return arr[seed % arr.length];
}

function joinTagsBR(tags: string[]): string {
  const t = tags.filter(Boolean);
  if (t.length === 0) return '';
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} e ${t[1]}`;
  return `${t.slice(0, -1).join(', ')} e ${t[t.length - 1]}`;
}

function humanizeIntro(
  q: string,
  opts: {
    f0: ParsedFilters;
    shown: number;
    total: number;
    matchedExactly: boolean;
    sortKey?: SortKey;
    relaxedFilters?: string[];
  }
): string {
  const { f0, shown, matchedExactly, sortKey, relaxedFilters } = opts;
  const seed = hashStr(q);

  const tags: string[] = [];
  if (f0.ingredients?.length) {
    const ingList = joinTagsBR(f0.ingredients.map(i => i));
    tags.push(`com **${ingList}**`);
  }
  if (f0.category) tags.push(f0.category);
  if (f0.difficulty) tags.push(f0.difficulty === 'easy' ? 'fáceis' : f0.difficulty === 'medium' ? 'médias' : 'difíceis');
  if (typeof f0.maxPrep === 'number') tags.push(`até ${f0.maxPrep} min`);
  if (typeof f0.minRating === 'number') tags.push(`${f0.minRating}+ ⭐`);
  if (sortKey === 'prepTime') tags.push('mais rápidas primeiro');
  if (sortKey === 'newest') tags.push('mais recentes');

  const tagStr = joinTagsBR(tags);

  const introsComFiltro = [
    `Aqui estão receitas ${tagStr || 'para você'}:`,
    `Encontrei estas opções ${tagStr ? tagStr : 'que podem te interessar'}:`,
    `Separei estas sugestões ${tagStr || 'do nosso acervo'}:`,
  ];
  const introsGerais = [
    'Separei algumas das favoritas do pessoal:',
    'Aqui vão algumas ideias do nosso acervo:',
    'Peguei algumas sugestões que costumam agradar:',
  ];

  const intro = tagStr ? pick(introsComFiltro, seed) : pick(introsGerais, seed);
  const lines: string[] = [intro];

  if (typeof f0.limit === 'number') {
    lines.push(shown < f0.limit ? `Encontrei **${shown}** disponível agora.` : `Mostrando **${shown}** como pedido.`);
  }

  if (!matchedExactly && shown > 0 && relaxedFilters?.length) {
    lines.push(`Flexibilizei *${relaxedFilters[0]}* para trazer mais opções.`);
  }

  return lines.join('\n');
}

// =============================================================================
// Recomendação principal
// =============================================================================
export async function recommendRecipesFromText(query: string): Promise<AIResponse> {
  try {
    const f0 = parseQueryToFilters(query);
    const rows = await fetchRecipesFromDB();

    if (!rows || rows.length === 0) {
      return {
        content: 'No momento não consigo acessar as receitas. Tente novamente em alguns instantes.',
        recipes: [],
        suggestions: ['receitas fáceis', 'vegana rápida', 'sem glúten'],
      };
    }

    let list = applyFiltersBase(rows, f0);
    let matchedExactly = list.length > 0;
    let relaxedFilters: string[] = [];

    if (list.length === 0) {
      const { list: relaxedList, relaxed } = progressiveRelax(rows, f0);
      list = relaxedList;
      relaxedFilters = relaxed;
      matchedExactly = false;
    }

    const onlyGeneric = !f0.hasStructuredFilter && !f0.plainSearch;
    let sortKey: SortKey | undefined = f0.sort ?? (onlyGeneric ? 'rating' : undefined);
    if (!f0.sort && f0.difficulty === 'easy') sortKey = 'prepTime';
    if (!f0.sort && f0.difficulty === 'hard') sortKey = 'rating';

    const limit = f0.limit ?? (f0.wantAll ? 100 : 12);
    const sorted = sortList(list, sortKey, f0.ingredients);
    const cards = capAndMap(sorted, limit);

    if (cards.length === 0) {
      return {
        content: 'Não encontrei receitas com esses critérios. Tente buscar por outro ingrediente ou categoria!',
        recipes: [],
        suggestions: ['receitas fáceis', 'vegana rápida', 'rica em proteína'],
      };
    }

    const content = humanizeIntro(query, {
      f0,
      shown: cards.length,
      total: list.length,
      matchedExactly,
      sortKey,
      relaxedFilters,
    });

    const suggestions: string[] = [];
    if (f0.ingredients?.length) {
      suggestions.push(`${f0.ingredients[0]} vegana`, `${f0.ingredients[0]} fácil`);
    } else if (cards.length < 5) {
      suggestions.push('receitas rápidas', 'vegana fácil', '5 estrelas');
    }

    return { content, recipes: cards, suggestions };
  } catch (error) {
    console.error('Erro em recommendRecipesFromText:', error);
    return {
      content: 'Desculpe, tive um problema ao buscar receitas. Tente novamente.',
      recipes: [],
      suggestions: ['receitas fáceis', 'vegana rápida', 'sem glúten'],
    };
  }
}

// =============================================================================
// Supabase: config / conversas / mensagens
// =============================================================================
export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .maybeSingle();
  if (error) throw error;
  return data as AIConfiguration | null;
}

export async function createAIConfiguration(
  config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AIConfiguration> {
  const { data, error } = await supabase.from('ai_configurations').insert([config]).select().single();
  if (error) throw error;
  return data as AIConfiguration;
}

export async function updateAIConfiguration(
  configId: string,
  updates: Partial<AIConfiguration>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations').update(updates).eq('id', configId).select().single();
  if (error) throw error;
  return data as AIConfiguration;
}

export async function createAIConversation(input: {
  client_id: string;
  nutritionist_id?: string | null;
  ai_config_id?: string | null;
  title?: string;
  is_active?: boolean;
}): Promise<AIConversation> {
  const row = {
    client_id: input.client_id,
    nutritionist_id: input.nutritionist_id ?? null,
    ai_config_id: input.ai_config_id ?? null,
    title: input.title ?? 'Nova conversa com IA',
    is_active: input.is_active ?? true,
  };
  const { data, error } = await supabase.from('ai_conversations').insert([row]).select('*').single();
  if (error) throw error;
  return data as AIConversation;
}

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations').select('*').eq('client_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AIConversation[];
}

export async function getAIMessages(conversationId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as AIMessage[];
}

export async function createAIMessage(
  message: Omit<AIMessage, 'id' | 'created_at' | 'updated_at'>
): Promise<AIMessage> {
  const { data, error } = await supabase.from('ai_messages').insert([message]).select().single();
  if (error) throw error;
  return data as AIMessage;
}

// =============================================================================
// Orquestração principal
// =============================================================================
function isNutritionGoalQuery(text: string): boolean {
  const t = normalize(text);
  return (
    /\bemagrec|perder peso|perda de gordura|defini[cç][aã]o|definir|secar\b/.test(t) ||
    /\bganhar massa|hipertrof|massa magra|bulking|volume\b/.test(t)
  );
}

export async function processAIMessage(
  userMessage: string,
  _aiConfig?: any,
  _conversationHistory?: any
): Promise<AIResponse> {
  const content = String(userMessage || '').trim();

  if (!content) {
    return {
      content: 'Desculpe, não consegui entender. Pode repetir?',
      recipes: [],
      suggestions: ['receitas com banana', 'vegana fácil', 'sem glúten'],
    };
  }

  try {
    const intent = detectUserIntent(content);

    switch (intent) {
      case 'recipe_search': {
        const hasNutritionGoal = isNutritionGoalQuery(content);
        if (hasNutritionGoal) {
          const [recipes, advice] = await Promise.all([
            recommendRecipesFromText(content).catch(() => ({
              content: '',
              recipes: [],
              suggestions: [],
            })),
            getGeminiResponse(
              `O usuário quer receitas e dicas para: "${content}"\nDê 3 tips práticos e diretos sobre a meta nutricional.`
            ),
          ]);
          const combined = [advice.content, recipes.content].filter(Boolean).join('\n\n');
          return {
            content: combined,
            recipes: recipes.recipes || [],
            suggestions: recipes.suggestions || [],
          };
        }
        return recommendRecipesFromText(content).catch(() => ({
          content: 'Não encontrei receitas. Tente buscar com outros termos!',
          recipes: [],
          suggestions: ['receitas fáceis', 'vegana rápida', 'sem glúten'],
        }));
      }

      case 'greetings': return greetingsAnswer();
      case 'thanks': return thanksAnswer();
      case 'help': return helpAnswer();
      case 'cooking_tips': return cookingTipsAnswer(content);
      case 'substitutions': return substitutionsAnswer(content);
      case 'nutrition_general': return nutritionGeneralAnswer(content);
      case 'nutrition_recipe': {
        const rows = await fetchRecipesFromDB().catch(() => []);
        return nutritionForRecipeAnswer(content, rows);
      }
      case 'site_info': return siteInfoAnswer();

      default:
      case 'fallback': {
        const response = await getGeminiResponse(content);
        return {
          content: response.content,
          recipes: [],
          suggestions: ['receitas com frango', 'vegana fácil', 'sem glúten'],
        };
      }
    }
  } catch (error) {
    console.error('Erro em processAIMessage:', error);
    return {
      content: 'Desculpe, tive um problema. Pode tentar novamente?',
      recipes: [],
      suggestions: ['receitas fáceis', 'vegana', 'sem glúten'],
    };
  }
}
