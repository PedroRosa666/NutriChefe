// src/services/ai.ts
// =============================================================================
// Serviço de IA (categoria-first) para o NutriChefe
// - 5 categorias fixas (pt/en), mas a BUSCA usa SEMPRE os valores do BD (em inglês)
// - Sem heurística de ingredientes ou dietas extras
// - Autor e rating reais (join em profiles + fallback de hidratação)
// - UX: cumprimenta de forma natural e pede o estilo quando necessário
// =============================================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';
import type { Recipe } from '../types/recipe';

// =============================================================================
// UX helpers – tom natural e não “afobado”
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

// Pega o nome do autor considerando join ou hidratação posterior
function extractAuthorName(r: any): string {
  return (
    r?.author_profile?.full_name ??
    r?.__author_name ?? // preenchido pela hidratação
    r?.author_name ??
    r?.created_by_name ??
    'Autor'
  );
}

// =============================================================================
// CATEGORIAS FIXAS: mapeamento PT/EN -> valores salvos no BD (EN)
// =============================================================================

/**
 * labelPt: exibido nas mensagens
 * dbKeysEn: valores (ou variações) como são salvos na coluna recipes.category
 * variants: palavras que reconhecemos no texto do usuário (pt + en)
 */
type FixedCategory = {
  labelPt: string;
  dbKeysEn: string[];   // usado para consultar o BD
  variants: string[];   // para detectar no texto do usuário
};

const FIXED_CATEGORIES: FixedCategory[] = [
  {
    labelPt: 'Vegana',
    dbKeysEn: ['Vegan'],
    variants: ['vegana','vegan']
  },
  {
    labelPt: 'Baixo Carboidrato',
    dbKeysEn: ['Low Carb','Low-Carb','Keto'],
    variants: ['baixo carboidrato','low carb','low-carb','keto']
  },
  {
    labelPt: 'Rica em Proteína',
    dbKeysEn: ['High Protein','High-Protein','Protein'],
    variants: ['rica em proteina','rica em proteína','high protein','high-protein','protein rich','protein']
  },
  {
    labelPt: 'Sem Glúten',
    dbKeysEn: ['Gluten-Free','Gluten Free'],
    variants: ['sem glúten','sem gluten','gluten-free','gluten free']
  },
  {
    labelPt: 'Vegetariana',
    dbKeysEn: ['Vegetarian'],
    variants: ['vegetariana','vegetarian']
  }
];

function detectCategoryFromText(text: string): { labelPt: string; dbKeysEn: string[] } | null {
  const t = normalize(text);
  for (const cat of FIXED_CATEGORIES) {
    // se o texto já contém a label PT normalizada
    if (t.includes(normalize(cat.labelPt))) return { labelPt: cat.labelPt, dbKeysEn: cat.dbKeysEn };
    // ou qualquer variante pt/en
    if (cat.variants.some(v => t.includes(normalize(v)))) {
      return { labelPt: cat.labelPt, dbKeysEn: cat.dbKeysEn };
    }
  }
  return null;
}

// =============================================================================
// Autor: hidratação (fallback) caso o join não traga o full_name
// =============================================================================

type ProfileLite = { id: string; full_name?: string | null };

async function fetchProfilesByIds(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);

  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const p of data as ProfileLite[]) {
    if (p?.id) map[p.id] = p.full_name ?? '';
  }
  return map;
}

async function hydrateAuthors(recipes: any[]): Promise<any[]> {
  // Se já veio full_name via join, mantemos; senão buscamos pelos ids
  const needIds = recipes
    .filter(r => !r?.author_profile?.full_name && !r?.__author_name)
    .map(r => r?.author_id)
    .filter(Boolean) as string[];

  const map = await fetchProfilesByIds(needIds);
  return recipes.map(r => {
    if (!r?.author_profile?.full_name && map[r?.author_id]) {
      return { ...r, __author_name: map[r.author_id] };
    }
    return r;
  });
}

// =============================================================================
// Consulta de receitas por CATEGORIA (usando os valores em inglês salvos no BD)
// =============================================================================

async function queryRecipesByCategoryDB(dbKeysEn: string[], limit = 40): Promise<any[]> {
  const orExpr = dbKeysEn.map(k => `category.ilike.%${k}%`).join(',');

  // 1) Tenta com join no profiles (via FK comum do Supabase)
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        id, title, description, category, prep_time, difficulty, rating, author_id,
        author_profile:profiles!recipes_author_id_fkey ( id, full_name )
      `)
      .or(orExpr)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Se veio sem nomes (schema diferente), hidrata
    const result = await hydrateAuthors((data || []) as any[]);
    return result;
  } catch {
    // 2) Fallback: sem join, depois hidrata nomes
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, description, category, prep_time, difficulty, rating, author_id')
      .or(orExpr)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const result = await hydrateAuthors((data || []) as any[]);
    return result;
  }
}

function capAndMapRecipes(list: any[], cap = 6) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of list) {
    const key = r?.id ?? r?.title;
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
    rating: typeof r.rating === 'number' ? r.rating : 0
  }));
}

// =============================================================================
// Orquestrador baseado em CATEGORIA
// =============================================================================

export async function answerQuestionWithSiteData(question: string): Promise<{
  found: boolean;
  categoryPt: string | null;     // rótulo em PT para exibição
  items: any[];
  text: string;
}> {
  const cat = detectCategoryFromText(question);

  if (!cat) {
    return {
      found: false,
      categoryPt: null,
      items: [],
      text: 'Certo! Me diz rapidinho o estilo que você quer (ex.: vegana, low carb, rica em proteína, sem glúten ou vegetariana) que eu já trago sugestões. 🙂'
    };
  }

  // Busca por categoria usando os valores em inglês do BD
  const raw = await queryRecipesByCategoryDB(cat.dbKeysEn, 40);
  const chosen = raw;

  // Contexto para o modelo (apenas para formatar a resposta de forma amigável)
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

  const header = !chosen.length
    ? `Dei uma olhada em **${cat.labelPt}** e não achei opções por aqui. Quer tentar outro estilo?`
    : `Boa! Separei algumas ideias em **${cat.labelPt}**:`;

  // Você pode remover o getGeminiResponse e montar um texto fixo se preferir 0 dependência de LLM
  const userPrompt = [
    header,
    'Receitas (JSON):',
    JSON.stringify(ctxRecipes, null, 2),
    'Formate a resposta em lista (título, tempo se houver, dificuldade, autor).',
    'Se a lista vier vazia, apenas diga que não encontrou e convide a tentar outro estilo.',
    'Responda de forma amigável, natural e em português. Não invente receitas fora da lista.'
  ].join('\n\n');

  const resp = await getGeminiResponse(userPrompt);
  const text = resp.content;

  return { found: !!chosen.length, categoryPt: cat.labelPt, items: chosen, text };
}

// =============================================================================
// Busca simples (opcional; não usada para decisão)
// =============================================================================

export async function searchRecipesForAI(query: string, limit = 5): Promise<{ recipes: any[]; context: string }> {
  // Tentamos o join; se falhar, hidratamos depois
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        id, title, description, category, difficulty, rating, author_id,
        author_profile:profiles!recipes_author_id_fkey ( id, full_name )
      `)
      .ilike('title', `%${query}%`)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const result = await hydrateAuthors((data || []) as any[]);

    const recipes = result;
    const context = recipes.map((r: any) => {
      const author = extractAuthorName(r);
      return `• ${r.title} (${r.category || 'geral'}) — Autor: ${author} — Nota: ${typeof r.rating === 'number' ? r.rating : 0}`;
    }).join('\n');

    return { recipes, context };
  } catch {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, description, category, difficulty, rating, author_id')
      .ilike('title', `%${query}%`)
      .order('rating', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const result = await hydrateAuthors((data || []) as any[]);
    const recipes = result;
    const context = recipes.map((r: any) => {
      const author = extractAuthorName(r);
      return `• ${r.title} (${r.category || 'geral'}) — Autor: ${author} — Nota: ${typeof r.rating === 'number' ? r.rating : 0}`;
    }).join('\n');

    return { recipes, context };
  }
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
// Processamento de mensagem do usuário -> AIResponse (amigável & natural)
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

  // 3) Fluxo normal (categoria-first, usando os valores do BD em inglês)
  const { found, categoryPt, items, text } = await answerQuestionWithSiteData(content);

  // Se não identifiquei a categoria, peça de forma leve
  if (!categoryPt) {
    return {
      content: 'Entendi. Você pode me dizer rapidinho o estilo que prefere? (ex.: vegana, low carb, rica em proteína, sem glúten ou vegetariana)',
      recipes: [],
      suggestions: []
    };
  }

  // Se a categoria veio, mas não há resultados
  if (!found || !items.length) {
    return {
      content: `Olhei em **${categoryPt}** e, por aqui, não encontrei opções. Quer tentar outro estilo? Posso procurar em “low carb”, “vegetariana”, “sem glúten”… você escolhe 🙂`,
      recipes: [],
      suggestions: []
    };
  }

  // OK: retorna as receitas da categoria escolhida (com autor/rating reais)
  const recipes = capAndMapRecipes(items, 6);

  return {
    content: text,
    recipes,
    suggestions: []
  };
}
