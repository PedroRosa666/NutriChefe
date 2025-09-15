// src/services/ai.ts
// =============================================================================
// Serviço de IA para o NutriChefe
// - Entende pedidos naturais: categoria, dificuldade, tempo, nutricionista, etc.
// - Busca direto no BD com supabase (somente receitas do site)
// - Fallback: receitas semelhantes (sinônimos) e populares do site
// - Guardrail: Gemini NÃO sugere receitas externas
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

// 🔎 detecção mais robusta de pedido de receita (inclui padrões comuns)
function isRecipeRequest(text: string): boolean {
  const t = normalize(text);
  const recipeKeywords = [
    'receita', 'receitas', 'prato', 'pratos', 'comida', 'cozinhar',
    'ingrediente', 'ingredientes', 'preparo', 'preparar', 'fazer',
    'culinaria', 'culinária', 'gastronomia', 'alimento', 'alimentos',
    'modo de preparo'
  ];
  if (recipeKeywords.some(keyword => t.includes(keyword))) return true;

  // padrões do tipo "quero algo com X", "o que dá pra fazer com Y"
  const padroes = [
    /\b(quero|preciso|busco|procuro).+\b(com|sem|usando)\b/i,
    /\b(o que|oq|q).+\b(fazer|cozinhar|preparar)\b/i,
    /\b(receita|prato).+\b(com|sem)\b/i,
    /\b(ideias|ideia).+\b(receita|prato)\b/i,
  ];
  return padroes.some(r => r.test(text));
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
// Catálogos e sinônimos
// =============================================================================
type FixedCategory = { labelPt: string; dbKeysEn: string[]; variants: string[] };

const FIXED_CATEGORIES: FixedCategory[] = [
  { labelPt: 'Vegana', dbKeysEn: ['Vegan'], variants: ['vegana','vegan'] },
  { labelPt: 'Baixo Carboidrato', dbKeysEn: ['Low Carb','Keto'], variants: ['baixo carboidrato','low carb','keto'] },
  { labelPt: 'Rica em Proteína', dbKeysEn: ['High Protein'], variants: ['rica em proteina','proteica'] },
  { labelPt: 'Sem Glúten', dbKeysEn: ['Gluten-Free'], variants: ['sem glúten','sem gluten','gluten free'] },
  { labelPt: 'Vegetariana', dbKeysEn: ['Vegetarian'], variants: ['vegetariana','vegetarian'] },
];

// 🔁 sinônimos/parentescos simples para "semelhantes"
const SIMILAR_INGREDIENTS: Record<string, string[]> = {
  'morango': ['fruta vermelha','frutas vermelhas','amora','framboesa','mirtilo','cereja'],
  'frango': ['peito de frango','sobrecoxa','ave'],
  'carne moida': ['patinho moido','acem moido','coxao duro moido','carne bovina moida'],
  'batata': ['batata doce','mandioquinha','baroa','inhame'],
  'abobrinha': ['berinjela'],
};

// =============================================================================
// Extração de filtros NL
// =============================================================================
function detectCategoryFromText(text: string): { labelPt: string; dbKeysEn: string[] } | null {
  const t = normalize(text);
  for (const cat of FIXED_CATEGORIES) {
    if (t.includes(normalize(cat.labelPt))) return { labelPt: cat.labelPt, dbKeysEn: cat.dbKeysEn };
    if (cat.variants.some(v => t.includes(normalize(v)))) return { labelPt: cat.labelPt, dbKeysEn: cat.dbKeysEn };
  }
  return null;
}

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

  // termo de busca (ingredientes, pratos) — pega após "com/sem/usando" OU última palavra forte
  const withIng = text.match(/\b(com|sem|usando)\s+([A-Za-zÀ-ÿ ]{2,})/i);
  if (withIng) {
    filters.searchTerm = withIng[2].trim();
  } else {
    const tokens = text
      .replace(/[?!.,;:()]+/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !/\b(receita|receitas|prato|cozinhar|preparar|fazer|ingrediente|ingredientes)\b/i.test(w));
    if (tokens.length) filters.searchTerm = tokens[tokens.length - 1];
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
    const t = searchTerm.trim();
    // Busca em título e descrição (mantém compatibilidade de schema)
    query = query.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
  }

  if (onlyNutritionist) query = query.eq('author_profile.user_type', 'Nutritionist');
  if (authorName) query = query.ilike('author_profile.full_name', `%${authorName}%`);

  const { data, error } = await query.order('rating', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// Função para buscar receitas similares quando não encontrar resultados exatos
async function findSimilarRecipes(originalFilters: any): Promise<any[]> {
  // 0) Se há termo de busca, tenta sinônimos/parentes (sem mudar o resto dos filtros)
  const baseTerm: string | undefined = originalFilters.searchTerm?.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (baseTerm && SIMILAR_INGREDIENTS[baseTerm]) {
    for (const alt of SIMILAR_INGREDIENTS[baseTerm]) {
      const altResults = await queryRecipesByAnyFilters({
        ...originalFilters,
        searchTerm: alt,
      });
      if (altResults.length) return altResults;
    }
  }

  // 1) Tentar com filtros mais flexíveis (rating ↓, tempo ↑, dificuldade → medium)
  const relaxedFilters = { ...originalFilters };

  if (relaxedFilters.minRating && relaxedFilters.minRating > 1) {
    relaxedFilters.minRating = Math.max(1, relaxedFilters.minRating - 0.5);
  }
  if (relaxedFilters.maxPrepTime) {
    relaxedFilters.maxPrepTime += 15;
  }
  if (relaxedFilters.difficulty === 'easy') {
    relaxedFilters.difficulty = 'medium';
  } else if (relaxedFilters.difficulty === 'hard') {
    relaxedFilters.difficulty = 'medium';
  }

  let results = await queryRecipesByAnyFilters(relaxedFilters);

  // 2) Se ainda não encontrou, buscar apenas por categoria
  if (!results.length && originalFilters.categories) {
    results = await queryRecipesByAnyFilters({
      categories: originalFilters.categories,
      limit: 20
    });
  }

  // 3) Se ainda não encontrou, buscar receitas populares do site
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

  let items = await queryRecipesByAnyFilters({
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
    // Buscar receitas similares (sinônimos + relax de filtros + populares)
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
      // Texto natural deixando claro que são "semelhantes" do próprio site
      responseMessage = f.searchTerm
        ? `Não achei exatamente com "${f.searchTerm}", mas separei **receitas semelhantes** do nosso site:`
        : 'Separei algumas sugestões do nosso site que podem te agradar:';
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
      const difficultyMap = { easy: 'fáceis', medium: 'médias', hard: 'difíceis' } as const;
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
/* Processamento principal
   Regras:
   - Cumprimentos e mensagens vagas → resposta curta
   - Pedido de receita → busca no site (com semelhantes/fallback)
   - Outras perguntas → Gemini **com guardrail** para NÃO citar receitas externas
*/
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

  // 2) Para outras perguntas, usar Gemini — com GUARDRAIL textual embutido
  //    (Sem alterar seu ./gemini; apenas prefixamos a instrução de política.)
  const POLICY = `
Você é o assistente do NutriChefe. Políticas estritas:
- Não recomende, descreva ou cite receitas que não estejam no nosso banco de dados (site).
- Se o usuário pedir uma receita, ingredientes, substituições, tempo de preparo ou modo de preparo,
  devolva apenas uma orientação neutra (sem citar receitas) e a camada de aplicação fará a busca.
- Você pode responder dúvidas gerais de nutrição, segurança alimentar e técnicas de cozinha,
  mas SEM citar receitas específicas nem links externos.
  `.trim();

  const guardrailedPrompt =
    `${POLICY}\n\n[Mensagem do usuário]\n${content}`;

  const gemini = await getGeminiResponse(guardrailedPrompt, aiConfig, conversationHistory);
  return { content: gemini.content, recipes: [], suggestions: [] };
}
