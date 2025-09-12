// src/services/ai.ts
// =============================================================================
// Serviço de IA (categoria-first) para o NutriChefe
// - SOMENTE CATEGORIAS fixas (pt/en) — nada de ingredientes ou dietas extras
// - Busca receitas por recipes.category via ILIKE
// - UX: cumprimenta e pede categoria quando a mensagem é vaga/saudação
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
  // Se não houver nome do autor disponível na linha, devolve genérico
  return (
    r?.author_name ??
    r?.authorName ??
    r?.created_by_name ??
    'Autor'
  );
}

// =============================================================================
// CATEGORIAS FIXAS (PT/EN)
// =============================================================================

type FixedCategory = {
  canonical: string;           // nome como salvo na coluna recipes.category
  variants: string[];          // variações aceitas no texto do usuário (pt/en)
};

const FIXED_CATEGORIES: FixedCategory[] = [
  { canonical: 'Vegana', variants: ['vegana', 'vegan'] },
  { canonical: 'Baixo Carboidrato', variants: ['baixo carboidrato', 'low carb', 'low-carb', 'keto'] },
  { canonical: 'Rica em Proteína', variants: ['rica em proteina', 'rica em proteína', 'high protein', 'high-protein', 'protein rich'] },
  { canonical: 'Sem Glúten', variants: ['sem glúten', 'sem gluten', 'gluten free', 'gluten-free'] },
  { canonical: 'Vegetariana', variants: ['vegetariana', 'vegetarian'] },
];

function detectCategoryFromText(text: string): string | null {
  const t = normalize(text);
  for (const cat of FIXED_CATEGORIES) {
    // se o texto já contém o nome canônico (normalizado), aceita
    if (t.includes(normalize(cat.canonical))) return cat.canonical;
    // senão, tenta as variantes
    if (cat.variants.some(v => t.includes(normalize(v)))) return cat.canonical;
  }
  return null;
}

// =============================================================================
// Consultas de receitas por CATEGORIA
// =============================================================================

async function queryRecipesByCategory(categoryName: string, limit = 40): Promise<Recipe[]> {
  // Consulta simples e robusta ao Supabase
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .ilike('category', `%${categoryName}%`)
    .order('rating', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as any as Recipe[]) || [];
}

function capAndMapRecipes(list: Recipe[], cap = 6) {
  // Remove duplicatas por id/título e limita a N
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of list) {
    const key = (r as any).id ?? (r as any).title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= cap) break;
  }
  return out.map((r: any) => ({
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
  const category = detectCategoryFromText(question);

  if (!category) {
    return {
      found: false,
      category: null,
      items: [],
      text: 'Não identifiquei uma categoria na sua mensagem.'
    };
  }

  // Busca por categoria
  const raw = await queryRecipesByCategory(category, 40);

  // Apenas as receitas da categoria; nenhuma lógica extra
  const chosen = raw;

  // Contexto para o modelo (opcional; apenas formatação do texto)
  const ctxRecipes = chosen.slice(0, 8).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    prepTime: r.prep_time,
    difficulty: r.difficulty,
    rating: r.rating,
    author: extractAuthorName(r)
  }));

  const disclaimer = !chosen.length
    ? `Não encontrei receitas na categoria **${category}**.`
    : `Categoria: **${category}**.`;

  // Você pode remover o getGeminiResponse e montar um texto fixo se preferir 0 dependência de LLM
  const userPrompt = [
    `Pergunta do usuário: "${question}"`,
    disclaimer,
    'Receitas (JSON):',
    JSON.stringify(ctxRecipes, null, 2),
    'Formate a resposta em lista, com título, tempo de preparo (se houver), dificuldade, autor.',
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
    .select('id, title, description, category, difficulty, rating, author_id')
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

  // 1) Saudações: acolhedor e curto, sem empurrar nada
  if (isGreeting(content)) {
    return {
      content: 'Oi! 👋 Tudo bem? Me conta o que você quer ver hoje. Se preferir, posso buscar por um estilo específico (ex.: vegana, low carb, rica em proteína, sem glúten ou vegetariana).',
      recipes: [],
      suggestions: []
    };
  }

  // 2) Mensagem muito curta/vaga: convida a pessoa a dizer o estilo
  if (isTooShortOrVague(content)) {
    return {
      content: 'Show! Diz pra mim, de que estilo você quer ideias agora? Pode ser algo como “vegana” ou “sem glúten”. 😉',
      recipes: [],
      suggestions: []
    };
  }

  // 3) Fluxo normal (categoria-first)
  const { found, category, items, text } = await answerQuestionWithSiteData(content);

  // Se não identifiquei a categoria, peça de forma leve
  if (!category) {
    return {
      content: 'Entendi. Você pode me dizer em poucas palavras o estilo que prefere? (ex.: vegana, low carb, rica em proteína, sem glúten ou vegetariana)',
      recipes: [],
      suggestions: []
    };
  }

  // Se a categoria veio, mas não há resultados
  if (!found || !items.length) {
    return {
      content: `Olhei nessa linha **${category}** e, por aqui, não encontrei opções. Quer tentar outro estilo? Posso procurar em “low carb”, “vegetariana”, “sem glúten”… você escolhe 🙂`,
      recipes: [],
      suggestions: []
    };
  }

  // OK: retorna as receitas da categoria escolhida
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
