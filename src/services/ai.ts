// src/services/ai.ts
// Mentoria IA: conversas no Supabase e orquestração das respostas.
// O caminho principal é a Edge Function `ai-chat` (Gemini + busca no catálogo).
// Sem a IA (chave ausente ou rede), a mesma busca roda aqui com um plano local.
import { supabase, toJson } from '../lib/supabase';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import { assistAI, type AIUserContext } from './gemini';
import {
  blockedTerms,
  composeLocalReply,
  parseQueryLocally,
  searchRecipes,
  type SearchableRecipe,
} from '../../supabase/functions/_shared/recipe-search';
import { feedback } from '../lib/i18n/current';

// Sugestões no idioma atual (cópia, para ninguém alterar o array das traduções).
const defaultSuggestions = () => [...feedback().ai.defaultSuggestions];

// =============================================================================
// Modo local (sem IA)
// =============================================================================
// O mesmo índice de receitas das outras ferramentas (baixado uma vez e reaproveitado).
async function fetchCatalog(): Promise<SearchableRecipe[]> {
  const { useRecipesStore } = await import('../store/recipes');
  const index = await useRecipesStore.getState().ensureIndex();
  return index.map((r) => ({
    id: r.id,
    title: r.title.trim(),
    description: r.description.trim(),
    category: r.category,
    ingredients: r.ingredients,
    prepTime: r.prepTime,
    difficulty: r.difficulty,
    rating: r.rating,
    calories: r.nutritionFacts.calories,
    protein: r.nutritionFacts.protein,
    author: r.authorName ?? '',
    image: r.image,
    createdAt: r.createdAt ?? undefined,
  }));
}

const GREETING_RE = /^(oi+|ola|ol[aá]|bom dia|boa tarde|boa noite|hey|e ai|tudo bem)\b/i;

async function localReply(message: string, context?: AIUserContext): Promise<AIResponse> {
  const catalog = await fetchCatalog();
  const { isRecipeRequest, ...query } = parseQueryLocally(message, catalog);

  if (!isRecipeRequest) {
    const content = GREETING_RE.test(message.trim())
      ? feedback().ai.localGreeting
      : feedback().ai.localOnlySearch;
    return { content, recipes: [], suggestions: defaultSuggestions() };
  }

  const result = searchRecipes(catalog, query, blockedTerms(context?.allergies ?? [], context?.dietaryPreferences ?? []));
  return {
    content: composeLocalReply(query, result),
    recipes: result.hits.map(({ recipe, matched }) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description.slice(0, 160),
      author: recipe.author || 'NutriChef',
      rating: recipe.rating,
      prepTime: recipe.prepTime,
      image: recipe.image,
      category: recipe.category,
      calories: recipe.calories,
      matched,
    })),
    suggestions: defaultSuggestions(),
    meta: { intent: 'recipe_search', mode: result.mode, local: true },
  };
}

// =============================================================================
// Supabase: config / conversas / mensagens
// =============================================================================
export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .maybeSingle();
  if (error) throw error;
  return data as AIConfiguration | null;
}

export async function createAIConfiguration(
  config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AIConfiguration> {
  const { data, error } = await supabase.from('ai_configurations').insert([config]).select().single();
  if (error) throw error;
  return data as AIConfiguration;
}

export async function updateAIConfiguration(
  configId: string,
  updates: Partial<AIConfiguration>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations').update(updates).eq('id', configId).select().single();
  if (error) throw error;
  return data as AIConfiguration;
}

export async function createAIConversation(input: {
  client_id: string;
  nutritionist_id?: string | null;
  title?: string;
  is_active?: boolean;
}): Promise<AIConversation> {
  const row = {
    client_id: input.client_id,
    nutritionist_id: input.nutritionist_id ?? null,
    title: input.title ?? 'Nova conversa com IA',
    is_active: input.is_active ?? true,
  };
  const { data, error } = await supabase.from('ai_conversations').insert([row]).select('*').single();
  if (error) throw error;
  return data as AIConversation;
}

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*, ai_messages(count), first:ai_messages(content, sender_type)')
    .eq('client_id', userId)
    .eq('is_active', true)
    .eq('first.sender_type', 'user')
    .order('created_at', { referencedTable: 'first', ascending: true })
    .limit(1, { referencedTable: 'first' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw error;

  type Row = AIConversation & { ai_messages?: { count: number }[]; first?: { content: string }[] };
  // Conversas sem mensagens (a versão antiga criava uma a cada visita) não entram no histórico.
  // Todas as outras entram: antes só as 50 mais recentes apareciam, e ao excluir uma
  // a próxima antiga tomava o lugar, parecendo que a excluída tinha voltado.
  return ((data || []) as unknown as Row[])
    .filter((c) => (c.ai_messages?.[0]?.count ?? 0) > 0)
    .map((row) => {
      const { first, ...c } = row;
      delete (c as Partial<Row>).ai_messages;
      const firstQuestion = first?.[0]?.content?.trim();
      if (!isDefaultTitle(c.title) || !firstQuestion) return c;
      // Conversas antigas ficaram com o título padrão: usa a 1ª pergunta e grava para as próximas vezes.
      const title = firstQuestion.length > 60 ? `${firstQuestion.slice(0, 57)}...` : firstQuestion;
      supabase.from('ai_conversations').update({ title }).eq('id', c.id).then(({ error: e }) => {
        if (e) console.warn('Conversation title update failed:', e);
      });
      return { ...c, title };
    });
}

const isDefaultTitle = (title?: string) => !title || title === 'Nova conversa com IA' || title === 'Nova conversa';

export async function archiveAllAIConversations(userId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_conversations')
    .update({ is_active: false })
    .eq('client_id', userId)
    .eq('is_active', true);
  if (error) throw error;
}

export async function updateAIConversation(
  conversationId: string,
  updates: Partial<Pick<AIConversation, 'title' | 'is_active' | 'last_message_at'>>
): Promise<void> {
  const { error } = await supabase.from('ai_conversations').update(updates).eq('id', conversationId);
  if (error) throw error;
}

export async function getAIMessages(conversationId: string): Promise<AIMessage[]> {
  // As 500 mais recentes, da mais antiga para a mais nova (sem limite o servidor corta nas
  // primeiras e as mensagens novas de uma conversa longa sumiriam).
  const { data, error } = await supabase
    .from('ai_messages').select('*').eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return ((data || []) as AIMessage[]).reverse();
}

export async function createAIMessage(
  message: Omit<AIMessage, 'id' | 'created_at' | 'updated_at'>
): Promise<AIMessage> {
  const { data, error } = await supabase.from('ai_messages').insert([{ ...message, metadata: toJson(message.metadata) }]).select().single();
  if (error) throw error;
  return data as unknown as AIMessage;
}

// =============================================================================
// Orquestração principal
// =============================================================================
export async function processAIMessage(
  userMessage: string,
  aiConfig?: AIConfiguration,
  conversationHistory: AIMessage[] = [],
  context?: AIUserContext
): Promise<AIResponse> {
  const content = String(userMessage || '').trim();
  if (!content) {
    return { content: feedback().ai.notUnderstood, recipes: [], suggestions: defaultSuggestions() };
  }

  // O store já inclui a mensagem atual no histórico; ela vai separada.
  const history = conversationHistory.at(-1)?.content === content
    ? conversationHistory.slice(0, -1)
    : conversationHistory;

  const result = await assistAI(content, history, aiConfig, context);
  if (result.ok) return result.response;
  if (!result.limited) {
    // Limite por hora, acesso negado etc.: a mensagem do servidor explica o motivo.
    return { content: result.message ?? feedback().ai.cannotReplyNow, recipes: [], suggestions: [] };
  }

  try {
    return await localReply(content, context);
  } catch (error) {
    console.error('Erro na busca local:', error);
    return {
      content: feedback().ai.searchError,
      recipes: [],
      suggestions: defaultSuggestions(),
    };
  }
}
