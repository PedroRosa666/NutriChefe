// src/services/ai.ts
// =============================================================================
// Serviço de IA para o NutriChefe
// - Filtros naturais: categoria, dificuldade, tempo, nutricionista, autor
// - Busca no BD (somente receitas do site) + fallback por sinônimos e populares
// - Guardrail: Gemini NÃO sugere receitas externas
// =============================================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

// =============================================================================
// Database interaction functionss
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

// Palavras que NUNCA viram searchTerm (evita bug de "fáceis")
const SEARCH_STOP_WORDS = new Set([
  // dificuldade & variações
  'facil','fácil','faceis','fáceis','simples','iniciante',
  'media','média','medio','médio','intermediaria','intermediário',
  'dificil','difícil','avancada','avançada',
  // rapidez
  'rapido','rápido','rapida','rápida','express','pratica','prático','prática',
  // genéricas
  'receita','receitas','prato','pratos','comida','alimento','alimentos','culinaria','culinária','gastronomia'
]);

// 🔎 pedido de receita (inclui padrões comuns)
function isRecipeRequest(text: string): boolean {
  const t = normalize(text);
  const recipeKeywords = [
    'receita', 'receitas', 'prato', 'pratos', 'comida', 'cozinhar',
    'ingrediente', 'ingredientes', 'preparo', 'preparar', 'fazer',
    'culinaria', 'culinária', 'gastronomia', 'alimento', 'alimentos',
    'modo de preparo'
  ];
  if (recipeKeywords.some(keyword => t.includes(keyword))) return true;

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

// converte expressões de tempo variadas p/ minutos
function parsePrepTimeToMinutes(text: string): number | undefined {
  const raw = text.toLowerCase();

  // "meia hora"
  if (/\bmeia\s+hora\b/.test(raw)) return 30;

  // "1h 30", "1 hora e 15 minutos"
  const hAndM = raw.match(/\b(\d+)\s*(?:h|hora|horas)\s*(?:e\s*)?(\d{1,2})?\s*(?:m|min|minuto|minutos)?\b/);
  if (hAndM) {
    const h = parseInt(hAndM[1], 10);
    const m = hAndM[2] ? parseInt(hAndM[2], 10) : 0;
    return h * 60 + m;
  }

  // "90min", "20 minutos"
  const onlyMin = raw.match(/\b(\d{1,3})\s*(?:m|min|minuto|minutos|minutinhos)\b/);
  if (onlyMin) return parseInt(onlyMin[1], 10);

  // "1 hora"
  const onlyHour = raw.match(/\b(\d{1,2})\s*(?:h|hora|horas)\b/);
  if (onlyHour) return parseInt(onlyHour[1], 10) * 60;

  return undefined;
}

function detectFiltersFromText(text: string): {
  maxPrepTime?: number;
  difficulty?: 'easy'|'medium'|'hard';
  minRating?: number;
  onlyNutritionist?: boolean;
  authorName?: string;
  wantAll?: boolean;
  searchTerms?: string[]; // múltiplos termos
} {
  const t = normalize(text);
  const filters: any = {};
  filters.wantAll = /\btodas?\b/.test(t);

  // ----------------- tempo de preparo -----------------
  const parsed = parsePrepTimeToMinutes(text);
  if (parsed !== undefined) filters.maxPrepTime = parsed;

  // "menos de X min/horas"
  const lessMatch = text.match(/menos\s+de\s+(\d{1,3})\s*(m|min|minuto|minutos|h|hora|horas)/i);
  if (lessMatch) {
    const n = parseInt(lessMatch[1], 10);
    const unit = lessMatch[2].toLowerCase();
    filters.maxPrepTime = unit.startsWith('h') ? n * 60 : n;
  }

  // "no máximo/até X min/horas"
  const maxMatch = text.match(/(?:no\s+máximo|no\s+maximo|até)\s+(\d{1,3})\s*(m|min|minuto|minutos|h|hora|horas)?/i);
  if (maxMatch) {
    const n = parseInt(maxMatch[1], 10);
    const unit = (maxMatch[2] || 'min').toLowerCase();
    filters.maxPrepTime = unit.startsWith('h') ? n * 60 : n;
  }

  // palavras que sugerem rapidez → 30 min
  if (filters.maxPrepTime === undefined && /(rapida|rápida|rapido|rápido|express|pratica|prático|prática)/i.test(text)) {
    filters.maxPrepTime = 30;
  }

  // ----------------- dificuldade -----------------
  if (/(facil|fácil|iniciante|simples)/.test(t)) filters.difficulty = 'easy';
  else if (/(media|média|medio|médio|intermediaria|intermediário)/.test(t)) filters.difficulty = 'medium';
  else if (/(dificil|difícil|avancada|avançada)/.test(t)) filters.difficulty = 'hard';

  // ----------------- avaliação/rating -----------------
  const ratingMatch = t.match(/(?:avaliacao|avaliação|nota|estrela|rating)\D*?(\d+(?:[.,]\d+)?)/);
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

  // ----------------- nutricionista/autor -----------------
  if (/(por|de)\s+nutricionista/.test(t)) filters.onlyNutritionist = true;

  const authorMatch = text.match(/(?:nutricionista\s+|por\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇ]+){0,3})/i);
  if (authorMatch) {
    filters.authorName = authorMatch[1].trim();
    filters.onlyNutritionist = /nutricionista/i.test(authorMatch[0]);
  }

  // ----------------- ingredientes/termos (múltiplos) -----------------
  const terms: string[] = [];
  const ingMatch = text.match(/\b(com|de|usando|contendo|feito(?:a)?\s+com)\s+([A-Za-zÀ-ÿ ,e]+)\b/i);
  if (ingMatch) {
    ingMatch[2]
      .split(/,| e /i)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(s => terms.push(s));
  }
  if (!terms.length) {
    const tokens = text.replace(/[?!.,;:()]+/g, ' ').split(/\s+/).filter(w => w.length >= 3);
    if (tokens.length) terms.push(tokens[tokens.length - 1]);
  }
  const filtered = terms
    .map(tk => tk.trim())
    .filter(tk => {
      const n = normalize(tk);
      if (SEARCH_STOP_WORDS.has(n)) return false;
      if (filters.difficulty === 'easy'   && ['facil','fácil','simples','iniciante','faceis','fáceis'].includes(n)) return false;
      if (filters.difficulty === 'medium' && ['medio','médio','media','média','intermediaria','intermediário'].includes(n)) return false;
      if (filters.difficulty === 'hard'   && ['dificil','difícil','avancada','avançada'].includes(n)) return false;
      return true;
    });
  if (filtered.length) filters.searchTerms = filtered;

  return filters;
}

// =============================================================================
// Query builder (sem ::cast dentro do OR — evita PGRST100)
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
  searchTerm?: string;    // legado
  searchTerms?: string[]; // novo
  authorName?: string;
  onlyNutritionist?: boolean;
  limit?: number;
}): Promise<any[]> {
  const { categories, difficulty, maxPrepTime, minRating, searchTerm, searchTerms, authorName, onlyNutritionist, limit = 50 } = opts;
  const needInner = !!(authorName || onlyNutritionist);

  const terms: string[] = [];
  if (searchTerms?.length) terms.push(...searchTerms);
  if (searchTerm) terms.push(searchTerm);

  let query = supabase.from('recipes').select(buildRecipesBaseSelect(needInner));

  if (categories?.length) {
    const orExpr = categories.map(k => `category.ilike.%${k}%`).join(',');
    query = query.or(orExpr);
  }
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (typeof maxPrepTime === 'number') query = query.lte('prep_time', maxPrepTime);
  if (typeof minRating === 'number') query = query.gte('rating', minRating);

  if (terms.length) {
    const parts: string[] = [];
    for (const raw of terms) {
      const t = raw.trim();
      if (!t) continue;
      parts.push(`title.ilike.%${t}%`);
      parts.push(`description.ilike.%${t}%`);
      // ⚠️ NÃO incluir ingredients::text aqui para não quebrar o or=
      // Se quiser buscar ingredientes, crie uma VIEW com ingredients_text e adicione:
      // parts.push(`ingredients_text.ilike.%${t}%`);
    }
    if (parts.length) query = query.or(parts.join(','));
  }

  if (onlyNutritionist) query = query.eq('author_profile.user_type', 'Nutritionist');
  if (authorName) query = query.ilike('author_profile.full_name', `%${authorName}%`);

  const { data, error } = await query.order('rating', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// Fallback por sinônimos e relax de filtros
async function findSimilarRecipes(originalFilters: any): Promise<any[]> {
  const baseTerms: string[] = Array.isArray(originalFilters.searchTerms)
    ? originalFilters.searchTerms
    : (originalFilters.searchTerm ? [originalFilters.searchTerm] : []);

  if (baseTerms.length) {
    for (const term of baseTerms) {
      const n = term.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const alts = SIMILAR_INGREDIENTS[n];
      if (!alts?.length) continue;

      for (const alt of alts) {
        const altResults = await queryRecipesByAnyFilters({
          ...originalFilters,
          searchTerms: [alt],
          searchTerm: undefined,
        });
        if (altResults.length) return altResults;
      }
    }
  }

  const relaxed = { ...originalFilters };
  if (relaxed.minRating && relaxed.minRating > 1) relaxed.minRating = Math.max(1, relaxed.minRating - 0.5);
  if (relaxed.maxPrepTime) relaxed.maxPrepTime += 15;
  if (relaxed.difficulty === 'easy' || relaxed.difficulty === 'hard') relaxed.difficulty = 'medium';

  let results = await queryRecipesByAnyFilters(relaxed);

  if (!results.length && originalFilters.categories) {
    results = await queryRecipesByAnyFilters({ categories: originalFilters.categories, limit: 20 });
  }

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
    searchTerms: f.searchTerms,
    authorName: f.authorName,
    onlyNutritionist: f.onlyNutritionist,
    limit: f.wantAll ? 100 : 40,
  });

  let responseMessage = '';
  let finalRecipes = items;

  if (!items.length) {
    const similarItems = await findSimilarRecipes({
      categories: cat?.dbKeysEn,
      difficulty: f.difficulty,
      maxPrepTime: f.maxPrepTime,
      minRating: f.minRating,
      searchTerms: f.searchTerms,
      authorName: f.authorName,
      onlyNutritionist: f.onlyNutritionist,
    });

    if (similarItems.length) {
      const termTxt = f.searchTerms?.length ? `"${f.searchTerms.join(', ')}"` : '';
      responseMessage = f.searchTerms?.length
        ? `Não achei exatamente com ${termTxt}, mas separei **receitas semelhantes** do nosso site:`
        : 'Separei algumas sugestões do nosso site que podem te agradar:';
      finalRecipes = similarItems;
    } else {
      return {
        content: 'Não encontrei receitas com esses critérios. Que tal tentar algo mais geral como "receitas fáceis" ou "receitas veganas"?',
        recipes: [],
        suggestions: ['receitas fáceis', 'receitas rápidas', 'receitas saudáveis']
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
    if (f.searchTerms?.length) bits.push(`com ${f.searchTerms.join(', ')}`);
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

  if (isRecipeRequest(content)) {
    return await recommendRecipesFromText(content);
  }

  const POLICY = `
Você é o assistente do NutriChefe. Políticas estritas:
- Não recomende, descreva ou cite receitas que não estejam no nosso banco de dados (site).
- Se o usuário pedir uma receita, ingredientes, substituições, tempo de preparo ou modo de preparo,
  devolva apenas uma orientação neutra (sem citar receitas) e a camada de aplicação fará a busca.
- Você pode responder dúvidas gerais de nutrição, segurança alimentar e técnicas de cozinha,
  mas SEM citar receitas específicas nem links externos.
  `.trim();

  const guardrailedPrompt = `${POLICY}\n\n[Mensagem do usuário]\n${content}`;
  const gemini = await getGeminiResponse(guardrailedPrompt, aiConfig, conversationHistory);
  return { content: gemini.content, recipes: [], suggestions: [] };
}
