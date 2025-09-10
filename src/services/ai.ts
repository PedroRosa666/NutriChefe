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
${data.map(r => `
- Título: ${r.title} (Categoria: ${r.category}, Dificuldade: ${r.difficulty})
`).join('')}
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
 * Cria uma nova conversa de IA no banco de dados.
 * @param userId O ID do usuário.
 * @param title O título da conversa.
 * @returns A nova conversa criada.
 */
export async function createAIConversation(userId: string, title: string): Promise<AIConversation> {
  const { data, error } = await supabase
    .from('ai_conversations') // Nome da sua tabela de conversas
    .insert([{ user_id: userId, title }])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar a conversa na IA:', error);
    throw new Error('Não foi possível iniciar uma nova conversa.');
  }

  return data;
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

  // Se não encontrar, tenta uma busca por categoria
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
Título: ${r.title}
Autor: ${r.author?.full_name || 'Desconhecido'}
Descrição: ${r.description}
Categoria: ${r.category}
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
    
    return { context: `Nenhuma receita encontrada para "${query}".`, structuredData: [] };
  }

  const context = `
Contexto de Receitas Encontradas para "${query}":
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

  return { context, structuredData, notFound: false };
}


// ... (outras funções como searchNutritionistsForAI e getSystemStatsForAI)

// --- FUNÇÃO PRINCIPAL MODIFICADA ---

export async function processAIMessage(
  message: string,
  aiConfig: AIConfiguration,
  conversationHistory: AIMessage[]
): Promise<AIResponse> {
  try {
    const lowerCaseMessage = message.toLowerCase();
    
    // Palavras-chave para identificar o tipo de pergunta
    const recipeKeywords = ['receita', 'prato', 'comida', 'bolo', 'salada', 'sopa', 'fit', 'saudável', 'ingredientes', 'listar', 'todas'];
    // ... (outras palavras-chave)
    
    const hasRecipeQuery = recipeKeywords.some(k => lowerCaseMessage.includes(k));
    const isListAllQuery = lowerCaseMessage.includes('listar todas') || lowerCaseMessage.includes('quais receitas');

    let context = '';
    let structuredRecipes: AIResponse['recipes'] = [];
    let structuredNutritionists: AIResponse['nutritionists'] = [];
    let recipeNotFound = false;

    // ... (lógica para getSystemStatsForAI)

    // Busca por receitas se as palavras-chave forem encontradas
    if (hasRecipeQuery) {
      if (isListAllQuery) {
        const { context: recipeContext, structuredData } = await getAllRecipesForAI();
        context += `\n${recipeContext}`;
        structuredRecipes = structuredData as any;
      } else {
        const { context: recipeContext, structuredData, notFound } = await searchRecipesForAI(message);
        context += `\n${recipeContext}`;
        structuredRecipes = structuredData as any;
        recipeNotFound = notFound || false;
      }
    }
    
    // ... (outras buscas e construção do enhancedMessage)
    
    const enhancedMessage = `
Você é um assistente especializado da plataforma NutriChef. Use as informações abaixo para responder.

${context}

Pergunta do Cliente: ${message}

Instruções:
- Se o cliente pedir para listar todas as receitas, liste as que foram encontradas no contexto.
- Se uma receita específica não for encontrada, informe o cliente e sugira as receitas semelhantes que foram encontradas.
- Sempre seja útil e encoraje o uso da plataforma.
    `.trim();

    // ... (resto da função)
    
  } catch (error) {
    // ... (tratamento de erro)
  }
}
