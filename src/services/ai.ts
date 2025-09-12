// src/services/ai.ts
// =============================================================================
// Serviço de IA para o NutriChefe
// - Entende pedidos naturais: categoria, dificuldade, tempo, nutricionista, etc.
// - Busca direto no BD com supabase
// =============================================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

// =============================================================================
// Helpers UX
// =============================================================================
const GREETINGS = ['oi','olá','ola','eai','e aí','bom dia','boa tarde','boa noite','hey','hi','hello'];

function isGreeting(text: string) {
  const t = text.trim().toLowerCase();
  return GREETINGS.some(g => t === g || t.startsWith(g + ' ') || t.startsWith(g + '!'));
}

function isTooShortOrVague(text: string) {
  const t = text.trim();
  if (t.length < 6) return true;
  const vague = ['como vai', 'tudo bem', 'teste', 'alô', 'alo'];
  const tl = t.toLowerCase();
  return vague.some(v => tl.includes(v));
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function extractAuthorName(r: any): string {
  return (
    r?.author_profile?.full_name ??
    r?.__author_name ??
    r?.author_name ??
    r?.created_by_name ??
    'Autor'
  );
}

// =============================================================================
// Categorias fixas
// =============================================================================
type FixedCategory = { labelPt: string; dbKeysEn: string[]; variants: string[] };

const FIXED_CATEGORIES: FixedCategory[] = [
  { labelPt: 'Vegana', dbKeysEn: ['Vegan'], variants: ['vegana','vegan'] },
  { labelPt: 'Baixo Carboidrato', dbKeysEn: ['Low Carb','Keto'], variants: ['baixo carboidrato','low carb','keto'] },
  { labelPt: 'Rica em Proteína', dbKeysEn: ['High Protein'], variants: ['rica em proteina','proteica'] },
  { labelPt: 'Sem Glúten', dbKeysEn: ['Gluten-Free'], variants: ['sem glúten','sem gluten','gluten free'] },
  { labelPt: 'Vegetariana', dbKeysEn: ['Vegetarian'], variants: ['vegetariana','vegetarian'] },
];

function detectCategoryFromText(text: string): { labelPt: string; dbKeysEn: string[] } | null {
  const t = normalize(text);
  for (const cat of FIXED_CATEGORIES) {
    if (t.includes(normalize(cat.labelPt))) return { labelPt: cat.labelPt, dbKeysEn: cat.dbKeysEn };
    if (cat.variants.some(v => t.includes(normalize(v)))) return { labelPt: cat.labelPt, dbKeysEn: cat.dbKeysEn };
  }
  return null;
}

// =============================================================================
// Extração de filtros NL
// =============================================================================
function detectFiltersFromText(text: string): {
  maxPrepTime?: number;
  difficulty?: 'easy'|'medium'|'hard';
  onlyNutritionist?: boolean;
  authorName?: string;
  wantAll?: boolean;
} {
  const t = normalize(text);
  const filters: any = {};
  filters.wantAll = /\btodas?\b/.test(t);

  // tempo
  const timeMatch = t.match(/(\d{1,3})\s*(min|minuto|minutos)/);
  if (timeMatch) filters.maxPrepTime = parseInt(timeMatch[1], 10);
  if (!filters.maxPrepTime && /(rapida|rápida|rapido|rápido|pratica|express)/.test(t)) filters.maxPrepTime = 30;

  // dificuldade
  if (/(facil|fácil|iniciante|simples)/.test(t)) filters.difficulty = 'easy';
  else if (/(media|média|intermediaria)/.test(t)) filters.difficulty = 'medium';
  else if (/(dificil|difícil|avancada)/.test(t)) filters.difficulty = 'hard';

  // nutricionista
  if (/(por|de)\s+nutricionista/.test(t)) filters.onlyNutritionist = true;

  // autor específico
  const authorMatch = text.match(/(?:nutricionista\s+|por\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+){0,3})/i);
  if (authorMatch) {
    filters.authorName = authorMatch[1].trim();
    filters.onlyNutritionist = /nutricionista/i.test(authorMatch[0]);
  }

  return filters;
}

// =============================================================================
// Query builder
// =============================================================================
function buildRecipesBaseSelect(inner: boolean): string {
  if (inner) {
    return `
      id, title, description, image, category, prep_time, difficulty, rating, author_id,
      author_profile:profiles!inner(id, full_name, user_type)
    `;
  }
  return `
    id, title, description, image, category, prep_time, difficulty, rating, author_id,
    author_profile:profiles!recipes_author_id_fkey(id, full_name, user_type)
  `;
}

async function queryRecipesByAnyFilters(opts: {
  categories?: string[];
  difficulty?: 'easy'|'medium'|'hard';
  maxPrepTime?: number;
  authorName?: string;
  onlyNutritionist?: boolean;
  limit?: number;
}): Promise<any[]> {
  const { categories, difficulty, maxPrepTime, authorName, onlyNutritionist, limit = 50 } = opts;
  const needInner = !!(authorName || onlyNutritionist);

  let query = supabase.from('recipes').select(buildRecipesBaseSelect(needInner));

  if (categories?.length) {
    const orExpr = categories.map(k => `category.ilike.%${k}%`).join(',');
    query = query.or(orExpr);
  }
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (typeof maxPrepTime === 'number') query = query.lte('prep_time', maxPrepTime);
  if (onlyNutritionist) query = query.eq('author_profile.user_type', 'Nutritionist');
  if (authorName) query = query.ilike('author_profile.full_name', `%${authorName}%`);

  const { data, error } = await query.order('rating', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

function capAndMapRecipes(list: any[], cap = 12) {
  return list.slice(0, cap).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    image: r.image,
    category: r.category,
    prepTime: r.prep_time,
    difficulty: r.difficulty,
    rating: r.rating,
    author: extractAuthorName(r),
  }));
}

// =============================================================================
// Export: interpretador NL
// =============================================================================
export async function recommendRecipesFromText(content: string): Promise<AIResponse> {
  const cat = detectCategoryFromText(content);
  const f = detectFiltersFromText(content);

  const items = await queryRecipesByAnyFilters({
    categories: cat?.dbKeysEn,
    difficulty: f.difficulty,
    maxPrepTime: f.maxPrepTime,
    authorName: f.authorName,
    onlyNutritionist: f.onlyNutritionist,
    limit: f.wantAll ? 100 : 40,
  });

  if (!items.length) {
    return { content: 'Não encontrei receitas com esses critérios.', recipes: [], suggestions: [] };
  }

  const bits: string[] = [];
  if (cat) bits.push(cat.labelPt);
  if (f.difficulty) bits.push(`dificuldade ${f.difficulty}`);
  if (typeof f.maxPrepTime === 'number') bits.push(`até ${f.maxPrepTime} min`);
  if (f.authorName) bits.push(`autor: ${f.authorName}`);
  if (!f.authorName && f.onlyNutritionist) bits.push('de nutricionistas');

  const recipes = capAndMapRecipes(items, f.wantAll ? 100 : 12);

  return {
    content: `Aqui estão ${f.wantAll ? 'todas as' : 'algumas'} receitas${bits.length ? ' (' + bits.join(', ') + ')' : ''}:`,
    recipes,
    suggestions: [],
  };
}

// =============================================================================
// Processamento principal
// =============================================================================
export async function processAIMessage(
  content: string,
  aiConfig?: AIConfiguration,
  conversationHistory: AIMessage[] = []
): Promise<AIResponse> {
  if (isGreeting(content)) {
    return { content: 'Oi! 👋 Tudo bem? Me conta o que você quer ver hoje.', recipes: [], suggestions: [] };
  }
  if (isTooShortOrVague(content)) {
    return { content: 'Show! Me diz de que estilo você quer ideias (ex.: vegana, sem glúten). 😉', recipes: [], suggestions: [] };
  }

  // 1) tenta direto o roteador NL
  const resp = await recommendRecipesFromText(content);
  if (resp.recipes && resp.recipes.length) return resp;

  // 2) fallback para Gemini
  const gemini = await getGeminiResponse(content, aiConfig, conversationHistory);
  return { content: gemini.content, recipes: [], suggestions: [] };
}
