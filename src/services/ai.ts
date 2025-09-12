// src/services/ai.ts
// =============================================================================
// Serviço de IA unificado (com RAG simples) para o NutriChefe
// - CRUD de configs, conversas e mensagens
// - Busca de receitas no Supabase
// - RAG: extrai filtros da pergunta e consulta o banco, com fallback
// - Gemini: apenas para formatar a resposta com base nos dados encontrados
// - UX: evita respostas "afobadas" para saudações e mensagens vagas
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
  if (t.length < 6) return true; // "oi", "hello", etc.
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
  // tenta várias formas comuns de chegar ao nome do autor
  // (funciona mesmo sem relacionamento no select; cai no 'Autor' se não achar nada)
  return (
    r?.author_profile?.full_name ??   // se relationship profiles foi carregado com alias author_profile
    r?.author?.full_name ??           // se relationship foi apelidado como author
    r?.author_name ??                 // se há coluna direta author_name
    r?.authorName ??                  // variação camel
    r?.created_by_name ??             // materializado por trigger/view
    'Autor'
  );
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
  'sem açúcar','sem acucar','sem glúten','sem gluten','sem lactose',
  'low carb','proteica','proteico','keto','paleo'
];

const DIFFICULTY_MAP: Record<string, 'easy'|'medium'|'hard'> = {
  'fácil':'easy','facil':'easy',
  'médio':'medium','medio':'medium',
  'difícil':'hard','dificil':'hard'
};

export function extractFilters(question: string): RecipeFilters {
  const q = normalize(question);

  const ingredients: string[] = [];
  const ingredientMatch = q.match(/com\s+([a-zA-ZÀ-ÿ,\s]+)/);
  if (ingredientMatch) {
    ingredients.push(
      ...ingredientMatch[1]
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    );
  }

  let category: string | undefined;
  for (const c of CATEGORY_KEYWORDS) {
    if (q.includes(normalize(c))) { category = c; break; }
  }

  const dietary = DIET_KEYWORDS.filter(k => q.includes(normalize(k)));

  let maxPrepTime: number | undefined;
  const timeMatch = q.match(/(\d{1,3})\s*(min|mins|minutos)/);
  if (timeMatch) maxPrepTime = Number(timeMatch[1]);

  let difficulty: 'easy'|'medium'|'hard' | undefined;
  for (const [pt, lv] of Object.entries(DIFFICULTY_MAP)) {
    if (q.includes(pt)) { difficulty = lv; break; }
  }

  return { ingredients, category, dietary, maxPrepTime, difficulty, freeText: question };
}

// =============================================================================
// Consultas de receitas no Supabase (com tentativa de JOIN em profiles e fallback)
// =============================================================================

async function selectRecipesBase(limit: number) {
  // 1ª tentativa: tentar trazer perfil do autor via relação comum (ajuste conforme seu schema)
  // - profiles!recipes_author_id_fkey: relacionamento típico quando a FK é recipes.author_id → profiles.id
  // - Se não existir no seu schema, o catch abaixo refaz a query com select('*')
  try {
    return supabase
      .from('recipes')
      .select(`
        *,
        author_profile:profiles!recipes_author_id_fkey ( full_name )
      `)
      .limit(limit);
  } catch {
    // fallback para um select simples (sem join)
    return supabase.from('recipes').select('*').limit(limit);
  }
}

async function queryRecipes(filters: RecipeFilters, limit = 8): Promise<Recipe[]> {
  // Monta query com tentativa de join; se der erro por relacionamento inexistente,
  // refaz com select('*') mais abaixo.
  try {
    let q = await selectRecipesBase(limit);

    if (filters.maxPrepTime) q = q.lte('prep_time', filters.maxPrepTime);
    if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
    if (filters.category)  q = q.ilike('category', `%${filters.category}%`);

    if (filters.ingredients.length) {
      // ingredientes é um text[]; usamos contains
      q = q.contains('ingredients', filters.ingredients);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  } catch {
    // fallback duro: sem join
    let q = supabase.from('recipes').select('*').limit(limit);

    if (filters.maxPrepTime) q = q.lte('prep_time', filters.maxPrepTime);
    if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
    if (filters.category)  q = q.ilike('category', `%${filters.category}%`);
    if (filters.ingredients.length) q = q.contains('ingredients', filters.ingredients);

    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  }
}

async function fallbackSimilarRecipes(filters: RecipeFilters, limit = 8): Promise<Recipe[]> {
  try {
    let q = await selectRecipesBase(limit);

    if (filters.category) q = q.ilike('category', `%${filters.category}%`);
    if (filters.dietary?.length) {
      // aproximação: busca no description por termos
      q = q.or(filters.dietary.map(d => `description.ilike.%${d}%`).join(','));
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  } catch {
    let q = supabase.from('recipes').select('*').limit(limit);

    if (filters.category) q = q.ilike('category', `%${filters.category}%`);
    if (filters.dietary?.length) q = q.or(filters.dietary.map(d => `description.ilike.%${d}%`).join(','));

    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  }
}

// =============================================================================
// Orquestrador RAG
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

  const ctxRecipes = (found ? primary : (fallback || [])).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    prepTime: (r as any).prepTime ?? (r as any).prep_time,
    difficulty: r.difficulty,
    rating: r.rating,
    ingredients: r.ingredients,
    author: extractAuthorName(r)
  }));

  const userPrompt = [
    `Pergunta do usuário: "${question}"`,
    found
      ? 'Foram encontradas receitas relevantes.'
      : 'Nenhuma receita exata encontrada; mostre as mais semelhantes.',
    'Receitas disponíveis (JSON):',
    JSON.stringify(ctxRecipes, null, 2),
    'Monte a resposta em lista, com título, tempo de preparo, dificuldade, autor e ingredientes principais.',
    'Se usar fallback, avise: "Não encontrei exatamente isso, mas aqui estão alternativas semelhantes."',
    'Responda em português e não invente receitas fora da lista.'
  ].join('\n\n');

  // getGeminiResponse retorna { content: string }
  const resp = await getGeminiResponse(userPrompt);
  const text = resp.content;

  return { found, primary, fallback, text };
}

// =============================================================================
// Busca simples para compor contexto textual (opcional)
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
    return `• ${r.title} (${r.category || 'geral'}) – ${r.description || ''} — Autor: ${author}`;
  }).join('\n');

  return { recipes, context };
}

// =============================================================================
// Exemplo de resposta estruturada (opcional)
// =============================================================================

export async function askAIWithContext(question: string): Promise<AIResponse> {
  const { recipes } = await searchRecipesForAI(question, 5);
  const gr = await getGeminiResponse(
    `Pergunta: ${question}\nReceitas:\n${recipes.map((r: any) => `- ${r.title} — Autor: ${extractAuthorName(r)}`).join('\n')}`
  );
  const content = gr.content;

  return {
    content,
    recipes: recipes.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      author: extractAuthorName(r),
      rating: r.rating ?? 0
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
  // lista conversas em que o usuário é cliente OU nutricionista
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .or(`client_id.eq.${userId},nutritionist_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any as AIConversation[]) || [];
}

export async function createConversation(clientId: string, nutritionistId: string, title?: string) {
  // legacy minimal creator mantido para compatibilidade
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

  // 1) Saudações: responda curto, sem RAG
  if (isGreeting(content)) {
    return {
      content:
        'Oi! 👋 Como posso te ajudar hoje na cozinha? Você quer **ideias de receita**, **adaptar algo** (ex.: sem lactose / sem glúten) ou **planejar um cardápio**?',
      recipes: [],
      suggestions: [
        'Me sugira algo com frango',
        'Quero opções sem lactose',
        'Planeje meu almoço de 20 min'
      ]
    };
  }

  // 2) Mensagem muito curta/vaga: peça 1 clarificação
  if (isTooShortOrVague(content)) {
    return {
      content:
        'Legal! Me diz só mais uma coisa pra eu acertar nas sugestões: você tem algum **ingrediente-chave** ou **restrição** (ex.: sem glúten, low carb)? E prefere **rápido** (≤ 20 min) ou tanto faz?',
      recipes: [],
      suggestions: [
        'Quero algo com atum',
        'Sem glúten e rápido',
        'Sobremesa com 3 ingredientes'
      ]
    };
  }

  // 3) Fluxo normal (RAG)
  const { text, primary, fallback } = await answerQuestionWithSiteData(content);

  const source = (primary && primary.length ? primary : (fallback || [])) as any[];

  const recipes = source.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    author: extractAuthorName(r),
    rating: r.rating ?? 0
  }));

  const suggestions = [
    'Quer opções com menos calorias?',
    'Posso filtrar por tempo de preparo ≤ 20 min.',
    'Prefere receitas sem lactose ou sem glúten?'
  ];

  return {
    content: text,
    recipes,
    suggestions
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
