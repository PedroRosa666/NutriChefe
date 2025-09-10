// Caminho: src/services/ai.ts

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import type { Recipe } from '../types/recipe';
import type { UserProfile } from '../types/user'; // Supondo que você tenha um tipo para perfil

// --- FUNÇÕES DE BUSCA DE CONTEÚDO (CONTEXTO PARA A IA) ---

/**
 * Busca receitas no banco de dados com base em uma consulta de texto.
 * Retorna tanto os dados estruturados quanto uma string de contexto para a IA.
 */
async function searchRecipesForAI(query: string, limit: number = 3) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, author:profiles(full_name)')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  if (!data || data.length === 0) return { context: '', structuredData: [] };

  const context = `
Contexto de Receitas Encontradas:
---
${data.map(r => `
Título: ${r.title}
Autor: ${r.author?.full_name || 'Desconhecido'}
Descrição: ${r.description}
Ingredientes: ${JSON.parse(r.ingredients as any).join(', ')}
Categoria: ${r.category}
Dificuldade: ${r.difficulty}
`).join('\n---\n')}
  `.trim();

  const structuredData = data.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    author: r.author?.full_name || 'Usuário',
    rating: r.rating || 0
  }));

  return { context, structuredData };
}

/**
 * Busca nutricionistas no banco de dados com base em uma consulta de texto.
 * Retorna tanto os dados estruturados quanto uma string de contexto para a IA.
 */
async function searchNutritionistsForAI(query: string, limit: number = 2) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, bio')
    .eq('user_type', 'Nutritionist')
    .or(`full_name.ilike.%${query}%,bio.ilike.%${query}%`)
    .limit(limit);
    
  if (error) throw error;
  if (!data || data.length === 0) return { context: '', structuredData: [] };

  const context = `
Contexto de Nutricionistas Encontrados:
---
${data.map(p => `
Nome: ${p.full_name}
Biografia: ${p.bio || 'Nenhuma biografia disponível.'}
`).join('\n---\n')}
  `.trim();

  const structuredData = data.map(p => ({
    id: p.id,
    fullName: p.full_name,
    bio: p.bio || 'Nenhuma biografia disponível.'
  }));
  
  return { context, structuredData };
}


// --- FUNÇÃO PRINCIPAL MODIFICADA ---

export async function processAIMessage(
  message: string,
  aiConfig: AIConfiguration,
  conversationHistory: AIMessage[]
): Promise<AIResponse> {
  try {
    const lowerCaseMessage = message.toLowerCase();
    
    // Palavras-chave para identificar o tipo de pergunta
    const recipeKeywords = ['receita', 'prato', 'comida', 'bolo', 'salada', 'sopa', 'fit', 'saudável', 'ingredientes'];
    const nutriKeywords = ['nutricionista', 'nutri', 'profissional', 'especialista'];

    const hasRecipeQuery = recipeKeywords.some(k => lowerCaseMessage.includes(k));
    const hasNutriQuery = nutriKeywords.some(k => lowerCaseMessage.includes(k));

    let context = '';
    let structuredRecipes: AIResponse['recipes'] = [];
    let structuredNutritionists: AIResponse['nutritionists'] = [];

    // Busca por receitas se as palavras-chave forem encontradas
    if (hasRecipeQuery) {
      const { context: recipeContext, structuredData } = await searchRecipesForAI(message);
      context += `\n${recipeContext}`;
      structuredRecipes = structuredData as any;
    }

    // Busca por nutricionistas se as palavras-chave forem encontradas
    if (hasNutriQuery) {
      const { context: nutriContext, structuredData } = await searchNutritionistsForAI(message);
      context += `\n${nutriContext}`;
      structuredNutritionists = structuredData as any;
    }

    // Monta a mensagem final para a IA
    const enhancedMessage = context.trim()
      ? `Com base no contexto abaixo, responda à pergunta do cliente de forma amigável e útil.\n${context}\n\nPergunta do Cliente: ${message}`
      : message;

    // Chama a API do Gemini
    const geminiResponse = await getGeminiResponse(enhancedMessage, aiConfig, conversationHistory);
    
    if (geminiResponse.error) {
      console.error('Gemini API error:', geminiResponse.error);
    }

    return {
      content: geminiResponse.content,
      recipes: structuredRecipes && structuredRecipes.length > 0 ? structuredRecipes : undefined,
      nutritionists: structuredNutritionists && structuredNutritionists.length > 0 ? structuredNutritionists : undefined,
    };

  } catch (error) {
    console.error('Error processing AI message:', error);
    return {
      content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.'
    };
  }
}

// --- SUAS OUTRAS FUNÇÕES (getAIConfiguration, etc.) PERMANECEM IGUAIS ---
// ... (cole o restante do seu arquivo `ai.ts` aqui)
export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
}

export async function createAIConfiguration(config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert([config])
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateAIConfiguration(configId: string, updates: Partial<AIConfiguration>): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .update(updates)
    .eq('id', configId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// Conversas com IA
export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(`
      *,
      ai_config:ai_configurations(*)
    `)
    .eq('client_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createAIConversation(conversation: Omit<AIConversation, 'id' | 'created_at' | 'updated_at' | 'last_message_at'>): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([conversation])
    .select(`
      *,
      ai_config:ai_configurations(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

// Mensagens da IA
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
    .insert([message])
    .select('*')
    .single();

  if (error) throw error;
  return data;
}