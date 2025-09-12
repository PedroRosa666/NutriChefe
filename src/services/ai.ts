// src/services/ai.ts
// =============================================================================
// Serviço de IA (categoria-first) para o NutriChefe
// - Baseado SOMENTE em CATEGORIAS do BD/site (sem heurística de ingredientes)
// - Busca categorias na tabela `category` (singular) ou usa distinct de `recipes.category`
// - Filtros dietéticos estritos (apenas para EXCLUIR incompatíveis, se o usuário pedir)
// - UX: evita respostas "afobadas" (cumprimenta e pede categoria; sem sugestões automáticas)
// =============================================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import type { Recipe } from '../types/recipe';

// =============================================================================
// UX helpers – não ser "afobado"
// =============================================================================

const GREETINGS = [
  'oi','olá','ola','eai','e aí','bom dia','boa tarde','boa noite','hey','hi','hello'
];

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

// =============================================================================
// Utilidades
// =============================================================================

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function extractAuthorName(r: any): string {
  return (
    r?.author_profile?.full_name ??
    r?.author?.full_name ??
    r?.author_name ??
    r?.authorName ??
    r?.created_by_name ??
    'Autor'
  );
}

// Apenas para compor resposta do modelo; NÃO usamos para decidir resultados
function textFromRecipe(r: any) {
  const parts = [
    r?.title, r?.description, r?.category,
    ...(Array.isArray(r?.instructions) ? r.instructions : [])
  ].filter(Boolean).join(' ');
  return normalize(parts);
}

// =============================================================================
// Regras dietéticas estritas (somente para excluir incompatíveis)
// =============================================================================

type DietaryMode =
  | 'vegan'
  | 'vegetarian'
  | 'lactose-free'
  | 'gluten-free'
  | 'low-carb';

const VEGAN_FORBIDDEN = [
  'carne','bovina','porco','suino','presunto','bacon','linguica','salsicha','franco','frango','galinha','peru',
  'peixe','atum','sardinha','bacalhau','anchova','salmao','tilapia','camarao','lula','polvo','marisco',
  'ovo','ovos','gema','clara',
  'leite','lactose','manteiga','queijo','creme de leite','nata','requeijao','iogurte','soro do leite','whey','caseina',
  'gelatina','mel','mel de abelha','banha'
];

const VEGETARIAN_FORBIDDEN = [
  'carne','bovina','porco','suino','presunto','bacon','linguica','salsicha','franco','frango','galinha','peru',
  'peixe','atum','sardinha','bacalhau','anchova','salmao','tilapia','camarao','lula','polvo','marisco'
];

const GLUTEN_TERMS = [
  'gluten','trigo','farinha de trigo','semolina','cuscuz','couscous','seitan','malte','cevada','centeio'
];

const LACTOSE_TERMS = [
  'lactose','leite','manteiga','queijo','creme de leite','nata','requeijao','iogurte','soro do leite','whey','caseina'
];

const HIGH_CARB_CULPRITS = [
  'açucar','acucar','açúcar','farinha de trigo','arroz branco','macarrao','pao','pão','batata','amido de milho','fuba','fubá'
];

function violatesDiet(r: any, mode?: DietaryMode): boolean {
  if (!mode) return false;
  const t = textFromRecipe(r);
  const hasAny = (terms: string[]) => terms.some(term => t.includes(normalize(term)));

  switch (mode) {
    case 'vegan':
      return hasAny(VEGAN_FORBIDDEN);
    case 'vegetarian':
      return hasAny(VEGETARIAN_FORBIDDEN);
    case 'gluten-free':
      return hasAny(GLUTEN_TERMS);
    case 'lactose-free':
      return hasAny(LACTOSE_TERMS);
    case 'low-carb':
      return hasAny(HIGH_CARB_CULPRITS);
    default:
      return false;
  }
}

function pickDietaryModeFromText(text: string): DietaryMode | undefined {
  const q = normalize(text);
  if (q.includes('vegana') || q.includes('vegano')) return 'vegan';
  if (q.includes('vegetarian')) return 'vegetarian';
  if (q.includes('sem lactose') || q.includes('lactose')) return 'lactose-free';
  if (q.includes('sem glute') || q.includes('gluten')) return 'gluten-free';
  if (q.includes('low carb') || q.includes('keto') || q.includes('paleo')) return 'low-carb';
  return undefined;
}

// =============================================================================
// Descoberta de categorias a partir do BD (tabela `category` → fallback recipes.category)
// =============================================================================

type CategoryLite = { name: string; slug?: string };

let CACHED_CATEGORIES: CategoryLite[] | null = null;
let LAST_CAT_FETCH = 0;
const CAT_TTL_MS = 60_000; // 1 min

async function loadCategoriesFromDB(): Promise<CategoryLite[]> {
  const now = Date.now();
  if (CACHED_CATEGORIES && now - LAST_CAT_FETCH < CAT_TTL_MS) return CACHED_CATEGORIES;

  // 1) Tenta tabela "category" (singular)
  try {
    const { data, error } = await supabase
      .from('category')
      .select('name, slug, title')
      .limit(200);

    if (!error && data && data.length) {
      const rows = data as any[];
      CACHED_CATEGORIES = rows
        .map(r => ({
          name: r.name ?? r.title ?? '',
          slug: r.slug ?? undefined
        }))
        .filter(c => c.name);
      LAST_CAT_FETCH = now;
      return CACHED_CATEGORIES;
    }
  } catch {
    // ignora e cai no fallback
  }

  // 2) Fallback: distinct em recipes.category
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('category')
      .not('category', 'is', null)
      .neq('category', '')
      .limit(500);

    if (!error && data) {
      const set = new Set<string>();
      for (const r of data as any[]) if (r.category) set.add(String(r.category));
      CACHED_CATEGORIES = Array.from(set).map(name => ({ name }));
      LAST_CAT_FETCH = now;
      return CACHED_CATEGORIES;
    }
  } catch {
    // se até o fallback falhar, devolve vazio
  }

  CACHED_CATEGORIES = [];
  LAST_CAT_FETCH = now;
  return CACHED_CATEGORIES;
}

function matchCategoryFromText(text: string, categories: CategoryLite[]): string | null {
  const t = normalize(text);
  // match direto por nome ou slug
  for (const c of categories) {
    const n = normalize(c.name);
    const s = c.slug ? normalize(c.slug) : '';
    if (t.includes(n) || (s && t.includes(s))) return c.name;
  }
  // sinônimos básicos (remova se quiser 100% estrito aos nomes do BD)
  const synonyms: Record<string,string[]> = {
    'café da manhã': ['cafe da manha','breakfast','manhã','manha'],
    'almoço': ['almoco','lunch'],
    'jantar': ['dinner','noite'],
    'lanche': ['snack','lanchinho'],
    'sobremesa': ['doce','dessert'],
    'entrada': ['aperitivo','starter'],
    'bebida': ['drinks','suco','vitamina','shake']
  };
  for (const [cat, alts] of Object.entries(synonyms)) {
    if (alts.some(a => t.includes(normalize(a)))) return cat;
  }
  return null;
}

// =============================================================================
// Consultas de receitas por CATEGORIA
// =============================================================================

async function selectRecipesBase(limit: number) {
  // tenta trazer perfil do autor via relação comum; se não existir, o Supabase ignora
  try {
    return supabase
      .from('recipes')
      .select(`
        *,
        author_profile:profiles!recipes_author_id_fkey ( full_name )
      `)
      .limit(limit);
  } catch {
    return supabase.from('recipes').select('*').limit(limit);
  }
}

async function queryRecipesByCategory(categoryName: string, limit = 40): Promise<Recipe[]> {
  // Suporta 2 jeitos comuns de armazenar categoria:
  // 1) coluna string: recipes.category
  // 2) coluna text[]: recipes.categories (filtramos em memória)
  try {
    let q = await selectRecipesBase(limit);

    // coluna string
    q = q.ilike('category', `%${categoryName}%`);

    // Preferir melhores avaliadas (se houver rating)
    // @ts-ignore
    if (typeof (q as any).order === 'function') {
      // @ts-ignore
      q = (q as any).order('rating', { ascending: false });
    }

    const { data, error } = await q;
    if (error) throw error;

    let rows: any[] = (data as any[]) || [];

    // Se existir a coluna text[] 'categories', filtramos também por ela em memória
    rows = rows.filter(r => {
      if (Array.isArray((r as any).categories)) {
        const arr = (r as any).categories.map((x: any) => normalize(String(x)));
        return arr.some((x: string) => x.includes(normalize(categoryName)));
      }
      return true;
    });

    return rows as any as Recipe[];
  } catch {
    let q = supabase.from('recipes').select('*').limit(limit).ilike('category', `%${categoryName}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  }
}

function applyDietaryCompliance(recipes: Recipe[], mode?: DietaryMode): Recipe[] {
  if (!mode) return recipes;
  return recipes.filter(r => !violatesDiet(r, mode));
}

function capAndMapRecipes(list: Recipe[], cap = 6) {
  // Remove duplicatas por id/título e limita a N
  const seen = new Set<string>();
  const uniq: any[] = [];
  for (const r of list) {
    const key = (r as any).id ?? (r as any).title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniq.push(r);
    if (uniq.length >= cap) break;
  }
  return uniq.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    author: extractAuthorName(r),
    rating: r.rating ?? 0
  }));
}

// =============================================================================
// Orquestrador baseado em CATEGORIA
// =============================================================================

export async function answerQuestionWithSiteData(question: string): Promise<{
  found: boolean;
  category: string | null;
  items: Recipe[];
  text: string;
}> {
  const categories = await loadCategoriesFromDB();
  const category = matchCategoryFromText(question, categories);

  if (!category) {
    return {
      found: false,
      category: null,
      items: [],
      text: 'Não identifiquei uma categoria do site na sua mensagem.'
    };
  }

  // Busca por categoria
  const raw = await queryRecipesByCategory(category, 40);

  // Restrições dietéticas (se houver no texto)
  const dietMode = pickDietaryModeFromText(question);
  const filtered = applyDietaryCompliance(raw, dietMode);

  const chosen = filtered.length ? filtered : [];
  const ctxRecipes = chosen.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    prepTime: (r as any).prepTime ?? (r as any).prep_time,
    difficulty: r.difficulty,
    rating: r.rating,
    author: extractAuthorName(r)
  }));

  const disclaimer = !chosen.length
    ? `Não encontrei receitas nessa categoria (${category}) que respeitem suas restrições.`
    : `Categoria identificada: ${category}.`;

  const userPrompt = [
    `Pergunta do usuário: "${question}"`,
    disclaimer,
    'Receitas disponíveis (JSON):',
    JSON.stringify(ctxRecipes, null, 2),
    'Monte a resposta em lista, com título, tempo de preparo, dificuldade, autor.',
    'Responda em português e NÃO invente receitas fora da lista.'
  ].join('\n\n');

  const resp = await getGeminiResponse(userPrompt);
  const text = resp.content;

  return { found: !!chosen.length, category, items: chosen, text };
}

// =============================================================================
// Busca simples (opcional; não usada para decisão)
// =============================================================================

export async function searchRecipesForAI(query: string, limit = 5): Promise<{ recipes: Recipe[]; context: string }> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, description, category, difficulty, rating, author_name')
    .ilike('title', `%${query}%`)
    .order('rating', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const recipes = (data || []) as any as Recipe[];
  const context = recipes.map((r: any) => {
    const author = extractAuthorName(r);
    return `• ${r.title} (${r.category || 'geral'}) — Autor: ${author}`;
  }).join('\n');

  return { recipes, context };
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
  return (data as any as AIConfiguration[]) || [];
}

export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return (data as any as AIConfiguration) || null;
}

export async function createAIConfiguration(config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert([config])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConfiguration;
}

export async function updateAIConfiguration(id: string, updates: Partial<AIConfiguration>): Promise<AIConfiguration> {
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

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
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

// Novo criador esperado pelo store (objeto completo)
type NewAIConversationInput = {
  client_id: string;
  nutritionist_id?: string | null;
  ai_config_id?: string | null;
  title?: string | null;
  is_active?: boolean;
};

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

// Wrapper compatível com o store
export async function getAIMessages(conversationId: string) {
  return getMessagesByConversation(conversationId);
}

// =============================================================================
// Processamento de mensagem do usuário -> AIResponse (usado pelo store)
// =============================================================================

export async function processAIMessage(
  content: string,
  aiConfig?: AIConfiguration,
  conversationHistory: AIMessage[] = []
): Promise<AIResponse> {

  // 1) Saudações: resposta simples, sem sugestões nem exemplos
  if (isGreeting(content)) {
    return {
      content: 'Oi! 👋 Como posso te ajudar? Diga uma **categoria** do site (ex.: almoço, jantar, sobremesas).',
      recipes: [],
      suggestions: []
    };
  }

  // 2) Mensagem muito curta/vaga: peça explicitamente a categoria, sem sugerir nada
  if (isTooShortOrVague(content)) {
    return {
      content: 'Para te ajudar melhor, me diga uma **categoria** (ex.: almoço, jantar, sobremesas).',
      recipes: [],
      suggestions: []
    };
  }

  // 3) Fluxo normal (categoria-first)
  const { found, category, items, text } = await answerQuestionWithSiteData(content);

  // Se não identificou categoria, só peça a categoria — sem listar exemplos
  if (!category) {
    return {
      content: 'Não identifiquei uma **categoria** na sua mensagem. Diga uma (ex.: jantar, sobremesas).',
      recipes: [],
      suggestions: []
    };
  }

  // Se não encontrou itens na categoria (ou dieta filtrou tudo), não invente
  if (!found || !items.length) {
    return {
      content: `Na categoria **${category}** não encontrei resultados que respeitem seu pedido. Quer tentar outra categoria?`,
      recipes: [],
      suggestions: []
    };
  }

  // OK: retorna apenas as receitas selecionadas, sem enfeites
  const recipes = capAndMapRecipes(items, 6);

  return {
    content: text,
    recipes,
    suggestions: []
  };
}

// =============================================================================
// Perfis (profiles) – helpers opcionais
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
    .maybeSingle();

  if (error) throw error;
  return (data as any as UserProfile) || null;
}

export async function updateUserProfile(id: string, updates: {
  name?: string;
  type?: string;
  email?: string;
  avatar_url?: string | null;
}): Promise<UserProfile> {
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
