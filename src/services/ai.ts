// src/services/ai.ts
// =============================================================================
// Serviço de IA unificado (com RAG simples) para o NutriChefe
// - CRUD de configs, conversas e mensagens
// - Busca de receitas no Supabase
// - RAG com filtros dietéticos **estritos** (vegano, vegetariano, sem lactose, sem glúten, low carb)
// - UX: evita respostas "afobadas" em saudações/mensagens vagas
// - Autor das receitas resolvido com múltiplas fontes
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

// =============================================================================
// Regras dietéticas estritas
// =============================================================================

type DietaryMode =
  | 'vegan'
  | 'vegetarian'
  | 'lactose-free'
  | 'gluten-free'
  | 'low-carb';

const VEGAN_FORBIDDEN = [
  // carnes em geral
  'carne','bovina','porco','suino','presunto','bacon','linguica','salsicha','frango','galinha','peru',
  'peixe','atum','sardinha','bacalhau','anchova','salmao','tilapia','camarao','lula','polvo','marisco',
  // ovos e lacteos
  'ovo','ovos','gema','clara',
  'leite','lactose','manteiga','queijo','creme de leite','nata','requeijao','iogurte','soro do leite','whey','caseina',
  // outros de origem animal
  'gelatina','mel','mel de abelha','banha'
];

const VEGETARIAN_FORBIDDEN = [
  // carnes e pescados (ovos e lacteos permitidos)
  'carne','bovina','porco','suino','presunto','bacon','linguica','salsicha','frango','galinha','peru',
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

function textFromRecipe(r: any) {
  const parts = [
    r?.title, r?.description, r?.category,
    ...(Array.isArray(r?.ingredients) ? r.ingredients : []),
    ...(Array.isArray(r?.instructions) ? r.instructions : [])
  ]
  .filter(Boolean)
  .join(' ');
  return normalize(parts);
}

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
      // Heurística simples: se listar muitos high-carb explícitos, descarta
      return hasAny(HIGH_CARB_CULPRITS);
    default:
      return false;
  }
}

function pickDietaryMode(dietary: string[] | undefined): DietaryMode | undefined {
  if (!dietary || !dietary.length) return undefined;
  const d = dietary.map(normalize);
  if (d.some(x => x.includes('vegana') || x.includes('vegano'))) return 'vegan';
  if (d.some(x => x.includes('vegetarian'))) return 'vegetarian';
  if (d.some(x => x.includes('sem lactose') || x.includes('lactose'))) return 'lactose-free';
  if (d.some(x => x.includes('sem glute') || x.includes('gluten'))) return 'gluten-free';
  if (d.some(x => x.includes('low carb'))) return 'low-carb';
  return undefined;
}

// =============================================================================
// Extrator de intenção / filtros de receitas (RAG)
// =============================================================================

type RecipeFilters = {
  ingredients: string[];
  category?: string; // café, almoço, jantar... (não é restrição dietética)
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
  'low carb','keto','paleo' // (keto/paleo: trataremos como low-carb em heurística)
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
  if (q.includes('keto') || q.includes('paleo')) dietary.push('low carb');

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
/** Base de SELECT tentando join com profiles; fallback para '*' se não houver relação */
async function selectRecipesBase(limit: number) {
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

// Busca principal com filtros básicos no banco; filtros dietéticos são validados em memória (mais seguro)
async function queryRecipes(filters: RecipeFilters, limit = 40): Promise<Recipe[]> {
  try {
    let q = await selectRecipesBase(limit);

    if (filters.maxPrepTime) q = q.lte('prep_time', filters.maxPrepTime);
    if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
    if (filters.category)  q = q.ilike('category', `%${filters.category}%`);
    if (filters.ingredients.length) q = q.contains('ingredients', filters.ingredients);

    // Preferir melhores avaliadas para estabilidade
    // (se sua tabela tiver "rating", ordene decrescente)
    // @ts-ignore
    if (typeof (q as any).order === 'function') {
      // @ts-ignore
      q = (q as any).order('rating', { ascending: false });
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  } catch {
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

async function fallbackSimilarRecipes(filters: RecipeFilters, limit = 40): Promise<Recipe[]> {
  try {
    let q = await selectRecipesBase(limit);

    // Fallback: relaxa ingredientes, mantém categoria se houver
    if (filters.category) q = q.ilike('category', `%${filters.category}%`);

    // Ordene estável
    // @ts-ignore
    if (typeof (q as any).order === 'function') {
      // @ts-ignore
      q = (q as any).order('rating', { ascending: false });
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  } catch {
    let q = supabase.from('recipes').select('*').limit(limit);
    if (filters.category) q = q.ilike('category', `%${filters.category}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data as any as Recipe[]) || [];
  }
}

// Filtra em memória para garantir conformidade dietética estrita
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
// Orquestrador RAG com dieta estrita e sem mistura aleatória
// =============================================================================

export async function answerQuestionWithSiteData(question: string): Promise<{
  found: boolean;
  primary: Recipe[];
  fallback?: Recipe[];
  text: string;
}> {
  const filters = extractFilters(question);
  const dietaryMode = pickDietaryMode(filters.dietary);

  // 1) Busca principal
  const rawPrimary = await queryRecipes(filters, 40);
  const primary = applyDietaryCompliance(rawPrimary, dietaryMode);

  let found = primary.length > 0;
  let fallback: Recipe[] | undefined;

  // 2) Se nada compatível, tenta fallback (relaxa só categoria; dieta permanece estrita)
  if (!found) {
    const rawFallback = await fallbackSimilarRecipes(filters, 40);
    const compliantFallback = applyDietaryCompliance(rawFallback, dietaryMode);
    if (compliantFallback.length > 0) {
      fallback = compliantFallback;
    }
  }

  // 3) Prepara contexto **somente** com a lista que será exibida
  const chosen = found ? primary : (fallback || []);
  const ctxRecipes = chosen.map((r: any) => ({
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

  const disclaimer = !chosen.length
    ? 'Não encontrei opções que respeitem suas restrições. Posso tentar com outros ingredientes ou estilos?'
    : (found ? 'Foram encontradas receitas compatíveis.' :
       'Não encontrei exatamente isso, mas aqui estão alternativas semelhantes que respeitam sua restrição.');

  const userPrompt = [
    `Pergunta do usuário: "${question}"`,
    disclaimer,
    'Receitas disponíveis (JSON):',
    JSON.stringify(ctxRecipes, null, 2),
    'Monte a resposta em lista, com título, tempo de preparo, dificuldade, autor e ingredientes principais.',
    'Responda em português e não invente receitas fora da lista.'
  ].join('\n\n');

  const resp = await getGeminiResponse(userPrompt);
  const text = resp.content;

  return { found, primary, fallback, text };
}

// =============================================================================
// Busca simples (opcional)
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

  // 3) Fluxo normal (RAG com dieta estrita)
  const { text, primary, fallback } = await answerQuestionWithSiteData(content);

  // usamos apenas UMA lista (sem mistura)
  const chosen = primary.length ? primary : (fallback || []);
  const recipes = capAndMapRecipes(chosen, 6);

  // Se ainda não há nada, devolve uma resposta guiando o usuário
  if (!recipes.length) {
    return {
      content:
        'Não encontrei receitas que respeitem exatamente o que você pediu. Quer me dizer 1–2 ingredientes que tem aí ou se prefere algo rápido (≤ 20 min)? Posso tentar novamente!',
      recipes: [],
      suggestions: [
        'Vegana com grão-de-bico',
        'Sem lactose com frango',
        'Sem glúten em 20 min'
      ]
    };
  }

  // Caso haja, usa o texto formatado pelo modelo + lista estrita
  return {
    content: text,
    recipes,
    suggestions: [
      'Filtrar por ≤ 20 min',
      'Ver versão sem glúten',
      'Ver opções low carb'
    ]
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
