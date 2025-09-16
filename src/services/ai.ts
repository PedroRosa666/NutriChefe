// src/services/ai.ts
// =============================================================================
import { supabase } from '../lib/supabase';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

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

// =============================================================================
// Vocabulário
// =============================================================================
const DIFFICULTY_SYNONYMS: Record<Difficulty, string[]> = {
  // inclui plural e diminutivos
  easy: ['fácil', 'facil', 'fáceis', 'faceis', 'facinha', 'facinho', 'facinhas', 'facinhos', 'simples', 'iniciante', 'tranquila', 'descomplicada'],
  medium: ['médio', 'medio', 'intermediário', 'intermediario', 'média', 'mediana'],
  hard: ['difícil', 'dificil', 'difíceis', 'difíceis', 'avançado', 'avancado', 'complexo', 'trabalhosa'],
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
  'Rica em Proteína': ['rica em proteína', 'muita proteina', 'alta proteína', 'alto teor proteico', 'proteica', 'proteinado'],
  'Sem Glúten': ['sem glúten', 'sem gluten', 'gluten free', 'sg', 'livre de glúten'],
  'Vegetariana': ['vegetariana', 'vegetariano', 'veggie', 'ovo-lacto', 'ovolacto'],
};

const NUM_RE = /(\d+(?:[.,]\d+)?)/;

// Palavras genéricas que não devem virar busca de texto
const STOPWORDS = new Set([
  'receita', 'receitas', 'quero', 'queria', 'gostaria', 'me', 'mostra', 'mostrar', 'mostre', 'traga', 'trazer',
  'uma', 'umas', 'um', 'uns', 'de', 'do', 'da', 'no', 'na', 'em', 'pra', 'para', 'por', 'a', 'o', 'as', 'os',
  'ai', 'ia', 'porfavor', 'por favor'
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

function normalize(s: any) {
  return toSafeString(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ');
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

// Dificuldade robusta: aceita "easy/medium/hard" e PT-BR
function normalizeDifficultyValue(value: string): Difficulty {
  const n = normalize(value);
  if (n === 'easy' || n === 'medium' || n === 'hard') return n as Difficulty;
  if (/\bfac(eis|il|inha|inho|inhas|inhos)?\b/.test(n) || n.includes('simples')) return 'easy';
  if (/\bmedi/.test(n)) return 'medium';
  if (/\bdific/.test(n)) return 'hard';
  return 'medium';
}

// =============================================================================
// Parser de linguagem natural -> filtros
// =============================================================================
interface ParsedFilters {
  category?: SiteCategory;
  difficulty?: Difficulty;
  maxPrep?: number;
  minPrep?: number;
  minRating?: number;
  wantAll?: boolean;
  plainSearch?: string;
  limit?: number;
  sort?: SortKey;
  hasStructuredFilter?: boolean; // novo: indica se achamos categoria/dificuldade/tempo/nota
}

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

  // Dificuldade (sinônimos + regex plural/diminutivos)
  for (const [key, syns] of Object.entries(DIFFICULTY_SYNONYMS)) {
    if (syns.some(s => text.includes(normalize(s)))) {
      f.difficulty = key as Difficulty;
      break;
    }
  }
  if (!f.difficulty) {
    if (/\bfac(eis|il|inha|inho|inhas|inhos)?\b/.test(text)) f.difficulty = 'easy';
    else if (/\bm[eé]di[oa]\b/.test(text)) f.difficulty = 'medium';
    else if (/\bdif[ií]cil|\bdific\b/.test(text)) f.difficulty = 'hard';
  }

  // Tempo
  if (/\br[aá]pid[oa]s?\b/.test(text) || /\b<=?\s*15\b/.test(text)) f.maxPrep = 15;
  if (/\bm[eé]di[oa]\b/.test(text) || /\b<=?\s*30\b/.test(text)) f.maxPrep = f.maxPrep ?? 30;
  if (/\blongo?s?\b|\b>?\s*30\b/.test(text)) f.minPrep = 31;

  // “em X minutos / até X min”
  const mTime = text.match(new RegExp(`\\b(em|ate|até|<=?)\\s*${NUM_RE.source}\\s*(min|mins|minutos)\\b`));
  if (mTime) {
    const mins = parseFloat(mTime[2].replace(',', '.'));
    if (!isNaN(mins)) f.maxPrep = Math.min(f.maxPrep ?? Infinity, mins);
  }

  // Avaliação mínima
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

  // “todas/qualquer”
  if (/\btod[ao]s?\b|\bqualquer\b/.test(text)) f.wantAll = true;

  // quantidade e ordenação
  f.limit = parseCount(text) ?? undefined;
  f.sort = parseSort(text) ?? undefined;

  // marcou se há filtro estruturado
  f.hasStructuredFilter = Boolean(f.category || f.difficulty || f.maxPrep || f.minPrep || f.minRating);

  // termo livre (só quando não há filtros estruturados e sobra algo relevante)
  const maybePlain = pickPlainSearchSource(q);
  if (!f.hasStructuredFilter && maybePlain) f.plainSearch = maybePlain;

  return f;
}

// =============================================================================
// DB (sem JOIN declarativo)
// =============================================================================
async function fetchRecipesFromDB(): Promise<RecipeRow[]> {
  const { data: recipeRows, error: recipesErr } = await supabase
    .from('recipes')
    .select('id, title, description, image, prep_time, difficulty, category, rating, nutrition_facts, author_id, created_at, updated_at');

  if (recipesErr) throw recipesErr;

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
  if (reviews && reviews.length) {
    for (const r of reviews as Array<{ recipe_id: string; rating: number }>) {
      if (!ratingsAgg[r.recipe_id]) ratingsAgg[r.recipe_id] = { sum: 0, count: 0 };
      ratingsAgg[r.recipe_id].sum += r.rating ?? 0;
      ratingsAgg[r.recipe_id].count += 1;
    }
  }

  // Resultado
  const result: RecipeRow[] = rows.map(r => {
    // rating efetivo
    let effectiveRating: number | null = r.rating ?? null;
    if (effectiveRating == null && ratingsAgg[r.id]?.count) {
      const avg = ratingsAgg[r.id].sum / ratingsAgg[r.id].count;
      effectiveRating = round1(avg);
    }

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      image: r.image,
      prep_time: r.prep_time,
      difficulty: normalizeDifficultyValue(r.difficulty),
      category: r.category || '',
      rating: effectiveRating,
      author_id: r.author_id,
      author_name: (r.author_id && authorsMap[r.author_id]) ? authorsMap[r.author_id] : 'NutriChefe',
      nutrition_facts: r.nutrition_facts || null,
      reviews: [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    } as RecipeRow;
  });

  return result;
}

// =============================================================================
// Filtro + ordenação + relaxamento
// =============================================================================
function applyFiltersBase(rows: RecipeRow[], f: ParsedFilters): RecipeRow[] {
  let list = rows.slice();

  if (f.category) {
    const needle = normalize(f.category);
    list = list.filter(r => normalize(r.category).includes(needle));
  }

  if (f.difficulty) {
    list = list.filter(r => r.difficulty === f.difficulty);
  }

  if (typeof f.maxPrep === 'number') list = list.filter(r => r.prep_time <= f.maxPrep);
  if (typeof f.minPrep === 'number') list = list.filter(r => r.prep_time >= f.minPrep);

  if (typeof f.minRating === 'number') {
    list = list.filter(r => (typeof r.rating === 'number' ? r.rating : 0) >= f.minRating!);
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

function sortList(list: RecipeRow[], sort?: SortKey): RecipeRow[] {
  const arr = list.slice();
  if (sort === 'prepTime') {
    arr.sort((a, b) => a.prep_time - b.prep_time || ((b.rating ?? 0) - (a.rating ?? 0)));
  } else if (sort === 'newest') {
    arr.sort((a, b) => (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime()));
  } else {
    // default: rating desc, depois mais rápido
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

// Relaxamento progressivo (sem vazar nota para o usuário)
function progressiveRelax(rows: RecipeRow[], f: ParsedFilters): { list: RecipeRow[] } {
  const attempts: Array<(g: ParsedFilters) => void> = [
    g => { if (typeof g.minRating === 'number') delete g.minRating; },
    g => { if (typeof g.maxPrep === 'number') delete g.maxPrep; },
    g => { if (g.category) delete g.category; },
    g => { if (g.difficulty) delete g.difficulty; },
  ];

  let current = applyFiltersBase(rows, { ...f });
  if (current.length > 0) return { list: current };

  for (const tweak of attempts) {
    const g = { ...f };
    tweak(g);
    current = applyFiltersBase(rows, g);
    if (current.length > 0) {
      return { list: current };
    }
  }

  return { list: rows.slice() };
}

// =============================================================================
// Intents e respostas utilitárias
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

  const looksLikeRecipe =
    /\breceit/.test(t) ||
    CATEGORY_LABELS.some(cat => t.includes(normalize(cat))) ||
    Object.values(DIFFICULTY_SYNONYMS).some(syns => syns.some(s => t.includes(normalize(s)))) ||
    /\b(15|30)\b\s*(min|mins|minutos)|\b(r[aá]pid|m[eé]di|longo)\b/.test(t) ||
    /\b(4|4[.,]5|5)\s*(\+|estrelas?|\*)?/.test(t) ||
    /\bfac(eis|il|inha|inho|inhas|inhos)?\b/.test(t);

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

  if (/\b(oi|ol[aá]|bom dia|boa tarde|boa noite|hello|hey)\b/.test(t)) return 'greetings';
  if (/\b(obrigad|valeu|agrade[cç]o)\b/.test(t)) return 'thanks';
  if (/\bajuda|como usar|n[aã]o sei|d[úu]vida\b/.test(t)) return 'help';

  return 'fallback';
}

// Compat com código antigo
type Intent = ChatIntent;
const detectIntent = detectUserIntent;

function siteInfoAnswer(): AIResponse {
  const content = [
    'Aqui no **NutriChefe** você encontra receitas filtrando por:',
    '• **Categorias**: Vegana, Baixo Carboidrato, Rica em Proteína, Sem Glúten, Vegetariana;',
    '• **Dificuldade**: Fácil, Médio, Difícil;',
    '• **Tempo de preparo**: Rápido (≤15 min), Médio (≤30 min), Longo (>30 min);',
    '• **Avaliação mínima**: 4+, 4.5+ ou 5⭐.',
    '',
    'Pode falar comigo do seu jeito: “receitas fáceis”, “vegana rápida 4.5+”, “sem glúten em 30 min”… eu entendo 😉',
  ].join('\n');
  return { content, recipes: [], suggestions: ['fáceis', 'sem glúten 30 min', 'baixo carbo 5⭐'] };
}

function greetingsAnswer(): AIResponse {
  return {
    content:
      'Oi! 👋 Sou a assistente do NutriChefe. Quer ideias de receitas, dicas de cozinha ou informações nutricionais? Tô aqui pra ajudar!',
    recipes: [],
    suggestions: ['receitas fáceis', 'vegana rápida', 'dica para air fryer'],
  };
}

function thanksAnswer(): AIResponse {
  return { content: 'De nada! Se precisar, é só chamar. 😊', recipes: [], suggestions: [] };
}

function helpAnswer(): AIResponse {
  return {
    content:
      'Pode pedir assim:\n• "receitas fáceis"\n• "vegana 15 min 4.5+"\n• "substituição do ovo no bolo"\n• "dica para grelhar frango"\n• "info nutricional do Bolo de Banana".',
    recipes: [],
    suggestions: ['sem glúten fácil', 'rica em proteína 30 min', 'baixo carbo 5⭐'],
  };
}

function cookingTipsAnswer(q: string): AIResponse {
  const t = normalize(q);
  const tips: string[] = [];
  if (/\barroz\b/.test(t)) tips.push('Arroz soltinho: lave até a água sair clara; refogue; 1:1,6 arroz:água; fogo baixo; descansar 5 min.');
  if (/\bfrango|peito\b/.test(t)) tips.push('Frango suculento: sele bem quente 2–3 min por lado; finalize tampado; descanse 3–5 min antes de cortar.');
  if (/\bforno|assar\b/.test(t)) tips.push('Assados: pré-aqueça; não lotar assadeira; use termômetro (frango 74°C no centro).');
  if (/\bair ?fryer\b/.test(t)) tips.push('Air fryer: pré-aqueça; pincele óleo; vire na metade; não sobrecarregue o cesto.');
  if (!tips.length) tips.push('Regra de ouro: pré-aqueça, tempere com antecedência, não lote panelas e dê descanso às carnes.');
  return { content: tips.join('\n'), recipes: [], suggestions: ['receitas rápidas', 'legumes assados crocantes'] };
}

function substitutionsAnswer(q: string): AIResponse {
  const t = normalize(q);
  const lines: string[] = [];
  if (/\bovo\b/.test(t)) lines.push('Sem ovo: 1 ovo = 1 c.s. linhaça/chia moída + 3 c.s. água (gel 10 min) ou 1/4 xíc. purê de maçã/banana.');
  if (/\bleite|lactose\b/.test(t)) lines.push('Sem leite: bebidas vegetais (aveia, amêndoas, soja). Em molhos, leite de coco dá corpo.');
  if (/\bgluten|gl[úu]ten\b/.test(t)) lines.push('Sem glúten: blend (arroz + fécula + polvilho) + goma xantana (0,5–1%).');
  if (/\ba[çc][uú]car\b/.test(t)) lines.push('Menos açúcar: reduza 10–20% sem afetar estrutura; adoçantes culinários conforme o fabricante.');
  if (!lines.length)
    lines.push('Substituições úteis:\n• Ovo: linhaça/chia gel ou purê de frutas\n• Leite: bebidas vegetais\n• Trigo: mixes sem glúten + xantana\n• Açúcar: -10–20% ou adoçante culinário');
  return { content: lines.join('\n'), recipes: [], suggestions: ['bolos sem ovo', 'pão sem glúten', 'vegana fácil'] };
}

function nutritionGeneralAnswer(q: string): AIResponse {
  const t = normalize(q);
  const blocks: string[] = [];
  if (/\bprote[ií]na|ganhar massa|hipertrof|m[úu]sculo/.test(t)) blocks.push('Proteína: 1.2–2.0 g/kg/dia distribuídas; fontes magras e/ou vegetais (soja, leguminosas).');
  if (/\bemagrec|déficit|deficit/.test(t)) blocks.push('Emagrecimento: déficit calórico sustentável + fibras (vegetais, integrais) e proteína para saciedade.');
  if (/\bcarbo|energia|corrida|bike|treino/.test(t)) blocks.push('Carboidratos: integrais no dia a dia; para treinos longos, carbo de fácil digestão antes/durante; pós com proteína.');
  if (/\bgordur|colesterol|hdl|ldl/.test(t)) blocks.push('Gorduras: priorize mono/poli-insaturadas (azeite, abacate, castanhas, peixes); limite trans e saturadas.');
  if (/\bfibra|intest|saciedad/.test(t)) blocks.push('Fibras: 25–35 g/dia; aumente gradualmente e hidrate bem. Fontes: feijões, aveia, frutas, verduras.');
  if (!blocks.length) blocks.push('Nutrição: equilíbrio de macros, alimentos minimamente processados, fibras e hidratação adequada.');
  blocks.push('\n⚠️ Orientação educativa — não substitui acompanhamento profissional.');
  return { content: blocks.join('\n'), recipes: [], suggestions: ['rica em proteína 30 min', 'baixo carbo fácil'] };
}

function nutritionForRecipeAnswer(query: string, rows: RecipeRow[]): AIResponse {
  const t = normalize(query);
  const found = rows.find(r => normalize(r.title).includes(t)) || rows.find(r => t.includes(normalize(r.title)));
  if (!found) {
    return {
      content: 'Me diga o **nome exato** da receita do site que você quer os dados nutricionais (pode copiar do card).',
      recipes: [],
      suggestions: ['info nutricional do "Bolo de Banana Fit"'],
    };
  }
  const nf = found.nutrition_facts || {};
  const parts: string[] = [
    `**${found.title}** — info nutricional (por porção):`,
    `• Calorias: ${round1(nf.calories)} kcal`,
    `• Proteínas: ${round1(nf.protein)} g`,
    `• Carboidratos: ${round1(nf.carbs)} g`,
    `• Gorduras: ${round1(nf.fat)} g`,
    `• Fibras: ${round1(nf.fiber)} g`,
    `\nValores estimados; podem variar conforme porções e marcas. Consulte seu nutricionista para ajustes.`,
  ];
  return { content: parts.join('\n'), recipes: [], suggestions: [] };
}

// ---------- Helpers para texto mais natural ----------
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
function pick<T>(arr: T[], seed = 0): T {
  if (!arr.length) return arr[0] as T;
  const idx = seed % arr.length;
  return arr[idx];
}
function humanizeIntro(
  q: string,
  opts: {
    f0: ParsedFilters;
    shown: number;
    total: number;
    matchedExactly: boolean; // se não precisou relaxar
    sortKey?: SortKey;
  }
): string {
  const { f0, shown, total, matchedExactly, sortKey } = opts;
  const seed = hashStr(q);

  // peças de contexto
  const tags: string[] = [];
  if (f0.category) tags.push(f0.category);
  if (f0.difficulty) tags.push(f0.difficulty === 'easy' ? 'fáceis' : f0.difficulty === 'medium' ? 'médias' : 'difíceis');
  if (typeof f0.maxPrep === 'number') tags.push(`até ${f0.maxPrep} min`);
  if (typeof f0.minRating === 'number') tags.push(`${f0.minRating}+ ⭐`);
  if (sortKey === 'prepTime') tags.push('mais rápidas primeiro');
  if (sortKey === 'newest') tags.push('mais recentes');
  if (sortKey === 'rating') tags.push('bem avaliadas');

  const tagStr = tags.length ? tags.join(' • ') : '';

  // usuário pediu quantidade explícita? (ex.: "me mostra 8")
  const userAskedCount = typeof f0.limit === 'number';

  // Intros variadas (sem “Encontrei 25…”)
  const introsComFiltro = [
    `Separei estas ${tagStr ? `**${tagStr}**` : 'opções'} pra você 👇`,
    `Olha só algumas ideias ${tagStr ? `**${tagStr}**` : ''}:`,
    `Que tal começar por estas ${tagStr ? `**${tagStr}**` : 'sugestões'}?`,
  ];
  const introsGerais = [
    'Separei algumas das favoritas do pessoal ✨',
    'Aqui vão algumas ideias legais do nosso acervo 👇',
    'Peguei algumas sugestões que costumam agradar 😉',
  ];

  let intro = '';
  const hasOnlyDifficulty =
    Boolean(f0.difficulty) &&
    !f0.category &&
    typeof f0.maxPrep !== 'number' &&
    typeof f0.minPrep !== 'number' &&
    typeof f0.minRating !== 'number';

  if (hasOnlyDifficulty || f0.category || f0.maxPrep || f0.minRating || sortKey) {
    intro = pick(introsComFiltro, seed);
  } else {
    intro = pick(introsGerais, seed);
  }

  // Mostrar contagem? só quando o usuário pediu número, ou quando mostrarmos menos que pediu
  const lines: string[] = [intro];
  if (userAskedCount) {
    lines.push(shown < (f0.limit ?? shown) ? `Consegui **${shown}** no momento.` : `Mostrando **${shown}** como você pediu.`);
  } else {
    // Sem obsessão por números: omitimos o total.
    // Em casos genéricos (sem filtro nenhum), um toque curto ajuda:
    if (!f0.hasStructuredFilter && !f0.plainSearch) {
      lines.push(`Mostrando ${shown}.`);
    }
  }

  // Se precisou relaxar e mesmo assim achou pouca coisa, uma linha sutil (sem “alternativas”/“não encontrei”)
  if (!matchedExactly && shown > 0 && !userAskedCount) {
    const softNotes = [
      'Ajustei um pouquinho os critérios pra ampliar as ideias.',
      'Dei uma flexionada nos filtros pra te trazer opções parecidas.',
      'Expandi levemente os critérios pra não te deixar na mão.',
    ];
    lines.push(`_${pick(softNotes, seed)}_`);
  }

  return lines.join('\n');
}



// =============================================================================
// Recomendação (com sort, count, relax e mensagens humanas)
// =============================================================================
// Recomendação (com sort, count, relax e mensagens humanas — contagem “X de Y”)
// Recomendação (texto natural, sem contagem seca, sem saudação gratuita)
export async function recommendRecipesFromText(query: string): Promise<AIResponse> {
  const f0 = parseQueryToFilters(query);
  const rows = await fetchRecipesFromDB();

  // 1) Aplica filtros
  const initial = applyFiltersBase(rows, f0);
  let list = initial;
  let matchedExactly = list.length > 0; // se já temos algo, não vamos dizer que relaxamos

  // 2) Relaxa SOMENTE se realmente não houver nada
  if (list.length === 0) {
    const pr = progressiveRelax(rows, f0);
    list = pr.list;
    matchedExactly = false;
  }

  // 3) Ordenação + limite
  const onlyGeneric = !f0.hasStructuredFilter && !f0.plainSearch;
  // Dica de UX: em pedidos “rápidos/fáceis”, priorize tempo; “difíceis”, priorize nota.
  let sortKey: SortKey | undefined = f0.sort ?? (onlyGeneric ? 'rating' : undefined);
  if (!f0.sort && f0.difficulty === 'easy') sortKey = 'prepTime';
  if (!f0.sort && f0.difficulty === 'hard') sortKey = 'rating';

  const limit = f0.limit ?? (f0.wantAll ? 100 : 12);
  const sorted = sortList(list, sortKey);
  const cards = capAndMap(sorted, limit);

  // 4) Nada mesmo? Ajuda curta e direta
  if (cards.length === 0) {
    return {
      content:
        'Não pintou nada com esses critérios. Quer tentar “vegana fácil”, “rápida 4.5+” ou “sem glúten em 15 min”?',
      recipes: [],
      suggestions: ['receitas fáceis', 'vegana rápida', 'rica em proteína 5⭐'],
    };
  }

  // 5) Texto natural (sem “Encontrei 25… Mostrando 12 de 25.”)
  const content = humanizeIntro(query, {
    f0,
    shown: cards.length,
    total: list.length,
    matchedExactly,
    sortKey,
  });

  return {
    content,
    recipes: cards,
    suggestions: cards.length < 5 ? ['receitas rápidas', 'vegana fácil', '5 ⭐'] : [],
  };
}


// =============================================================================
// Supabase: config / conversas / mensagens
// =============================================================================
export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .single();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return data as AIConfiguration | null;
}

export async function createAIConfiguration(
  config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert([config])
    .select()
    .single();

  if (error) throw error;
  return data as AIConfiguration;
}

export async function updateAIConfiguration(
  configId: string,
  updates: Partial<AIConfiguration>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .update(updates)
    .eq('id', configId)
    .select()
    .single();

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
  let payload: any = input;
  if (typeof input === 'string') {
    try { payload = JSON.parse(input); }
    catch { throw new Error('createAIConversation: payload inválido (string não é JSON)'); }
  }

  const row = {
    client_id: payload.client_id,
    nutritionist_id: payload.nutritionist_id ?? null,
    ai_config_id: payload.ai_config_id ?? null,
    title: payload.title ?? 'Nova conversa com IA',
    is_active: payload.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([row])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConversation;
}

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('client_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AIConversation[];
}

export async function getAIMessages(conversationId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as AIMessage[];
}

export async function createAIMessage(message: Omit<AIMessage, 'id' | 'created_at' | 'updated_at'>): Promise<AIMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert([message])
    .select()
    .single();

  if (error) throw error;
  return data as AIMessage;
}

// =============================================================================
// Orquestração principal — compatível com duas assinaturas
// =============================================================================
// Antiga: processAIMessage(content: string, ...)
// Nova:   processAIMessage({ conversationId, content, senderId })
export async function processAIMessage(
  arg1: any,
  _arg2?: any,
  _arg3?: any
): Promise<AIResponse> {
  let content = '';
  if (typeof arg1 === 'string') content = arg1;
  else if (arg1 && typeof arg1 === 'object' && 'content' in arg1) content = toSafeString(arg1.content);

  const intent: ChatIntent = detectUserIntent(content);

  switch (intent) {
    case 'recipe_search':
      return recommendRecipesFromText(content);

    case 'nutrition_recipe': {
      const rows = await fetchRecipesFromDB();
      return nutritionForRecipeAnswer(content, rows);
    }

    case 'nutrition_general':
      return nutritionGeneralAnswer(content);

    case 'cooking_tips':
      return cookingTipsAnswer(content);

    case 'substitutions':
      return substitutionsAnswer(content);

    case 'site_info':
      return siteInfoAnswer();

    case 'greetings':
      return greetingsAnswer();

    case 'thanks':
      return thanksAnswer();

    case 'help':
      return helpAnswer();

    case 'fallback':
    default: {
      const rows = await fetchRecipesFromDB();
      const hint = rows.length
        ? 'Dica: peça por **categoria**, **dificuldade**, **tempo** e **avaliação**. Ex.: "vegana fácil 15 min 4.5+"'
        : 'Posso te ajudar com dúvidas de nutrição e dicas de cozinha.';
      return {
        content: `Entendi! ${hint}`,
        recipes: [],
        suggestions: ['receitas fáceis', 'vegana rápida', '5 ⭐'],
      };
    }
  }
}
