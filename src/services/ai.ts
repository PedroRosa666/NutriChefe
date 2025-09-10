import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

// --- FUNÇÕES DE BUSCA DE CONTEÚDO (CONTEXTO PARA A IA) ---

/**
 * Busca todas as receitas no banco de dados.
 * Retorna tanto os dados estruturados quanto uma string de contexto para a IA.
 */
async function getAllRecipesForAI(limit: number = 10) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, author:profiles(full_name)')
    .limit(limit);

  if (error) throw error;
  if (!data || data.length === 0) return { context: 'Nenhuma receita encontrada no site.', structuredData: [] };

  const context = `
Contexto de Todas as Receitas Disponíveis (Amostra):
---
${data.map(r => `- Título: ${r.title} (Categoria: ${r.category}, Dificuldade: ${r.difficulty})`).join('\n')}
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
 * Busca receitas no banco de dados com base em uma consulta de texto.
 * Se não encontrar, busca por receitas na mesma categoria para dar sugestões.
 */
async function searchRecipesForAI(query: string, limit: number = 3) {
  // Busca inicial pelo nome/descrição
  let { data, error } = await supabase
    .from('recipes')
    .select('*, author:profiles(full_name)')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;

  // Se não encontrar, tenta uma busca por categoria como fallback
  if (!data || data.length === 0) {
    const { data: categoryData, error: categoryError } = await supabase
      .from('recipes')
      .select('*, author:profiles(full_name)')
      .or(`category.ilike.%${query}%`)
      .limit(limit);
    
    if (categoryError) throw categoryError;
    
    if (categoryData && categoryData.length > 0) {
      const context = `
Contexto de Receitas Semelhantes Encontradas (na categoria ${query}):
---
${categoryData.map(r => `
- Título: ${r.title}
- Autor: ${r.author?.full_name || 'Desconhecido'}
- Categoria: ${r.category}
`).join('\n---\n')}
      `.trim();
      
      const structuredData = categoryData.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        author: r.author?.full_name || 'Usuário',
        rating: r.rating || 0
      }));
      
      return { context, structuredData, notFound: true };
    }
    
    return { context: `Nenhuma receita encontrada para "${query}".`, structuredData: [], notFound: true };
  }

  const context = `
Contexto de Receitas Encontradas para "${query}":
---
${data.map(r => `
- Título: ${r.title}
- Autor: ${r.author?.full_name || 'Desconhecido'}
- Categoria: ${r.category}
- Dificuldade: ${r.difficulty}
`).join('\n---\n')}
  `.trim();

  const structuredData = data.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    author: r.author?.full_name || 'Usuário',
    rating: r.rating || 0
  }));

  return { context, structuredData, notFound: false };
}

/**
 * Busca nutricionistas no banco de dados com base em uma consulta de texto.
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
${data.map(p => `- Nome: ${p.full_name}\n  Biografia: ${p.bio || 'Nenhuma biografia disponível.'}`).join('\n---\n')}
  `.trim();

  const structuredData = data.map(p => ({
    id: p.id,
    fullName: p.full_name,
    bio: p.bio || 'Nenhuma biografia disponível.'
  }));
  
  return { context, structuredData };
}

/**
 * Busca estatísticas gerais do sistema para fornecer contexto à IA.
 */
async function getSystemStatsForAI() {
  try {
    const { count: totalRecipes, error: recipesError } = await supabase.from('recipes').select('*', { count: 'exact', head: true });
    const { count: totalNutritionists, error: nutritionistsError } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'Nutritionist');
    const { count: totalClients, error: clientsError } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'Client');

    if (recipesError || nutritionistsError || clientsError) {
        console.error('Error fetching counts:', recipesError || nutritionistsError || clientsError);
        return 'Não foi possível buscar as estatísticas gerais.';
    }

    const context = `
Estatísticas do Sistema NutriChef:
---
- Total de receitas publicadas: ${totalRecipes}
- Total de nutricionistas cadastrados: ${totalNutritionists}
- Total de clientes cadastrados: ${totalClients}
- O NutriChef é uma plataforma que conecta nutricionistas e clientes com foco em alimentação saudável.
    `.trim();

    return context;
  } catch (error) {
    console.error('Error getting system stats:', error);
    return 'Erro ao obter estatísticas do sistema.';
  }
}

// --- FUNÇÃO PRINCIPAL DE PROCESSAMENTO ---

export async function processAIMessage(
  message: string,
  aiConfig: AIConfiguration,
  conversationHistory: AIMessage[]
): Promise<AIResponse> {
  try {
    const lowerCaseMessage = message.toLowerCase();
    
    const recipeKeywords = ['receita', 'prato', 'comida', 'bolo', 'listar', 'todas', 'quais'];
    const nutriKeywords = ['nutricionista', 'nutri', 'profissional', 'especialista'];
    const generalKeywords = ['quantas', 'total', 'estatística', 'ajuda', 'como', 'funciona'];

    const hasRecipeQuery = recipeKeywords.some(k => lowerCaseMessage.includes(k));
    const hasNutriQuery = nutriKeywords.some(k => lowerCaseMessage.includes(k));
    const isListAllQuery = lowerCaseMessage.includes('listar todas') || lowerCaseMessage.includes('quais receitas');

    let context = '';
    let structuredRecipes: AIResponse['recipes'] = [];
    let structuredNutritionists: AIResponse['nutritionists'] = [];
    let recipeNotFound = false;

    // Incluir estatísticas se for uma pergunta geral
    if (generalKeywords.some(k => lowerCaseMessage.includes(k)) || (!hasRecipeQuery && !hasNutriQuery)) {
        const systemStats = await getSystemStatsForAI();
        context += `\n${systemStats}`;
    }

    if (hasRecipeQuery) {
      if (isListAllQuery) {
        const { context: recipeContext, structuredData } = await getAllRecipesForAI();
        context += `\n${recipeContext}`;
        structuredRecipes = structuredData as any;
      } else {
        const { context: recipeContext, structuredData, notFound } = await searchRecipesForAI(message);
        context += `\n${recipeContext}`;
        structuredRecipes = structuredData as any;
        recipeNotFound = notFound;
      }
    }

    if (hasNutriQuery) {
      const { context: nutriContext, structuredData } = await searchNutritionistsForAI(message);
      context += `\n${nutriContext}`;
      structuredNutritionists = structuredData as any;
    }

    const enhancedMessage = `
Você é um assistente da plataforma NutriChef. Use as informações de contexto abaixo para responder.

${context}

Pergunta do Cliente: ${message}

Instruções:
- Se o cliente pedir para listar receitas, liste as que foram encontradas no contexto.
- Se uma receita específica não for encontrada, informe o cliente e sugira as receitas semelhantes que encontrou (se houver).
- Seja sempre prestativo e direto ao ponto.
    `.trim();

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
      content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.'
    };
  }
}


// --- FUNÇÕES DE GERENCIAMENTO (CONFIG, CONVERSAS, MENSAGENS) ---

export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Nenhum resultado, o que é esperado
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

// --- Conversas com IA ---

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select(`*, ai_config:ai_configurations(*)`)
    .eq('client_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * [CORRIGIDO] Cria uma nova conversa de IA no banco de dados.
 */
export async function createAIConversation(userId: string, title: string, aiConfigId: string): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([{ client_id: userId, title, ai_configuration_id: aiConfigId }])
    .select('*, ai_config:ai_configurations(*)')
    .single();

  if (error) {
    console.error('Erro ao criar a conversa de IA:', error);
    throw new Error('Não foi possível iniciar uma nova conversa.');
  }

  return data;
}


// --- Mensagens da IA ---

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