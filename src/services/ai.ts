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
// Database interaction functions
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

export async function createAIConfiguration(config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert(config)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAIConfiguration(id: string, updates: Partial<AIConfiguration>): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(`
      *,
      ai_configuration:ai_configurations!ai_conversations_ai_config_id_fkey(*)
    `)
    .eq('client_id', userId)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createAIConversation(conversation: Omit<AIConversation, 'id' | 'created_at' | 'updated_at' | 'last_message_at'>): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert(conversation)
    .select(`
      *,
      ai_configuration:ai_configurations!ai_conversations_ai_config_id_fkey(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getAIMessages(conversationId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createAIMessage(message: Omit<AIMessage, 'id' | 'created_at'>): Promise<AIMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================================================
// Helpers e detecção de intenções
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

function isRecipeRequest(text: string): boolean {
  const t = normalize(text);
  const recipeKeywords = [
    'receita', 'receitas', 'prato', 'pratos', 'comida', 'cozinhar',
    'ingrediente', 'ingredientes', 'preparo', 'preparar', 'fazer',
    'culinaria', 'culinária', 'gastronomia', 'alimento', 'alimentos'
  ];
  return recipeKeywords.some(keyword => t.includes(keyword));
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
  minRating?: number;
  onlyNutritionist?: boolean;
  authorName?: string;
  wantAll?: boolean;
  searchTerm?: string;
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

  // avaliação/rating
  const ratingMatch = t.match(/avaliacao|avaliação|nota|estrela|rating.*?(\d+(?:[.,]\d+)?)/);
  if (ratingMatch) {
    const rating = parseFloat(ratingMatch[1].replace(',', '.'));
    if (rating >= 1 && rating <= 5) filters.minRating = rating;
  }
  
  // Detectar padrões como "3 para cima", "acima de 4", etc.
  const ratingUpMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:para\s*cima|pra\s*cima|ou\s*mais|acima)/);
  if (ratingUpMatch) {
    const rating = parseFloat(ratingUpMatch[1].replace(',', '.'));
    if (rating >= 1 && rating <= 5) filters.minRating = rating;
  }
  
  const aboveRatingMatch = t.match(/(?:acima\s*de|mais\s*que|superior\s*a)\s*(\d+(?:[.,]\d+)?)/);
  if (aboveRatingMatch) {
    const rating = parseFloat(aboveRatingMatch[1].replace(',', '.'));
    if (rating >= 1 && rating <= 5) filters.minRating = rating;
  }

  // nutricionista
  if (/(por|de)\s+nutricionista/.test(t)) filters.onlyNutritionist = true;

  // autor específico
  const authorMatch = text.match(/(?:nutricionista\s+|por\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+){0,3})/i);
  if (authorMatch) {
    filters.authorName = authorMatch[1].trim();
    filters.onlyNutritionist = /nutricionista/i.test(authorMatch[0]);
  }

  // termo de busca geral (ingredientes, nomes de pratos)
  const ingredientKeywords = ['com', 'de', 'frango', 'peixe', 'carne', 'ovo', 'queijo', 'chocolate', 'banana', 'maçã', 'tomate', 'alface', 'arroz', 'feijão', 'batata', 'cenoura', 'brócolis', 'espinafre', 'salmão', 'atum', 'camarão'];
  for (const ingredient of ingredientKeywords) {
    if (t.includes(ingredient)) {
      filters.searchTerm = ingredient;
      break;
    }
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
  minRating?: number;
  searchTerm?: string;
  authorName?: string;
  onlyNutritionist?: boolean;
  limit?: number;
}): Promise<any[]> {
  const { categories, difficulty, maxPrepTime, minRating, searchTerm, authorName, onlyNutritionist, limit = 50 } = opts;
  const needInner = !!(authorName || onlyNutritionist);

  let query = supabase.from('recipes').select(buildRecipesBaseSelect(needInner));

  if (categories?.length) {
    const orExpr = categories.map(k => `category.ilike.%${k}%`).join(',');
    query = query.or(orExpr);
  }
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (typeof maxPrepTime === 'number') query = query.lte('prep_time', maxPrepTime);
  if (typeof minRating === 'number') query = query.gte('rating', minRating);
  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }
  if (onlyNutritionist) query = query.eq('author_profile.user_type', 'Nutritionist');
  if (authorName) query = query.ilike('author_profile.full_name', `%${authorName}%`);

  const { data, error } = await query.order('rating', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// Função para buscar receitas similares quando não encontrar resultados exatos
async function findSimilarRecipes(originalFilters: any): Promise<any[]> {
  // Tentar com filtros mais flexíveis
  const relaxedFilters = { ...originalFilters };
  
  // Relaxar avaliação (diminuir em 0.5)
  if (relaxedFilters.minRating && relaxedFilters.minRating > 1) {
    relaxedFilters.minRating = Math.max(1, relaxedFilters.minRating - 0.5);
  }
  
  // Relaxar tempo de preparo (aumentar em 15 min)
  if (relaxedFilters.maxPrepTime) {
    relaxedFilters.maxPrepTime += 15;
  }
  
  // Relaxar dificuldade
  if (relaxedFilters.difficulty === 'easy') {
    relaxedFilters.difficulty = 'medium';
  } else if (relaxedFilters.difficulty === 'hard') {
    relaxedFilters.difficulty = 'medium';
  }
  
  let results = await queryRecipesByAnyFilters(relaxedFilters);
  
  // Se ainda não encontrou, buscar apenas por categoria
  if (!results.length && originalFilters.categories) {
    results = await queryRecipesByAnyFilters({
      categories: originalFilters.categories,
      limit: 20
    });
  }
  
  // Se ainda não encontrou, buscar receitas populares
  if (!results.length) {
    const { data } = await supabase
      .from('recipes')
      .select(buildRecipesBaseSelect(false))
      .gte('rating', 4)
      .order('rating', { ascending: false })
      .limit(10);
    results = data || [];
  }
  
  return results;
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
    minRating: f.minRating,
    searchTerm: f.searchTerm,
    authorName: f.authorName,
    onlyNutritionist: f.onlyNutritionist,
    limit: f.wantAll ? 100 : 40,
  });

  let responseMessage = '';
  let finalRecipes = items;
  
  if (!items.length) {
    // Buscar receitas similares
    const similarItems = await findSimilarRecipes({
      categories: cat?.dbKeysEn,
      difficulty: f.difficulty,
      maxPrepTime: f.maxPrepTime,
      minRating: f.minRating,
      searchTerm: f.searchTerm,
      authorName: f.authorName,
      onlyNutritionist: f.onlyNutritionist,
    });
    
    if (similarItems.length) {
      responseMessage = 'Não encontrei receitas exatamente com esses critérios, mas aqui estão algumas sugestões similares:';
      finalRecipes = similarItems;
    } else {
      return { 
        content: 'Não encontrei receitas com esses critérios. Que tal tentar algo mais geral como "receitas fáceis" ou "receitas veganas"?', 
        recipes: [], 
        suggestions: ['receitas fáceis', 'receitas veganas', 'receitas rápidas', 'receitas saudáveis'] 
      };
    }
  } else {
    const bits: string[] = [];
    if (cat) bits.push(cat.labelPt);
    if (f.difficulty) {
      const difficultyMap = { easy: 'fáceis', medium: 'médias', hard: 'difíceis' };
      bits.push(difficultyMap[f.difficulty]);
    }
    if (typeof f.maxPrepTime === 'number') bits.push(`até ${f.maxPrepTime} min`);
    if (typeof f.minRating === 'number') bits.push(`avaliação ${f.minRating}+ estrelas`);
    if (f.searchTerm) bits.push(`com ${f.searchTerm}`);
    if (f.authorName) bits.push(`por ${f.authorName}`);
    if (!f.authorName && f.onlyNutritionist) bits.push('de nutricionistas');
    
    responseMessage = `Encontrei ${finalRecipes.length} receita${finalRecipes.length > 1 ? 's' : ''}${bits.length ? ' (' + bits.join(', ') + ')' : ''}:`;
  }

  const recipes = capAndMapRecipes(finalRecipes, f.wantAll ? 100 : 12);

  return {
    content: responseMessage,
    recipes,
    suggestions: recipes.length < 5 ? ['receitas fáceis', 'receitas rápidas', 'receitas saudáveis'] : [],
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

  // 1) Se for uma pergunta sobre receitas, usar o sistema de busca inteligente
  if (isRecipeRequest(content)) {
    return await recommendRecipesFromText(content);
  }

  // 2) Para outras perguntas, usar Gemini
  const gemini = await getGeminiResponse(content, aiConfig, conversationHistory);
  return { content: gemini.content, recipes: [], suggestions: [] };
}