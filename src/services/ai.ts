// src/services/ai.ts
// =============================================================================
// Serviço de IA (busca dinâmica por filtros NL) para o NutriChefe
// =============================================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIMessage, AIResponse } from '../types/ai';

// =============================================================================
// Helpers
// =============================================================================
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
// Extração de filtros a partir do texto
// =============================================================================
function detectFiltersFromText(text: string): {
  maxPrepTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  onlyNutritionist?: boolean;
  authorName?: string;
  wantAll?: boolean;
} {
  const t = normalize(text);
  const filters: any = {};
  filters.wantAll = /\btodas?\b/.test(t);

  // Tempo
  const timeMatch = t.match(/(\d{1,3})\s*(min|minuto|minutos)/);
  if (timeMatch) filters.maxPrepTime = parseInt(timeMatch[1], 10);
  if (!filters.maxPrepTime && /(rapida|rápida|rapido|rápido|pratica|prático|express)/.test(t)) {
    filters.maxPrepTime = 30;
  }

  // Dificuldade
  if (/(facil|fácil|iniciante|simples)/.test(t)) filters.difficulty = 'easy';
  else if (/(media|média|intermediaria|intermediária)/.test(t)) filters.difficulty = 'medium';
  else if (/(dificil|difícil|avancada|avançada)/.test(t)) filters.difficulty = 'hard';

  // Apenas nutricionistas
  if (/(por|de)\s+nutricionista(s)?/.test(t)) filters.onlyNutritionist = true;

  // Autor por nome
  const authorMatch = text.match(
    /(?:nutricionista\s+|por\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+){0,3})/i
  );
  if (authorMatch) {
    filters.authorName = authorMatch[1].trim();
    filters.onlyNutritionist = /nutricionista/i.test(authorMatch[0]);
  }

  return filters;
}

// =============================================================================
// Categorias fixas
// =============================================================================
type FixedCategory = {
  labelPt: string;
  dbKeysEn: string[];
  variants: string[];
};

const FIXED_CATEGORIES: FixedCategory[] = [
  { labelPt: 'Vegana', dbKeysEn: ['Vegan'], variants: ['vegana', 'vegan'] },
  { labelPt: 'Baixo Carboidrato', dbKeysEn: ['Low Carb', 'Keto'], variants: ['low carb', 'keto'] },
  { labelPt: 'Rica em Proteína', dbKeysEn: ['High Protein'], variants: ['rica em proteina', 'proteica'] },
  { labelPt: 'Sem Glúten', dbKeysEn: ['Gluten-Free'], variants: ['sem glúten', 'sem gluten'] },
  { labelPt: 'Vegetariana', dbKeysEn: ['Vegetarian'], variants: ['vegetariana'] },
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
// Query builders
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

type RecipeQueryOpts = {
  categories?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  authorName?: string;
  onlyNutritionist?: boolean;
  limit?: number;
};

async function queryRecipesByAnyFilters(opts: RecipeQueryOpts): Promise<any[]> {
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

// =============================================================================
// Formatação para UI
// =============================================================================
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
// Export principal: interpretador NL
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
    return {
      content: 'Não encontrei receitas com esses critérios. Quer tentar flexibilizar algum filtro?',
      recipes: [],
      suggestions: [],
    };
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
// Integração com o fluxo atual da IA
// =============================================================================
export async function processAIMessage(
  content: string,
  aiConfig?: AIConfiguration,
  conversationHistory: AIMessage[] = []
): Promise<AIResponse> {
  // tenta sempre o roteador NL
  const resp = await recommendRecipesFromText(content);
  if (resp.recipes && resp.recipes.length) return resp;

  // fallback: só responder com Gemini se não achou nada
  const gemini = await getGeminiResponse(content, aiConfig, conversationHistory);
  return { content: gemini.content, recipes: [], suggestions: [] };
}
