import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

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

/**
 * Busca estatísticas gerais do sistema para fornecer contexto à IA.
 */
async function getSystemStatsForAI() {
  try {
    // Buscar estatísticas de receitas
    const { data: recipesStats, error: recipesError } = await supabase
      .from('recipes')
      .select('id, rating, category, difficulty, created_at');
    
    if (recipesError) throw recipesError;

    // Buscar estatísticas de nutricionistas
    const { data: nutritionistsStats, error: nutritionistsError } = await supabase
      .from('profiles')
      .select('id, user_type, created_at')
      .eq('user_type', 'Nutritionist');
    
    if (nutritionistsError) throw nutritionistsError;

    // Buscar estatísticas de clientes
    const { data: clientsStats, error: clientsError } = await supabase
      .from('profiles')
      .select('id, user_type, created_at')
      .eq('user_type', 'Client');
    
    if (clientsError) throw clientsError;

    // Buscar estatísticas de avaliações
    const { data: reviewsStats, error: reviewsError } = await supabase
      .from('reviews')
      .select('rating, created_at');
    
    if (reviewsError) throw reviewsError;

    // Calcular estatísticas
    const totalRecipes = recipesStats?.length || 0;
    const totalNutritionists = nutritionistsStats?.length || 0;
    const totalClients = clientsStats?.length || 0;
    const totalReviews = reviewsStats?.length || 0;
    
    const averageRating = reviewsStats && reviewsStats.length > 0 
      ? (reviewsStats.reduce((sum, r) => sum + r.rating, 0) / reviewsStats.length).toFixed(1)
      : '0.0';

    // Categorias mais populares
    const categoryCount = recipesStats?.reduce((acc: any, recipe) => {
      acc[recipe.category] = (acc[recipe.category] || 0) + 1;
      return acc;
    }, {}) || {};
    
    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([category, count]) => `${category} (${count} receitas)`);

    // Dificuldades mais comuns
    const difficultyCount = recipesStats?.reduce((acc: any, recipe) => {
      acc[recipe.difficulty] = (acc[recipe.difficulty] || 0) + 1;
      return acc;
    }, {}) || {};

    const context = `
Estatísticas do Sistema NutriChef:
---
📊 NÚMEROS GERAIS:
- Total de receitas publicadas: ${totalRecipes}
- Total de nutricionistas cadastrados: ${totalNutritionists}
- Total de clientes cadastrados: ${totalClients}
- Total de avaliações: ${totalReviews}
- Avaliação média das receitas: ${averageRating} estrelas

📈 CATEGORIAS MAIS POPULARES:
${topCategories.length > 0 ? topCategories.map(cat => `- ${cat}`).join('\n') : '- Nenhuma categoria disponível'}

⚡ NÍVEIS DE DIFICULDADE:
${Object.entries(difficultyCount).map(([diff, count]) => `- ${diff}: ${count} receitas`).join('\n')}

🎯 SOBRE A PLATAFORMA:
- O NutriChef é uma plataforma que conecta nutricionistas e clientes
- Nutricionistas podem publicar receitas saudáveis com informações nutricionais
- Clientes podem descobrir, avaliar e favoritar receitas
- Sistema de avaliações com comentários
- Funcionalidades premium incluem mentoria IA
- Foco em alimentação saudável e bem-estar
    `.trim();

    return context;
  } catch (error) {
    console.error('Error getting system stats:', error);
    return 'Erro ao obter estatísticas do sistema.';
  }
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
    const statsKeywords = ['quantas', 'quantos', 'total', 'estatística', 'número', 'média', 'avaliação', 'sistema', 'plataforma'];
    const helpKeywords = ['como', 'ajuda', 'usar', 'funciona', 'salvar', 'favorito', 'perfil', 'conta'];

    const hasRecipeQuery = recipeKeywords.some(k => lowerCaseMessage.includes(k));
    const hasNutriQuery = nutriKeywords.some(k => lowerCaseMessage.includes(k));
    const hasStatsQuery = statsKeywords.some(k => lowerCaseMessage.includes(k));
    const hasHelpQuery = helpKeywords.some(k => lowerCaseMessage.includes(k));

    let context = '';
    let structuredRecipes: AIResponse['recipes'] = [];
    let structuredNutritionists: AIResponse['nutritionists'] = [];

    // Sempre incluir estatísticas do sistema para dar contexto geral
    const systemStats = await getSystemStatsForAI();
    context += `\n${systemStats}`;

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

    // Adicionar informações de ajuda se necessário
    if (hasHelpQuery) {
      const helpContext = `
Informações de Ajuda do NutriChef:
---
🔍 COMO USAR A PLATAFORMA:
- Para salvar receitas nos favoritos: Clique no ícone de coração na receita
- Para avaliar receitas: Abra a receita e deixe sua avaliação com estrelas e comentário
- Para ver seu perfil: Clique no seu nome no canto superior direito
- Para criar receitas (nutricionistas): Use o botão "Criar Receita" na página principal
- Para filtrar receitas: Use os filtros por categoria, dificuldade, tempo de preparo
- Para buscar receitas: Use a barra de pesquisa no topo da página

👤 TIPOS DE CONTA:
- Cliente: Pode ver, avaliar e favoritar receitas
- Nutricionista: Pode criar, editar e publicar receitas além das funcionalidades de cliente

⭐ FUNCIONALIDADES PREMIUM:
- Acesso à Mentoria IA (este chat)
- Suporte prioritário
- Funcionalidades exclusivas
      `.trim();
      context += `\n${helpContext}`;
    }

    // Monta a mensagem final para a IA
    const enhancedMessage = `
Você é um assistente especializado da plataforma NutriChef. Use as informações abaixo para responder de forma precisa e útil.

${context}

Pergunta do Cliente: ${message}

Instruções:
- Use os dados fornecidos para dar respostas precisas sobre a plataforma
- Se perguntarem sobre estatísticas, use os números exatos fornecidos
- Se perguntarem sobre receitas específicas, mencione as encontradas
- Se perguntarem sobre nutricionistas, forneça informações relevantes
- Sempre seja útil e encoraje o uso da plataforma
- Lembre que você tem acesso a dados em tempo real da plataforma
    `.trim();

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