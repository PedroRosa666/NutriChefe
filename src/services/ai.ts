// src/services/ai.ts
// =============================================================================
// Serviço de IA do NutriChefe — Busca natural de receitas do próprio banco
// - Interpreta linguagem natural em PT-BR para: categoria, dificuldade, tempo, rating
// - Categorias oficiais: Vegana, Baixo Carboidrato, Rica em Proteína, Sem Glúten, Vegetariana
// - Filtros: Fácil/Médio/Difícil • Rápido(≤15)/Médio(≤30)/Longo(>30) • Avaliação mínima (4, 4.5, 5)
// - NUNCA recomenda receitas externas ao site (guardrails)
// =============================================================================

import { supabase } from '../lib/supabase';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

// =============================================================================
// Tipos auxiliares
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
  difficulty: Difficulty;
  rating: number | null;      // rating médio calculado
  category: string;           // texto livre (vamos mapear)
  author_id?: string | null;
  author_name?: string | null;
  reviews?: { rating: number }[];
  created_at?: string;
  updated_at?: string;
}

interface AppRecipeCard {
  id: number;                 // número derivado do uuid pra UI atual
  title: string;
  description: string;
  author: string;
  rating: number;
}

// =============================================================================
// Mapeamentos e vocabulário PT-BR
// =============================================================================
const DIFFICULTY_SYNONYMS: Record<Difficulty, string[]> = {
  easy: ['fácil', 'facil', 'simples', 'iniciante'],
  medium: ['médio', 'medio', 'intermediário', 'intermediario'],
  hard: ['difícil', 'dificil', 'avançado', 'avancado', 'complexo'],
};

const CATEGORY_LABELS: SiteCategory[] = [
  'Vegana',
  'Baixo Carboidrato',
  'Rica em Proteína',
  'Sem Glúten',
  'Vegetariana',
];

// termos que mapeiam para cada categoria oficial
const CATEGORY_SYNONYMS: Record<SiteCategory, string[]> = {
  'Vegana': ['vegana', 'vegano', 'vegan'],
  'Baixo Carboidrato': ['baixo carboidrato', 'low carb', 'pouco carbo', 'baixo carb'],
  'Rica em Proteína': ['rica em proteína', 'muita proteina', 'alta proteína', 'alto teor proteico', 'proteica'],
  'Sem Glúten': ['sem glúten', 'sem gluten', 'gluten free', 'sg', 'livre de glúten'],
  'Vegetariana': ['vegetariana', 'vegetariano', 'veggie', 'ovo-lacto'],
};

// tempo de preparo
const TIME_BUCKETS = {
  rapido: { label: 'Rápido', max: 15 },   // ≤15
  medio: { label: 'Médio', max: 30 },     // ≤30
  longo: { label: 'Longo', min: 31 },     // >30
};

// regexzinhos úteis
const NUM_RE = /(\d+(?:[.,]\d+)?)/;

// =============================================================================
// Utils
// =============================================================================
function uuidToNumericId(uuid: string): number {
  // Gera um número estável só pra UI (não é a PK real)
  // Pega os primeiros 8 hex do UUID e transforma em int
  const hex = uuid.replace(/-/g, '').slice(0, 8);
  return parseInt(hex, 16);
}

function normalize(s: string) {
  return s
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
  wantAll?: boolean;    // o usuário quer "todas", "qualquer", etc.
  plainSearch?: string; // termos livres para full-text
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
  // também aceita “média”
  if (!f.difficulty && (/\bm[eé]di[oa]\b/.test(text))) f.difficulty = 'medium';

  // Tempo de preparo
  if (/\br[aá]pid[oa]\b/.test(text) || /\b<=?\s*15\b/.test(text)) f.maxPrep = 15;
  if (/\bm[eé]di[oa]\b/.test(text) || /\b<=?\s*30\b/.test(text)) f.maxPrep = f.maxPrep ?? 30;
  if (/\blongo?\b|\b>?\s*30\b/.test(text)) f.minPrep = 31;

  // “em X minutos”
  const mTime = text.match(new RegExp(`\\b(em|ate|até|<=?)\\s*${NUM_RE.source}\\s*(min|mins|minutos)\\b`));
  if (mTime) {
    const mins = parseFloat(mTime[2].replace(',', '.'));
    f.maxPrep = Math.min(f.maxPrep ?? Infinity, mins);
  }

  // Avaliação mínima “4”, “4+”, “4.5+”, “5 estrelas”
  const starPlus = text.match(new RegExp(`${NUM_RE.source}\\s*(\\+|mais)?\\s*(\\*|estrela|estrelas)?`));
  if (starPlus) {
    const val = parseFloat(starPlus[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0 && val <= 5) {
      if (/\+|mais/.test(starPlus[2] || '') || /estrela/.test(starPlus[3] || '')) {
        f.minRating = val;
      }
    }
  }
  if (/\b4\\+|4\\s*\\+\b/.test(text)) f.minRating = Math.max(f.minRating ?? 0, 4);
  if (/\b4[.,]5\\+|4\\s*,?\\s*5\\s*\\+\b/.test(text)) f.minRating = Math.max(f.minRating ?? 0, 4.5);
  if (/\b5\\s*(\\*|estrelas?)?\b/.test(text)) f.minRating = 5;

  // “todas”, “qualquer”
  if (/\btod[ao]s?\b|\bqualquer\b/.test(text)) f.wantAll = true;

  // termo livre
  const cleaned = q.trim();
  if (cleaned && cleaned.length > 2) f.plainSearch = cleaned;

  return f;
}

// =============================================================================
// Busca no Supabase com filtros
// =============================================================================
async function fetchRecipesFromDB(): Promise<RecipeRow[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      id, title, description, image, prep_time, difficulty, category,
      reviews:reviews(rating),
      author:users!recipes_author_id_fkey(full_name)
    `);

  if (error) throw error;

  // adaptando o alias (caso preciso)
  return (data || []).map((r: any) => ({
    ...r,
    author_name: r.author?.full_name ?? null,
  })) as RecipeRow[];
}

function applyFilters(rows: RecipeRow[], f: ParsedFilters): RecipeRow[] {
  let list = rows.slice();

  // Categoria (texto livre do BD vs. rótulo oficial)
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

  // Rating
  if (typeof f.minRating === 'number') {
    list = list.filter(r => {
      const rating = (typeof r.rating === 'number' ? r.rating : avgRating(r.reviews)) || 0;
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
    const ar = (typeof a.rating === 'number' ? a.rating : avgRating(a.reviews)) || 0;
    const br = (typeof b.rating === 'number' ? b.rating : avgRating(b.reviews)) || 0;
    if (br !== ar) return br - ar;
    return a.prep_time - b.prep_time;
  });

  return list;
}

// Limita e mapeia para o formato esperado pelo chat
function capAndMap(list: RecipeRow[], limit = 12): AppRecipeCard[] {
  return list.slice(0, limit).map(mapRowToCard);
}

// =============================================================================
// API pública para recomendação
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

  // Mensagem natural
  const bits: string[] = [];
  if (f.category) bits.push(f.category);
  if (f.difficulty) {
    bits.push(
      f.difficulty === 'easy' ? 'fáceis' :
      f.difficulty === 'medium' ? 'médias' : 'difíceis'
    );
  }
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
// Conversas / Mensagens (Supabase)
// =============================================================================
export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createAIConfiguration(
  config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert(config)
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

export async function getAIConversations(userId: string) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('client_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any[];
}

// Substitua a função createAIConversation existente por esta
export async function createAIConversation(input: {
  client_id: string;
  nutritionist_id?: string | null;
  ai_config_id?: string | null;
  title?: string;
  is_active?: boolean;
}): Promise<AIConversation> {
  // Se alguém passar uma string JSON por engano, tentamos fazer o parse
  let payload: any = input as any;
  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input);
    } catch {
      // Se não der parse, joga erro claro
      throw new Error('createAIConversation: payload inválido (string não é JSON)');
    }
  }

  const row = {
    client_id: payload.client_id,                        // uuid do usuário (obrigatório)
    nutritionist_id: payload.nutritionist_id ?? null,    // uuid opcional
    ai_config_id: payload.ai_config_id ?? null,          // uuid opcional
    title: payload.title ?? 'Nova conversa com IA',
    is_active: payload.is_active ?? true,
  };

  // ⚠️ Use array no insert (forma recomendada pelo Supabase)
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([row])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConversation;
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

export async function createAIMessage(message: Omit<AIMessage, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data as AIMessage;
}

// =============================================================================
// Processamento principal: decide entre “recomendar receitas” e “responder geral”
// Guardrails: nunca citar receitas externas.
// =============================================================================
export async function processAIMessage(params: {
  conversationId: string;
  content: string;
  senderId: string;
}): Promise<AIResponse> {
  const { content } = params;

  // Heurística: se o usuário pede “receita(s)” OU cita categorias/dificuldades/tempo/estrelas -> recomendar
  const norm = normalize(content);
  const wantsRecipe =
    /\breceit/.test(norm) ||
    CATEGORY_LABELS.some(cat => norm.includes(normalize(cat))) ||
    Object.values(DIFFICULTY_SYNONYMS).some(syns => syns.some(s => norm.includes(normalize(s)))) ||
    /\b(15|30)\b\s*(min|mins|minutos)|\b(r[aá]pid|m[eé]di|longo)\b/.test(norm) ||
    /\b(4|4[.,]5|5)\s*(\+|estrelas?|\*)?/.test(norm);

  if (wantsRecipe) {
    return recommendRecipesFromText(content);
  }

  // Caso contrário: resposta curta e neutra (sem citar receitas externas)
  // (Se você quiser plugar seu provedor LLM aqui, faça chamando-o com um prompt contendo os guardrails)
  return {
    content:
      'Posso te ajudar com dúvidas de nutrição, substituições e técnicas. Se quiser, também posso sugerir **receitas do nosso site** — por exemplo: "vegana fácil", "baixo carboidrato rápido 4.5+" ou "sem glúten em 15 min".',
    recipes: [],
    suggestions: ['vegana fácil', 'baixo carboidrato rápido', 'rica em proteína 4.5+'],
  };
}
