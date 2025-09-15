// src/services/ai.ts
// ============================================================
/*  NutriChefe — Camada de IA (tudo em um arquivo)
    - Intenção de "pedido de receita"
    - Guardrail do Gemini (não inventar receitas externas)
    - Busca por receitas do site (com sinônimos e fallback)
    - Mensagens naturais/dinâmicas
    - API compatível com o frontend:
        createAIConversation, getAIMessages(fetchMessages),
        sendAIMessage(sendMessage), createAIMessage(postMessage)
    - Histórico em memória por conversa (Map)
*/
// ============================================================

import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

const MODEL_NAME = 'gemini-2.5-flash';

// ============================================================
// Tipos utilitários simples (ajuste conforme sua UI/DB)
// ============================================================

export type AIRecipeCard = {
  id: string | number;
  title: string;
  image_url?: string;
  rating?: number;
  prep_time?: number;
  category?: string;
};

export type AIResponse = {
  content: string;
  recipes?: AIRecipeCard[];
  suggestions?: string[];
};

type DetectedFilters = {
  searchTerm?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  minRating?: number;
  authorName?: string;
  onlyNutritionist?: boolean;
  wantAll?: boolean;
};

type DetectedCategory = {
  dbKeysEn?: string[];
};

// ============================================================
// Histórico em memória (simples)
// ============================================================

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipes?: AIRecipeCard[];
  suggestions?: string[];
  createdAt: string;
};

type Conversation = {
  id: string;
  messages: ChatMessage[];
  metadata?: any;
  createdAt: string;
};

const conversations = new Map<string, Conversation>();

function genId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function pushMessage(conversationId: string, msg: Omit<ChatMessage, 'id' | 'createdAt'>) {
  const conv = conversations.get(conversationId);
  if (!conv) return;
  const message: ChatMessage = {
    id: genId('msg'),
    createdAt: new Date().toISOString(),
    ...msg,
  };
  conv.messages.push(message);
}

// ============================================================
// Normalização e utilidades
// ============================================================

function normalizeText(s?: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    // @ts-ignore - regex Unicode property requires ES2024 lib; em runtime V8/Node moderno funciona
    .replace(/\p{Diacritic}/gu, '');
}

function hasText(v?: string | null) {
  return !!(v && v.trim().length > 0);
}

function buildRecipesBaseSelect(_needInner: boolean) {
  return `
    id,
    title,
    description,
    image_url,
    rating,
    prep_time,
    ingredients,
    category,
    author_name,
    is_nutritionist
  `;
}

function capAndMapRecipes(items: any[], max: number): AIRecipeCard[] {
  return (items || [])
    .slice(0, Math.max(0, max))
    .map((r) => ({
      id: r.id,
      title: r.title,
      image_url: r.image_url,
      rating: r.rating ?? undefined,
      prep_time: r.prep_time ?? undefined,
      category: r.category ?? undefined,
    }));
}

// ============================================================
// Heurísticas simples (stubs) — ajuste se já tiver NLP próprio
// ============================================================

function detectFiltersFromText(content: string): DetectedFilters {
  const raw = content || '';
  const t = normalizeText(raw);

  let difficulty: DetectedFilters['difficulty'] | undefined;
  if (/\bfacil\b/.test(t)) difficulty = 'easy';
  else if (/\bmedio|intermediario\b/.test(t)) difficulty = 'medium';
  else if (/\bdificil|avancad/.test(t)) difficulty = 'hard';

  let maxPrepTime: number | undefined;
  const m = raw.match(/(\d+)\s*(min|mins|minutos|minutes|m)\b/i);
  if (m) maxPrepTime = parseInt(m[1], 10);

  let minRating: number | undefined;
  const r = raw.match(/\b(4|4\.5|5)\b/);
  if (/\b(bem avaliada|melhores|top)\b/i.test(raw) && !r) minRating = 4;
  if (r) minRating = Math.min(5, parseFloat(r[1]));

  const onlyNutritionist = /\bnutricion(ista|al)\b/i.test(raw);
  const a = raw.match(/\b(do|da)\s+nutricion(ista|al)\s+([A-Za-zÀ-ÿ ]{2,})/i);
  const authorName = a ? a[3].trim() : undefined;

  let searchTerm: string | undefined;
  const withIng = raw.match(/\b(com|sem|usando)\s+([A-Za-zÀ-ÿ ]{2,})/i);
  if (withIng) searchTerm = withIng[2].trim();

  if (!searchTerm) {
    const candidatas = raw
      .replace(/[?!.,;:()]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !/\b(receita|receitas|prato|cozinhar|preparar|fazer|ingrediente|ingredientes)\b/i.test(w));
    if (candidatas.length) searchTerm = candidatas[candidatas.length - 1];
  }

  return { searchTerm, difficulty, maxPrepTime, minRating, authorName, onlyNutritionist, wantAll: false };
}

function detectCategoryFromText(content: string): DetectedCategory {
  const t = normalizeText(content);
  const map: Record<string, string[]> = {
    dessert: ['sobremesa', 'doce', 'docinho'],
    salad: ['salada'],
    pasta: ['massa', 'macarrao'],
    soup: ['sopa', 'caldo'],
    breakfast: ['cafe da manha', 'matinal'],
  };
  const found: string[] = [];
  for (const [dbKey, kws] of Object.entries(map)) {
    if (kws.some((k) => t.includes(k))) found.push(dbKey);
  }
  return { dbKeysEn: found.length ? found : undefined };
}

// ============================================================
// 1) Detecção de intenção robusta
// ============================================================

export function isRecipeRequest(text: string): boolean {
  const t = normalizeText(text);

  const keywords = [
    'receita', 'receitas', 'prato', 'pratos',
    'cozinhar', 'cozinha', 'preparar', 'fazer',
    'ingrediente', 'ingredientes', 'modo de preparo',
    'como faco', 'como fazer',
    'o que da pra fazer', 'o que posso fazer', 'o que fazer',
    'ideias de receita', 'ideia de receita'
  ];
  if (keywords.some((k) => t.includes(k))) return true;

  const padroes = [
    /\b(quero|preciso|busco|procuro).+\b(com|sem|usando)\b/i,
    /\b(o que|oq|q).+\b(fazer|cozinhar|preparar)\b/i,
    /\b(receita|prato).+\b(com|sem)\b/i,
    /\b(ideias|ideia).+\b(receita|prato)\b/i,
  ];
  return padroes.some((r) => r.test(text));
}

// ============================================================
// 2) Guardrail do Gemini (NUNCA citar receitas externas)
// ============================================================

const SYSTEM_POLICY = `
Você é o assistente do NutriChefe. Políticas estritas:
1) Nunca recomende, descreva ou cite receitas que não estejam no nosso banco de dados (site).
2) Se o usuário pedir uma receita, ingredientes, substituições, tempo de preparo ou modo de preparo,
   responda com uma frase curta dizendo que vai buscar no acervo do site e ENCERRAR a resposta.
   (A camada de aplicação fará a busca e mostrará as receitas do site.)
3) Você pode responder dúvidas gerais de nutrição, segurança alimentar e técnicas de cozinha,
   mas SEM citar receitas específicas nem links externos.
4) Se o usuário pedir receita externa, explique gentilmente que só trabalhamos com as receitas do NutriChefe.
`;

function looksLikeRecipeTopic(text: string): boolean {
  return /\b(receita|prato|cozinhar|cozinha|preparo|modo de preparo|ingrediente|o que fazer|o que da pra fazer|ideias de receita)\b/i
    .test(text);
}

export async function getGeminiResponse(userText: string, historyParts: any[] = []) {
  if (looksLikeRecipeTopic(userText)) {
    return { content: 'Beleza! Vou procurar no nosso acervo e te mostro opções do site. 😉' };
  }

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const contents = [
    { role: 'system', parts: [{ text: SYSTEM_POLICY }] },
    ...historyParts,
    { role: 'user', parts: [{ text: userText }] },
  ];

  const result = await model.generateContent({ contents });
  const text =
    // @ts-ignore
    (typeof result?.response?.text === 'function' ? result?.response?.text() : '') ||
    // @ts-ignore
    result?.response?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join('\n') ||
    '';

  return { content: text || 'Posso ajudar com isso! 😊' };
}

// ============================================================
// 3) Busca por receitas do site (com sinônimos + fallback)
// ============================================================

const SIMILAR_INGREDIENTS: Record<string, string[]> = {
  'morango': ['fruta vermelha','frutas vermelhas','amora','framboesa','mirtilo','cereja'],
  'franco': ['peito de frango','sobrecoxa','ave'],
  'frango': ['peito de frango','sobrecoxa','ave'],
  'carne moida': ['patinho moido','acem moido','coxao duro moido','carne bovina moida'],
  'batata': ['batata doce','mandioquinha','baroa','inhame'],
  'abobrinha': ['berinjela'],
};

async function queryRecipesByAnyFilters(opts: {
  categories?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  minRating?: number;
  searchTerm?: string;
  authorName?: string;
  onlyNutritionist?: boolean;
  limit?: number;
}): Promise<any[]> {
  const {
    categories, difficulty, maxPrepTime, minRating,
    searchTerm, authorName, onlyNutritionist, limit = 50
  } = opts;

  const needInner = !!(authorName || onlyNutritionist);
  let query = supabase.from('recipes').select(buildRecipesBaseSelect(needInner));

  if (categories?.length) query = query.in('category', categories);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (typeof maxPrepTime === 'number') query = query.lte('prep_time', maxPrepTime);
  if (typeof minRating === 'number') query = query.gte('rating', minRating);

  if (hasText(searchTerm)) {
    const t = `%${searchTerm!.trim()}%`;
    query = query.or(
      `title.ilike.${t},description.ilike.${t},ingredients::text.ilike.${t}`
    );
  }

  if (onlyNutritionist) query = query.eq('is_nutritionist', true);
  if (authorName) query = query.ilike('author_name', `%${authorName}%`);

  const { data } = await query.order('rating', { ascending: false }).limit(limit);
  return data || [];
}

export async function recommendRecipesFromText(content: string): Promise<AIResponse> {
  const f = detectFiltersFromText(content);
  const cat = detectCategoryFromText(content);
  const origSearch = f.searchTerm?.trim() || '';
  const searchKey = normalizeText(origSearch);

  // 1) Busca principal
  let items = await queryRecipesByAnyFilters({
    categories: cat?.dbKeysEn,
    difficulty: f.difficulty,
    maxPrepTime: f.maxPrepTime,
    minRating: f.minRating,
    searchTerm: origSearch,
    authorName: f.authorName,
    onlyNutritionist: f.onlyNutritionist,
    limit: f.wantAll ? 100 : 40,
  });

  // 2) Relaxar filtros gradualmente
  if (!items.length) {
    items = await queryRecipesByAnyFilters({
      categories: cat?.dbKeysEn,
      maxPrepTime: f.maxPrepTime,
      searchTerm: origSearch,
      limit: 40,
    });

    if (!items.length) {
      items = await queryRecipesByAnyFilters({
        categories: cat?.dbKeysEn,
        searchTerm: origSearch,
        limit: 40,
      });
    }
  }

  // 3) Sem resultados: tentar "semelhantes" por sinônimos
  if (!items.length && searchKey) {
    const similares = SIMILAR_INGREDIENTS[searchKey] || [];
    for (const termo of similares) {
      const alt = await queryRecipesByAnyFilters({
        categories: cat?.dbKeysEn,
        searchTerm: termo,
        limit: 40,
      });
      if (alt?.length) {
        items = alt;
        break;
      }
    }
  }

  // 4) Ainda nada: populares do SITE
  if (!items.length) {
    const { data: populares } = await supabase
      .from('recipes')
      .select(buildRecipesBaseSelect(false))
      .order('rating', { ascending: false })
      .limit(12);
    items = populares || [];
  }

  // ----- Mensagem natural/dinâmica -----
  let contentMsg = '';
  const found = items.length;

  if (!found) {
    contentMsg = origSearch
      ? `Não encontrei exatamente "${origSearch}", e ainda não temos itens semelhantes no nosso acervo. Quer tentar outro ingrediente?`
      : `Ainda não temos receitas para esse pedido. Quer tentar com outro ingrediente ou categoria?`;
  } else if (origSearch) {
    const usamosSimilar =
      !!(SIMILAR_INGREDIENTS[searchKey]?.length) &&
      !items.some((r: any) => {
        const blob = `${(r.title || '')} ${(r.description || '')} ${JSON.stringify(r.ingredients || {})}`.toLowerCase();
        return blob.includes(searchKey);
      });

    contentMsg = usamosSimilar
      ? `Não achei exatamente com "${origSearch}", mas separei **receitas semelhantes** do nosso site:`
      : `Achei ${found} receita${found > 1 ? 's' : ''} do nosso site${origSearch ? ` com "${origSearch}"` : ''}:`;
  } else {
    contentMsg = `Olha só essas opções do nosso site:`;
  }

  const recipes: AIRecipeCard[] = capAndMapRecipes(items, 12);

  const suggestions =
    recipes.length < 5
      ? [
          'ver receitas fáceis',
          'ver receitas rápidas',
          'trocar ingrediente (ex.: morango → frutas vermelhas)',
        ]
      : [];

  return { content: contentMsg, recipes, suggestions };
}

// ============================================================
// 4) Roteamento e camada de serviço compatível com o frontend
// ============================================================

export async function routeAIMessage(userText: string, historyParts: any[] = []) {
  if (isRecipeRequest(userText)) {
    return await recommendRecipesFromText(userText);
  }
  return await getGeminiResponse(userText, historyParts);
}

// ---------- Conversas ----------

export async function createAIConversation(metadata?: any) {
  const conversationId = genId('conv');
  const conv: Conversation = {
    id: conversationId,
    createdAt: new Date().toISOString(),
    metadata: metadata ?? null,
    messages: [],
  };
  conversations.set(conversationId, conv);

  const welcomeText =
    'Oi! Me diga o que você quer cozinhar ou um ingrediente que você tem aí. Eu buscarei **somente** receitas do nosso site. 🍳';
  pushMessage(conversationId, { role: 'assistant', content: welcomeText });

  return {
    conversationId,
    createdAt: conv.createdAt,
    metadata: conv.metadata,
    welcome: { content: welcomeText },
  };
}

export async function getAIMessages(conversationId: string) {
  const conv = conversations.get(conversationId);
  if (!conv) return [];
  return conv.messages.map((m) => ({ ...m }));
}
export const fetchMessages = getAIMessages;

// Envia e registra no histórico
export async function sendAIMessage(params: {
  conversationId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const { conversationId, message, history = [] } = params;

  if (!conversations.has(conversationId)) {
    // cria conversa silenciosamente se não existir
    const created = await createAIConversation();
    // opcionalmente poderíamos usar created.conversationId,
    // mas o front normalmente mantém o id.
  }

  pushMessage(conversationId, { role: 'user', content: message });

  const historyParts = history.map((h) => ({
    role: h.role,
    parts: [{ text: h.content }],
  }));

  const result = await routeAIMessage(message, historyParts);

  pushMessage(conversationId, {
    role: 'assistant',
    content: result.content,
    recipes: result.recipes,
    suggestions: result.suggestions,
  });

  return {
    conversationId,
    result,
  };
}
export const sendMessage = sendAIMessage;

// Alguns frontends usam "createAIMessage" para "enviar mensagem"
export async function createAIMessage(params: {
  conversationId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  // Alias direto para sendAIMessage
  return await sendAIMessage(params);
}
// Alias extra comum
export const postMessage = createAIMessage;

// Objeto default para import estilo "aiService.X(...)"
const aiService = {
  // fluxo de conversa
  createAIConversation,
  getAIMessages,
  fetchMessages,
  sendAIMessage,
  sendMessage,
  createAIMessage,
  postMessage,

  // alto nível
  routeAIMessage,

  // domínio
  recommendRecipesFromText,
  getGeminiResponse,
  isRecipeRequest,
};

export default aiService;
