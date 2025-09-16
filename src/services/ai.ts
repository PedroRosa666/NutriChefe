// src/services/ai.ts
// =============================================================================
// Serviço de IA do NutriChefe — Busca natural de receitas do próprio banco
// - Interpreta linguagem natural (PT-BR) -> filtros (categoria, dificuldade, tempo, rating)
// - NUNCA recomenda receitas externas ao site (guardrails)
// - Compatível com seu schema: recipes, reviews, profiles (sem depender de FK no cache)
// =============================================================================

import { supabase } from '../lib/supabase';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

// =============================================================================
// Tipos auxiliares alinhados ao seu schema
// =============================================================================
type Difficulty = 'easy' | 'medium' | 'hard';
type SiteCategory =
  | 'Vegana'
  | 'Baixo Carboidrato'
  | 'Rica em Proteína'
  | 'Sem Glúten'
  | 'Vegetariana';

interface RecipeRow {
  id: string;                 // uuid no BD
  title: string;
  description: string;
  image: string;
  prep_time: number;
  difficulty: Difficulty;     // normalizada para easy|medium|hard
  rating: number | null;      // rating efetivo (coluna ou média das reviews)
  category: string;
  author_id?: string | null;
  author_name?: string | null;
  reviews?: { rating: number }[]; // opcional (não necessário p/ média)
  created_at?: string;
  updated_at?: string;
}

interface AppRecipeCard {
  id: number;                 // número derivado do uuid só p/ UI
  title: string;
  description: string;
  author: string;
  rating: number;
}

// =============================================================================
// Vocabulário e mapeamentos PT-BR
// =============================================================================
const DIFFICULTY_SYNONYMS: Record<Difficulty, string[]> = {
  easy: ['fácil', 'facil', 'simples', 'iniciante', 'tranquila', 'descomplicada'],
  medium: ['médio', 'medio', 'intermediário', 'intermediario', 'média', 'mediana'],
  hard: ['difícil', 'dificil', 'avançado', 'avancado', 'complexo', 'trabalhosa'],
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

// buckets de tempo
const TIME_BUCKETS = {
  rapido: { label: 'Rápido', max: 15 },   // ≤ 15
  medio:  { label: 'Médio', max: 30 },    // ≤ 30
  longo:  { label: 'Longo', min: 31 },    // > 30
};

const NUM_RE = /(\d+(?:[.,]\d+)?)/;

// =============================================================================
// Utils seguros
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

function avgRating(reviews?: { rating: number }[] | null): number {
  if (!reviews?.length) return 0;
  const m = reviews.reduce((a, r) => a + (r.rating ?? 0), 0) / reviews.length;
  return Math.round(m * 10) / 10;
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

// =============================================================================
// Parser de linguagem natural -> filtros
// =============================================================================
interface ParsedFilters {
  category?: SiteCategory;
  difficulty?: Difficulty;
  maxPrep?: number;     // minutos (≤)
  minPrep?: number;     // minutos (≥)
  minRating?: number;   // 0..5
  wantAll?: boolean;    // "todas/qualquer"
  plainSearch?: string; // termos livres
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
  // “média/médio”
  if (!f.difficulty && (/\bm[eé]di[oa]\b/.test(text))) f.difficulty = 'medium';

  // Tempo de preparo (palavras)
  if (/\br[aá]pid[oa]\b/.test(text) || /\b<=?\s*15\b/.test(text)) f.maxPrep = 15;
  if (/\bm[eé]di[oa]\b/.test(text) || /\b<=?\s*30\b/.test(text)) f.maxPrep = f.maxPrep ?? 30;
  if (/\blongo?\b|\b>?\s*30\b/.test(text)) f.minPrep = 31;

  // “em X minutos / até X min”
  const mTime = text.match(new RegExp(`\\b(em|ate|até|<=?)\\s*${NUM_RE.source}\\s*(min|mins|minutos)\\b`));
  if (mTime) {
    const mins = parseFloat(mTime[2].replace(',', '.'));
    if (!isNaN(mins)) f.maxPrep = Math.min(f.maxPrep ?? Infinity, mins);
  }

  // Avaliação mínima: 4+, 4.5+, 5 estrelas
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

  // termo livre
  const cleaned = (q || '').trim();
  if (cleaned && cleaned.length > 2) f.plainSearch = cleaned;

  return f;
}

// =============================================================================
// Busca no Supabase com filtros (sem JOIN; usa consultas separadas)
// =============================================================================
async function fetchRecipesFromDB(): Promise<RecipeRow[]> {
  // 1) Buscar receitas básicas
  const { data: recipeRows, error: recipesErr } = await supabase
    .from('recipes')
    .select('id, title, description, image, prep_time, difficulty, category, rating, author_id, created_at, updated_at');

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
    author_id: string | null;
    created_at?: string;
    updated_at?: string;
  }>;

  if (rows.length === 0) return [];

  // 2) Buscar autores na tabela profiles
  const authorIds = Array.from(new Set(rows.map(r => r.author_id).filter(Boolean))) as string[];
  let authorsMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds);

    if (!profilesErr && profiles) {
      authorsMap = Object.fromEntries(
        profiles.map(p => [p.id as string, (p.full_name as string) || 'NutriChefe'])
      );
    }
  }

  // 3) Buscar reviews e calcular média por receita (para quando recipes.rating estiver nulo)
  const recipeIds = rows.map(r => r.id);
  const { data: reviews, error: reviewsErr } = await supabase
    .from('reviews')
    .select('recipe_id, rating')
    .in('recipe_id', recipeIds);

  const ratingsAgg: Record<string, { sum: number; count: number }> = {};
  if (!reviewsErr && reviews && reviews.length) {
    for (const r of reviews as Array<{ recipe_id: string; rating: number }>) {
      if (!ratingsAgg[r.recipe_id]) ratingsAgg[r.recipe_id] = { sum: 0, count: 0 };
      ratingsAgg[r.recipe_id].sum += r.rating ?? 0;
      ratingsAgg[r.recipe_id].count += 1;
    }
  }

  // 4) Montar o resultado uniformizado
  const result: RecipeRow[] = rows.map(r => {
    // rating efetivo: usa coluna se existir; senão média das reviews
    let effectiveRating: number | null = r.rating ?? null;
    if (effectiveRating == null && ratingsAgg[r.id]?.count) {
      const avg = ratingsAgg[r.id].sum / ratingsAgg[r.id].count;
      effectiveRating = Math.round(avg * 10) / 10;
    }

    // normalizar dificuldade para union type
    const diffNorm = normalize(r.difficulty);
    const difficulty: Difficulty =
      (diffNorm.includes('facil') || diffNorm.includes('fácil')) ? 'easy' :
      (diffNorm.includes('medi')) ? 'medium' :
      (diffNorm.includes('dific')) ? 'hard' :
      'medium'; // fallback seguro

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      image: r.image,
      prep_time: r.prep_time,
      difficulty,
      category: r.category || '',
      rating: effectiveRating,          // pode ser null
      author_id: r.author_id,
      author_name: (r.author_id && authorsMap[r.author_id]) ? authorsMap[r.author_id] : 'NutriChefe',
      reviews: [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    } as RecipeRow;
  });

  return result;
}

function applyFilters(rows: RecipeRow[], f: ParsedFilters): RecipeRow[] {
  let list = rows.slice();

  // Categoria
  if (f.category) {
    const needle = normalize(f.category);
    list = list.filter(r => normalize(r.category).includes(needle));
  }

  // Dificuldade
  if (f.difficulty) {
    list = list.filter(r => r.difficulty === f.difficulty);
  }

  // Tempo
  if (typeof f.maxPrep === 'number') list = list.filter(r => r.prep_time <= f.maxPrep);
  if (typeof f.minPrep === 'number') list = list.filter(r => r.prep_time >= f.minPrep);

  // Avaliação
  if (typeof f.minRating === 'number') {
    list = list.filter(r => {
      const rating = (typeof r.rating === 'number' ? r.rating : 0);
      return rating >= f.minRating!;
    });
  }

  // Full-text leve (título/descrição)
  if (f.plainSearch) {
    const n = normalize(f.plainSearch);
    list = list.filter(r =>
      normalize(r.title).includes(n) ||
      normalize(r.description || '').includes(n)
    );
  }

  // Ordena: rating desc, depois mais rápido
  list.sort((a, b) => {
    const ar = (typeof a.rating === 'number' ? a.rating : 0);
    const br = (typeof b.rating === 'number' ? b.rating : 0);
    if (br !== ar) return br - ar;
    return a.prep_time - b.prep_time;
  });

  return list;
}

function capAndMap(list: RecipeRow[], limit = 12): AppRecipeCard[] {
  return list.slice(0, limit).map(mapRowToCard);
}

// =============================================================================
// API pública: recomendação por linguagem natural
// =============================================================================
export async function recommendRecipesFromText(query: string): Promise<AIResponse> {
  const f = parseQueryToFilters(query);
  const allRows = await fetchRecipesFromDB();
  const filtered = applyFilters(allRows, f);

  if (filtered.length === 0) {
    return {
      content:
        'Não encontrei receitas com esses critérios. Você pode tentar algo como "vegana fácil", "rápida 4.5+" ou "sem glúten em 15 min"?',
      recipes: [],
      suggestions: ['vegana fácil', 'baixo carboidrato rápido', 'rica em proteína 4.5+'],
    };
  }

  const bits: string[] = [];
  if (f.category) bits.push(f.category);
  if (f.difficulty) bits.push(f.difficulty === 'easy' ? 'fáceis' : f.difficulty === 'medium' ? 'médias' : 'difíceis');
  if (typeof f.maxPrep === 'number') bits.push(`até ${f.maxPrep} min`);
  if (typeof f.minPrep === 'number') bits.push(`mais de ${f.minPrep - 1} min`);
  if (typeof f.minRating === 'number') bits.push(`${f.minRating}+ ⭐`);

  const msg =
    filtered.length > 1
      ? `Encontrei ${filtered.length} receita(s)${bits.length ? ` (${bits.join(', ')})` : ''}.`
      : `Encontrei 1 receita${bits.length ? ` (${bits.join(', ')})` : ''}.`;

  return {
    content: msg,
    recipes: capAndMap(filtered, f.wantAll ? 100 : 12),
    suggestions: filtered.length < 5 ? ['receitas fáceis', 'receitas rápidas', 'receitas 5 ⭐'] : [],
  };
}

// =============================================================================
// Conversas / Mensagens (Supabase) — com inserts por array
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
// Processamento principal — compatível com assinatura antiga e nova
// Antiga: processAIMessage(content: string, ...)
// Nova:   processAIMessage({ conversationId, content, senderId })
// =============================================================================
export async function processAIMessage(
  arg1: any,
  _arg2?: any,
  _arg3?: any
): Promise<AIResponse> {
  let content = '';
  if (typeof arg1 === 'string') {
    content = arg1;
  } else if (arg1 && typeof arg1 === 'object' && 'content' in arg1) {
    content = toSafeString(arg1.content);
  }

  const norm = normalize(content);

  // Heurística: se parecer intenção de receita/filtro -> recomendar
  const wantsRecipe =
    /\breceit/.test(norm) ||
    CATEGORY_LABELS.some(cat => norm.includes(normalize(cat))) ||
    Object.values(DIFFICULTY_SYNONYMS).some(syns => syns.some(s => norm.includes(normalize(s)))) ||
    /\b(15|30)\b\s*(min|mins|minutos)|\b(r[aá]pid|m[eé]di|longo)\b/.test(norm) ||
    /\b(4|4[.,]5|5)\s*(\+|estrelas?|\*)?/.test(norm);

  if (wantsRecipe) {
    return recommendRecipesFromText(content);
  }

  // Resposta neutra curta (sem citar receitas externas)
  return {
    content:
      'Posso ajudar com dúvidas de nutrição, substituições e técnicas. Se quiser, também sugiro **receitas do nosso site** — por exemplo: "vegana fácil", "baixo carboidrato rápido 4.5+" ou "sem glúten em 15 min".',
    recipes: [],
    suggestions: ['vegana fácil', 'baixo carboidrato rápido', 'rica em proteína 4.5+'],
  };
}
