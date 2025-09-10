import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import type { Recipe } from '../types/recipe';

// Configurações da IA
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

// Buscar receitas para a IA
async function searchRecipesForAI(query: string, limit: number = 5): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      profiles!recipes_author_id_fkey(full_name, user_type),
      reviews(rating)
    `)
    .or(`title.ilike.%${query}%, description.ilike.%${query}%, category.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  
  // Converter para o formato da aplicação (similar ao database.ts)
  return (data || []).map(recipe => ({
    id: Math.random(), // Temporário - será mapeado corretamente
    title: recipe.title,
    description: recipe.description,
    image: recipe.image,
    prepTime: recipe.prep_time,
    difficulty: recipe.difficulty,
    rating: recipe.rating || 0,
    category: recipe.category,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    nutritionFacts: recipe.nutrition_facts,
    reviews: [],
    authorId: recipe.author_id,
    authorName: recipe.profiles?.full_name,
    authorType: recipe.profiles?.user_type as 'Nutritionist' | 'Client',
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at
  }));
}

// Função para processar resposta da IA com Gemini
export async function processAIMessage(
  message: string,
  aiConfig: AIConfiguration,
  conversationHistory: AIMessage[]
): Promise<AIResponse> {
  try {
    // Buscar receitas relacionadas se a mensagem mencionar receitas
    const recipeKeywords = ['receita', 'recipe', 'prato', 'comida', 'bolo', 'salada', 'sopa', 'fit', 'saudável'];
    const hasRecipeQuery = recipeKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    let recipes: Recipe[] = [];
    if (hasRecipeQuery) {
      recipes = await searchRecipesForAI(message, 3);
    }

    // Preparar prompt com informações de receitas se encontradas
    let enhancedMessage = message;
    if (recipes.length > 0) {
      enhancedMessage += `\n\nReceitas encontradas relacionadas à sua consulta:\n`;
      enhancedMessage += recipes.map(recipe => 
        `- ${recipe.title} (por ${recipe.authorName}) - ${recipe.rating.toFixed(1)}⭐`
      ).join('\n');
      enhancedMessage += '\n\nPor favor, considere essas receitas em sua resposta se forem relevantes.';
    }

    // Chamar a API do Gemini
    const geminiResponse = await getGeminiResponse(enhancedMessage, aiConfig, conversationHistory);
    
    if (geminiResponse.error) {
      console.error('Gemini API error:', geminiResponse.error);
    }

    return {
      content: geminiResponse.content,
      recipes: recipes.length > 0 ? recipes.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        author: recipe.authorName || 'Usuário',
        rating: recipe.rating
      })) : undefined
    };

  } catch (error) {
    console.error('Error processing AI message:', error);
    return {
      content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.'
    };
  }
}
