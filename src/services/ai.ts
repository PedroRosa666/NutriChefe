// src/services/ai.ts
// =============================================================================
// Serviço de IA unificado (com RAG simples)
// - CRUD de configurações, conversas e mensagens
// - Busca de receitas no Supabase
// - RAG: extrai filtros da pergunta, consulta o banco, fallback inteligente
// - Usa o Gemini APENAS para formatar a resposta a partir dos dados do banco
// =============================================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import type { Recipe } from '../types/recipe';

// =============================================================================
// Utilidades
// =============================================================================

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// =============================================================================
// Extrator de intenção / filtros de receitas (RAG)
// =============================================================================

type RecipeFilters = {
  ingredients: string[];
  category?: string;
  dietary?: string[];
  maxPrepTime?: number;
  difficulty?: 'easy'|'medium'|'hard';
  freeText?: string;
};

const CATEGORY_KEYWORDS = [
  'café da manhã', 'cafe da manha', 'almoço', 'almoco', 'jantar',
  'lanche', 'sobremesa', 'snack', 'entrada', 'bebida'
];

const DIET_KEYWORDS = [
  'vegana','vegano','vegetariana','vegetariano',
  'sem glúten','sem gluten','sem lactose',
  'low carb','proteica','proteico','keto','paleo'
];

const DIFFICULTY_MAP: Record<string, 'easy'|'medium'|'hard'> = {
  'fácil':'easy','facil':'easy',
  'médio':'medium','medio':'medium',
  'difícil':'hard','dificil':'hard'
};

export function extractFilters(question: string): RecipeFilters {
  const q = normalize(question);

  // Ingredientes
  const ingredients: string[] = [];
  const ingMatch = q.match(/\b(com|contendo)\s+([a-z0-9 ,\-]+)/i);
  if (ingMatch?.[2]) {
    ingredients.push(
      ...ingMatch[2].split(/,| e /).map(s => s.trim()).filter(Boolean)
    );
  } else {
    const simples = q.match(/\bcom\s+([a-z0-9 ,\-]+)/);
    if (simples?.[1]) {
      ingredients.push(
        ...simples[1].split(/,| e /).map(s => s.trim()).filter(Boolean)
      );
    }
  }

  // Categoria
  let category: string | undefined;
  for (const c of CATEGORY_KEYWORDS) {
    if (q.includes(normalize(c))) { category = c; break; }
  }

  // Dietas/estilos
  const dietary = DIET_KEYWORDS.filter(k => q.includes(normalize(k)));

  // Tempo de preparo
  let maxPrepTime: number | undefined;
  const timeMatch = q.match(/(\d{1,3})\s*(min|mins|minutos)/);
  if (timeMatch) maxPrepTime = Number(timeMatch[1]);

  // Dificuldade
  let difficulty: 'easy'|'medium'|'hard' | undefined;
  for (const [pt, lv] of Object.entries(DIFFICULTY_MAP)) {
    if (q.includes(pt)) { difficulty = lv; break; }
  }

  return { ingredients, category, dietary, maxPrepTime, difficulty, freeText: question };
}

// =============================================================================
// Consultas de receitas no Supabase (principal + fallback)
// =============================================================================

async function queryRecipes(filters: RecipeFilters, limit = 8): Promise<Recipe[]> {
  // Observação: a tabela recipes deve ter colunas:
  // id, title, description, image, prep_time, difficulty, rating, category, ingredients(text[]), instructions(text[])
  let q = supabase.from('recipes').select('*').limit(limit);

  if (filters.maxPrepTime) q = q.lte('prep_time', filters.maxPrepTime);
  if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
  if (filters.category) q = q.ilike('category', `%${filters.category}%`);

  if (filters.ingredients.length) {
    // exige TODOS os ingredientes pedidos
    for (const ing of filters.ingredients) {
      q = q.contains('ingredients', [ing]);
    }
  }

  if (filters.dietary?.length) {
    const term = filters.dietary.join(' | ');
    // abrange título/descrição e o array (via cast para texto)
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,ingredients::text.ilike.%${term}%`);
  }

  if (filters.freeText) {
    const t = filters.freeText;
    q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data as any as Recipe[]) || [];
}

async function fallbackSimilarRecipes(filters: RecipeFilters, limit = 8): Promise<Recipe[]> {
  // 1) Algum dos ingredientes
  if (filters.ingredients.length) {
    const ors = filters.ingredients.map(i => `ingredients.cs.{"${i}"}`).join(',');
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .or(ors)
      .limit(limit);
    if (error) throw error;
    if (data?.length) return data as any as Recipe[];
  }

  // 2) Categoria
  if (filters.category) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .ilike('category', `%${filters.category}%`)
      .order('rating', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (data?.length) return data as any as Recipe[];
  }

  // 3) Populares
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as any as Recipe[]) || [];
}

// =============================================================================
// Orquestrador RAG: responder com base SOMENTE no conteúdo do site
// =============================================================================

export async function answerQuestionWithSiteData(question: string): Promise<{
  found: boolean;
  primary: Recipe[];
  fallback?: Recipe[];
  text: string;
}> {
  const filters = extractFilters(question);
  const primary = await queryRecipes(filters, 8);
  let found = primary.length > 0;
  let fallback: Recipe[] | undefined;

  if (!found) fallback = await fallbackSimilarRecipes(filters, 8);

  const ctxRecipes = (found ? primary : (fallback || [])).map(r => ({
    id: (r as any).id,
    title: (r as any).title,
    description: (r as any).description,
    category: (r as any).category,
    prepTime: (r as any).prepTime ?? (r as any).prep_time,
    difficulty: (r as any).difficulty,
    rating: (r as any).rating,
    ingredients: (r as any).ingredients,
  }));

  const system = [
    'Você é um assistente que responde APENAS com base nas receitas do sistema.',
    'Se a pergunta pedir algo que não existe, ofereça as opções mais parecidas disponíveis.',
    'Nunca invente receita que não esteja na lista fornecida.',
    'Responda em português, em tom claro e direto.'
  ].join(' ');

  const userPrompt = [
    `Pergunta do usuário: "${question}"`,
    found
      ? 'Foram encontradas receitas relevantes.'
      : 'Nenhuma receita exata encontrada; mostre as mais semelhantes.',
    'Receitas disponíveis (JSON):',
    JSON.stringify(ctxRecipes, null, 2),
    'Monte a resposta em lista, com título, tempo de preparo, dificuldade e ingredientes principais.',
    'Se usar fallback, avise: "Não encontrei exatamente isso, mas aqui estão alternativas semelhantes."'
  ].join('\n\n');

  const text = await getGeminiResponse(system, userPrompt);
  return { found, primary, fallback, text };
}

// =============================================================================
// (Legado / Utilitários) – busca simples para compor contexto textual (opcional)
// =============================================================================

/**
 * Busca receitas por termo livre e retorna também um contexto textual.
 * Útil se você ainda quiser um prompt "clássico" além do RAG.
 */
export async function searchRecipesForAI(query: string, limit: number = 3) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;

  const recipes = (data || []) as any as Recipe[];
  const context = recipes.map(r => {
    return `• ${r.title} (${r.category || 'geral'}) – ${r.description || ''}`;
  }).join('\n');

  return {
    recipes,
    context
  };
}

// =============================================================================
/**
 * (Opcional) Exemplo de resposta estruturada com base no banco + Gemini.
 * Se quiser forçar um formato, use este wrapper.
 */
export async function askAIWithContext(question: string): Promise<AIResponse> {
  const { recipes } = await searchRecipesForAI(question, 5);
  const system = 'Você responde com base no conteúdo fornecido e em tom claro.';
  const user = `Pergunta: ${question}\nReceitas:\n${recipes.map(r => `- ${r.title}`).join('\n')}`;
  const content = await getGeminiResponse(system, user);

  return {
    content,
    recipes: recipes.map(r => ({
      id: (r as any).id,
      title: (r as any).title,
      description: (r as any).description,
      author: (r as any).authorName ?? 'Autor',
      rating: (r as any).rating ?? 0
    }))
  };
}

// =============================================================================
// CRUD – Configuração da IA (ai_configurations)
// =============================================================================

export async function getAIConfigurations(nutritionistId: string): Promise<AIConfiguration[]> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createAIConfiguration(payload: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert([payload])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConfiguration;
}

export async function updateAIConfiguration(id: string, updates: Partial<AIConfiguration>) {
  const { data, error } = await supabase
    .from('ai_configurations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConfiguration;
}

// =============================================================================
// CRUD – Conversas (ai_conversations)
// =============================================================================


// Tipagem para criar conversa via objeto (compatível com o store)
type NewAIConversationInput = {
  client_id: string;
  nutritionist_id?: string | null;
  ai_config_id?: string | null;
  title?: string | null;
  is_active?: boolean;
};

/**
 * Cria conversa aceitando um objeto com todos os campos esperados pelo store.
 * Mantém compatibilidade com a tabela ai_conversations (inclui ai_config_id e is_active).
 */

export async function createAIConversation(input: NewAIConversationInput) {
  const {
    client_id,
    nutritionist_id = null,
    ai_config_id = null,
    title = null,
    is_active = true
  } = input;

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([{
      client_id,
      nutritionist_id,
      ai_config_id,
      title,
      is_active
    }])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConversation;
}


export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  // Usuário pode ser cliente OU nutricionista na conversa
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .or(`client_id.eq.${userId},nutritionist_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any as AIConversation[]) || [];
}

export async function createConversation(clientId: string, nutritionistId: string, title?: string) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([{ client_id: clientId, nutritionist_id: nutritionistId, title }])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConversation;
}

// =============================================================================
// CRUD – Mensagens (ai_messages)
// =============================================================================

export async function getMessagesByConversation(conversationId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as any as AIMessage[]) || [];
}

export async function createAIMessage(message: Omit<AIMessage, 'id' | 'created_at'>): Promise<AIMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert([message])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIMessage;
}

// =============================================================================
// Usuários / Perfis (profiles) – helpers (opcionais)
// =============================================================================

type UserProfile = {
  id: string;
  full_name?: string;
  user_type?: string;
  email?: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('getUserProfile error:', error);
    return null;
  }
  return data as UserProfile;
}

export async function updateUserProfile(id: string, updates: { name?: string; type?: string; email?: string; avatar_url?: string | null; }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: updates.name,
      user_type: updates.type,
      email: updates.email,
      avatar_url: updates.avatar_url ?? null
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as UserProfile;
}
