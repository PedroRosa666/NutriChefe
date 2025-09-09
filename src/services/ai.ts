import { supabase } from '../lib/supabase';
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

    // Preparar contexto para a IA
    const personalityPrompts = {
      empathetic: 'Você é uma IA empática e motivacional. Sempre demonstre compreensão e ofereça encorajamento.',
      scientific: 'Você é uma IA focada em dados científicos e evidências. Base suas respostas em fatos nutricionais.',
      friendly: 'Você é uma IA amigável e casual. Use um tom descontraído e próximo.',
      professional: 'Você é uma IA profissional e formal. Mantenha um tom respeitoso e técnico.'
    };

    const systemPrompt = `
Você é ${aiConfig.ai_name}, uma IA especializada em nutrição e alimentação saudável.

Personalidade: ${personalityPrompts[aiConfig.personality]}

Instruções específicas: ${aiConfig.custom_instructions}

Contexto da conversa anterior:
${conversationHistory.slice(-5).map(msg => 
  `${msg.sender_type === 'user' ? 'Cliente' : aiConfig.ai_name}: ${msg.content}`
).join('\n')}

${recipes.length > 0 ? `
Receitas encontradas relacionadas à consulta:
${recipes.map(recipe => 
  `- ${recipe.title} (${recipe.authorName}) - ${recipe.rating.toFixed(1)}⭐`
).join('\n')}
` : ''}

Regras importantes:
1. Sempre lembre o cliente de consultar seu nutricionista para planos alimentares personalizados
2. Não faça diagnósticos médicos
3. Se encontrar receitas relevantes, mencione-as na resposta
4. Seja útil e prestativo
5. Mantenha o foco em alimentação saudável e bem-estar

Responda à seguinte mensagem do cliente:
`;

    // Simular resposta da IA (aqui você integraria com o Gemini)
    const aiResponse = await callGeminiAPI(systemPrompt, message);

    return {
      content: aiResponse,
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

// Função para chamar a API do Gemini (placeholder)
async function callGeminiAPI(systemPrompt: string, userMessage: string): Promise<string> {
  // Esta função será implementada com a integração real do Gemini
  // Por enquanto, retorna uma resposta simulada
  
  const responses = [
    'Olá! Como posso ajudá-lo com suas dúvidas sobre nutrição hoje?',
    'Ótima pergunta! Com base nas receitas disponíveis, posso sugerir algumas opções saudáveis.',
    'Lembre-se sempre de manter uma alimentação equilibrada e consultar seu nutricionista para orientações personalizadas.',
    'Vou buscar algumas receitas que podem interessar você!'
  ];
  
  // Simular delay da API
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return responses[Math.floor(Math.random() * responses.length)];
}