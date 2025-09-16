// src/services/ai.ts
// =============================================================================
// NutriChefe — Serviço de IA Conversacional (com busca de receitas do próprio banco)
// =============================================================================

import { supabase } from '../lib/supabase';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

// =============================================================================
// Tipos
// =============================================================================
type Difficulty = 'easy' | 'medium' | 'hard';
type SiteCategory =
  | 'Vegana'
  | 'Baixo Carboidrato'
  | 'Rica em Proteína'
  | 'Sem Glúten'
  | 'Vegetariana';

interface RecipeRow {
  id: string;
  title: string;
  description: string;
  image: string;
  prep_time: number;
  difficulty: Difficulty;
  rating: number | null;
  category: string;
  author_id?: string | null;
  author_name?: string | null;
  nutrition_facts?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    [k: string]: any;
  } | null;
  reviews?: { rating: number }[];
  created_at?: string;
  updated_at?: string;
}

interface AppRecipeCard {
  id: number;
  title: string;
  description: string;
  author: string;
  rating: number;
}

// =============================================================================
// Vocabulário
// =============================================================================
const DIFFICULTY_SYNONYMS: Record<Difficulty, string[]> = {
  easy: ['fácil', 'facil', 'simples', 'iniciante', 'tranquila', 'descomplicada'],
  medium: ['médio', 'medio', 'intermediário', 'intermediario', 'média', 'mediana'],
  hard: ['difícil', 'dificil', 'avançado', 'avancado', 'complexo', 'trabalhosa'],
};

const CATEGORY_LABELS: SiteCategory[] = [
  'Vegana',
  'Baixo Carboidrato',
  'Rica em Proteína',
  'Sem Glúten',
  'Vegetariana',
];

const CATEGORY_SYNONYMS: Record<SiteCategory, string[]> = {
  'Vegana': ['vegana', 'vegano', 'vegan'],
  'Baixo Carboidrato': ['baixo carboidrato', 'low carb', 'pouco carbo', 'baixo carb', 'lowcarb'],
  'Rica em Proteína': ['rica em proteína', 'muita proteina', 'alta proteína', 'alto teor proteico', 'proteica', 'proteinado'],
  'Sem Glúten': ['sem glúten', 'sem gluten', 'gluten free', 'sg', 'livre de glúten'],
  'Vegetariana': ['vegetariana', 'vegetariano', 'veggie', 'ovo-lacto', 'ovolacto'],
};

const NUM_RE = /(\d+(?:[.,]\d+)?)/;

// =============================================================================
// Utils
// =============================================================================
function uuidToNumericId(uuid: string): number {
  const hex = uuid.replace(/-/g, '').slice(0, 8);
  return parseInt(hex, 16);
}

function toSafeString(v: any): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

function normalize(s: any) {
  return toSafeString(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ');
}

function round1(n: number | null | undefined): number {
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return Math.round(Number(n) * 10) / 10;
}

function avgRating(reviews?: { rating: number }[] | null): number {
  if (!reviews?.length) return 0;
  const m = reviews.reduce((a, r) => a + (r.rating ?? 0), 0) / reviews.length;
  return round1(m);
}

function mapRowToCard(r: RecipeRow): AppRecipeCard {
  const rating = (typeof r.rating === 'number' ? r.rating : avgRating(r.reviews)) || 0;
  return {
    id: uuidToNumericId(r.id),
    title: r.title,
    description: r.description,
    author: r.author_name || 'NutriChefe',
    rating,
  };
}

// =============================================================================
// Parser de linguagem natural -> filtros
// =============================================================================
interface ParsedFilters {
  category?: SiteCategory;
  difficulty?: Difficulty;
  maxPrep?: number;     // minutos (≤)
  minPrep?: number;     // minutos (≥)
  minRating?: number;   // 0..5
  wantAll?: boolean;
  plainSearch?: string;
}

function parseQueryToFilters(q: string): ParsedFilters {
  const text = normalize(q);
  const f: ParsedFilters = {};

  // Categoria
  for (const cat of CATEGORY_LABELS) {
    const syns = CATEGORY_SYNONYMS[cat].map(normalize);
    if (syns.some(s => text.includes(s))) {
      f.category = cat;
      break;
    }
  }

  // Dificuldade
  for (const [key, syns] of Object.entries(DIFFICULTY_SYNONYMS)) {
    if (syns.some(s => text.includes(normalize(s)))) {
      f.difficulty = key as Difficulty;
      break;
    }
  }
  if (!f.difficulty && (/\bm[eé]di[oa]\b/.test(text))) f.difficulty = 'medium';

  // Tempo (palavras)
  if (/\br[aá]pid[oa]\b/.test(text) || /\b<=?\s*15\b/.test(text)) f.maxPrep = 15;
  if (/\bm[eé]di[oa]\b/.test(text) || /\b<=?\s*30\b/.test(text)) f.maxPrep = f.maxPrep ?? 30;
  if (/\blongo?\b|\b>?\s*30\b/.test(text)) f.minPrep = 31;

  // “em X minutos / até X min”
  const mTime = text.match(new RegExp(`\\b(em|ate|até|<=?)\\s*${NUM_RE.source}\\s*(min|mins|minutos)\\b`));
  if (mTime) {
    const mins = parseFloat(mTime[2].replace(',', '.'));
    if (!isNaN(mins)) f.maxPrep = Math.min(f.maxPrep ?? Infinity, mins);
  }

  // Avaliação mínima
  const starPlus = text.match(new RegExp(`${NUM_RE.source}\\s*(\\+|mais)?\\s*(\\*|estrela|estrelas)?`));
  if (starPlus) {
    const val = parseFloat(starPlus[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0 && val <= 5) {
      if (/\+|mais/.test(starPlus[2] || '') || /estrela|\*/.test(starPlus[3] || '')) {
        f.minRating = val;
      }
    }
  }
  if (/\b4\+\b/.test(text)) f.minRating = Math.max(f.minRating ?? 0, 4);
  if (/\b4[.,]5\+\b/.test(text)) f.minRating = Math.max(f.minRating ?? 0, 4.5);
  if (/\b5\s*(\*|estrelas?)?\b/.test(text)) f.minRating = 5;

  // “todas/qualquer”
  if (/\btod[ao]s?\b|\bqualquer\b/.test(text)) f.wantAll = true;

  // termo livre
  const cleaned = (q || '').trim();
  if (cleaned && cleaned.length > 2) f.plainSearch = cleaned;

  return f;
}

// =============================================================================
// DB: receitas + autores (profiles) + reviews (agregação) — sem JOIN declarativo
// =============================================================================
async function fetchRecipesFromDB(): Promise<RecipeRow[]> {
  // Receitas
  const { data: recipeRows, error: recipesErr } = await supabase
    .from('recipes')
    .select('id, title, description, image, prep_time, difficulty, category, rating, nutrition_facts, author_id, created_at, updated_at');

  if (recipesErr) throw recipesErr;

  const rows = (recipeRows || []) as Array<{
    id: string;
    title: string;
    description: string;
    image: string;
    prep_time: number;
    difficulty: string;
    category: string;
    rating: number | null;
    nutrition_facts?: any | null;
    author_id: string | null;
    created_at?: string;
    updated_at?: string;
  }>;

  if (rows.length === 0) return [];

  // Autores
  const authorIds = Array.from(new Set(rows.map(r => r.author_id).filter(Boolean))) as string[];
  let authorsMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds);

    if (!profilesErr && profiles) {
      authorsMap = Object.fromEntries(
        profiles.map(p => [p.id as string, (p.full_name as string) || 'NutriChefe'])
      );
    }
  }

  // Reviews -> média
  const recipeIds = rows.map(r => r.id);
  const { data: reviews, error: reviewsErr } = await supabase
    .from('reviews')
    .select('recipe_id, rating')
    .in('recipe_id', recipeIds);

  const ratingsAgg: Record<string, { sum: number; count: number }> = {};
  if (!reviewsErr && reviews && reviews.length) {
    for (const r of reviews as Array<{ recipe_id: string; rating: number }>) {
      if (!ratingsAgg[r.recipe_id]) ratingsAgg[r.recipe_id] = { sum: 0, count: 0 };
      ratingsAgg[r.recipe_id].sum += r.rating ?? 0;
      ratingsAgg[r.recipe_id].count += 1;
    }
  }

  // Resultado
  const result: RecipeRow[] = rows.map(r => {
    // rating efetivo
    let effectiveRating: number | null = r.rating ?? null;
    if (effectiveRating == null && ratingsAgg[r.id]?.count) {
      const avg = ratingsAgg[r.id].sum / ratingsAgg[r.id].count;
      effectiveRating = round1(avg);
    }

    // dificuldade -> union type
    const diffNorm = normalize(r.difficulty);
    const difficulty: Difficulty =
      (diffNorm.includes('facil') || diffNorm.includes('fácil')) ? 'easy' :
      (diffNorm.includes('medi')) ? 'medium' :
      (diffNorm.includes('dific')) ? 'hard' :
      'medium';

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      image: r.image,
      prep_time: r.prep_time,
      difficulty,
      category: r.category || '',
      rating: effectiveRating,
      author_id: r.author_id,
      author_name: (r.author_id && authorsMap[r.author_id]) ? authorsMap[r.author_id] : 'NutriChefe',
      nutrition_facts: r.nutrition_facts || null,
      reviews: [],
      created_at: r.created_at,
      updated_at: r.updated_at,
    } as RecipeRow;
  });

  return result;
}

function applyFilters(rows: RecipeRow[], f: ParsedFilters): RecipeRow[] {
  let list = rows.slice();

  if (f.category) {
    const needle = normalize(f.category);
    list = list.filter(r => normalize(r.category).includes(needle));
  }

  if (f.difficulty) {
    list = list.filter(r => r.difficulty === f.difficulty);
  }

  if (typeof f.maxPrep === 'number') list = list.filter(r => r.prep_time <= f.maxPrep);
  if (typeof f.minPrep === 'number') list = list.filter(r => r.prep_time >= f.minPrep);

  if (typeof f.minRating === 'number') {
    list = list.filter(r => (typeof r.rating === 'number' ? r.rating : 0) >= f.minRating!);
  }

  if (f.plainSearch) {
    const n = normalize(f.plainSearch);
    list = list.filter(r =>
      normalize(r.title).includes(n) ||
      normalize(r.description || '').includes(n)
    );
  }

  // Ordenar por: rating desc, depois prep_time asc
  list.sort((a, b) => {
    const ar = (typeof a.rating === 'number' ? a.rating : 0);
    const br = (typeof b.rating === 'number' ? b.rating : 0);
    if (br !== ar) return br - ar;
    return a.prep_time - b.prep_time;
  });

  return list;
}

function capAndMap(list: RecipeRow[], limit = 12): AppRecipeCard[] {
  return list.slice(0, limit).map(mapRowToCard);
}

// =============================================================================
// Conversas “inteligentes” (intents) — respostas naturais
// =============================================================================
type Intent =
  | 'recipe_search'
  | 'nutrition_recipe'
  | 'nutrition_general'
  | 'cooking_tips'
  | 'substitutions'
  | 'site_info'
  | 'greetings'
  | 'thanks'
  | 'help'
  | 'fallback';

function detectIntent(q: string): Intent {
  const t = normalize(q);

  // pedidos de receita / filtros
  const looksLikeRecipe =
    /\breceit/.test(t) ||
    CATEGORY_LABELS.some(cat => t.includes(normalize(cat))) ||
    Object.values(DIFFICULTY_SYNONYMS).some(syns => syns.some(s => t.includes(normalize(s)))) ||
    /\b(15|30)\b\s*(min|mins|minutos)|\b(r[aá]pid|m[eé]di|longo)\b/.test(t) ||
    /\b(4|4[.,]5|5)\s*(\+|estrelas?|\*)?/.test(t);

  if (looksLikeRecipe) return 'recipe_search';

  // nutrição sobre receita específica
  if (/\bnutri(c|ç)[aã]o|\bcaloria|\bprote[ií]na|\bcarbo|\bgordur|fibra|\bmacro|\bmicro/.test(t)) {
    if (/\breceit|nome|t[ií]tulo|\bdessa\b|\bdesta\b/.test(t)) return 'nutrition_recipe';
    return 'nutrition_general';
  }

  // dicas de cozinha
  if (/\bdica|\bt[eé]cnica|\bassar|\bfritar|\bassar|\btemperatur|ponto|assar|forno|frigideira|air ?fryer|panela/.test(t))
    return 'cooking_tips';

  // substituições
  if (/\bsubstit|posso trocar|alternativa|sem (ovo|leite|gl[úu]ten|a[çc]ucar|lactose)/.test(t))
    return 'substitutions';

  // informações do site
  if (/\bsite|plano|assinatura|categorias?|filtros?|avalia[cç][aã]o|min[ií]ma|privacidade|dados|como funciona|sobre\b/.test(t))
    return 'site_info';

  // social
  if (/\b(oi|ol[aá]|bom dia|boa tarde|boa noite|hello|hey)\b/.test(t)) return 'greetings';
  if (/\b(obrigad|valeu|agrade[cç]o)\b/.test(t)) return 'thanks';
  if (/\bajuda|como usar|n[aã]o sei|d[úu]vida\b/.test(t)) return 'help';

  return 'fallback';
}

// ===== respostas utilitárias (texto) =====
function siteInfoAnswer(): AIResponse {
  const content = [
    'Aqui no **NutriChefe** você encontra receitas filtrando por:',
    '• **Categorias**: Vegana, Baixo Carboidrato, Rica em Proteína, Sem Glúten, Vegetariana;',
    '• **Dificuldade**: Fácil, Médio, Difícil;',
    '• **Tempo de preparo**: Rápido (≤15 min), Médio (≤30 min), Longo (>30 min);',
    '• **Avaliação mínima**: 4+, 4.5+ ou 5⭐.',
    '',
    'Você pode pedir de forma natural, por exemplo:',
    '— "Quero uma **vegana fácil** em **15 min** 4.5+ ⭐";',
    '— "Receitas **sem glúten** de até **30 min**";',
    '— "Alguma **baixo carboidrato** **difícil** com **5⭐**".',
    '',
    'Privacidade: usamos seus dados apenas para melhorar sua experiência. Para dúvidas sobre planos/assinatura, atendimento e suporte, entre em contato pelo próprio app.',
  ].join('\n');
  return { content, recipes: [], suggestions: ['vegana fácil 15 min', 'sem glúten 30 min', 'baixo carbo 5⭐'] };
}

function greetingsAnswer(): AIResponse {
  return {
    content:
      'Oi! 👋 Sou a assistente do NutriChefe. Posso te sugerir receitas, dar dicas de cozinha e responder dúvidas de nutrição (de forma educativa). O que você quer hoje?',
    recipes: [],
    suggestions: ['receitas rápidas', 'vegana fácil', 'dica para air fryer'],
  };
}

function thanksAnswer(): AIResponse {
  return { content: 'De nada! Se precisar, é só chamar. 😊', recipes: [], suggestions: [] };
}

function helpAnswer(): AIResponse {
  return {
    content:
      'Você pode me pedir assim:\n• "vegana fácil 15 min 4.5+";\n• "substituição do ovo no bolo";\n• "dica para grelhar frango suculento";\n• "informações nutricionais dessa receita".',
    recipes: [],
    suggestions: ['substituir leite?', 'sem glúten fácil', 'rica em proteína 30 min'],
  };
}

function cookingTipsAnswer(q: string): AIResponse {
  const t = normalize(q);
  const tips: string[] = [];

  if (/\barroz\b/.test(t)) {
    tips.push('Arroz soltinho: lave até a água sair clara; refogue; use 1:1,6 de arroz:água; fogo baixo com panela semi-tampada; descansar 5 min.');
  }
  if (/\bfrango|peito\b/.test(t)) {
    tips.push('Frango suculento: sele com frigideira bem quente 2–3 min por lado, finalize em fogo baixo/tampa; descanse 3–5 min antes de cortar.');
  }
  if (/\bforno|assar\b/.test(t)) {
    tips.push('Assados uniformes: pré-aqueça bem; não sobrecarregue a assadeira; use termômetro (frango 74°C no centro).');
  }
  if (/\bair ?fryer\b/.test(t)) {
    tips.push('Air fryer: pré-aqueça; pincele óleo nas superfícies; vire na metade; não lote o cesto para manter crocância.');
  }
  if (tips.length === 0) {
    tips.push('Regra de ouro: pré-aqueça, tempere com antecedência (sal penetra), não lote panelas, e dê descanso às carnes após o cozimento.');
  }

  return { content: tips.join('\n'), recipes: [], suggestions: ['receitas rápidas', 'dica para legumes assados'] };
}

function substitutionsAnswer(q: string): AIResponse {
  const t = normalize(q);
  const lines: string[] = [];
  if (/\bovo\b/.test(t)) lines.push('Sem ovo: 1 ovo = 1 colher sopa linhaça/chia moída + 3 colheres sopa água (gel por 10 min) ou 1/4 xícara purê de maçã/banana (em bolos).');
  if (/\bleite|lactose\b/.test(t)) lines.push('Sem leite: use bebidas vegetais (aveia, amêndoas, soja). Em molhos, leite de coco dá corpo.');
  if (/\bgluten|gl[úu]ten\b/.test(t)) lines.push('Sem glúten: troque farinha de trigo por misturas sem glúten (arroz + fécula + polvilho) e adicione goma xantana (0,5–1%).');
  if (/\ba[çc][uú]car\b/.test(t)) lines.push('Menos açúcar: reduza 10–20% sem afetar estrutura; adoçantes culinários específicos funcionam em alguns casos (siga proporção do fabricante).');
  if (lines.length === 0) {
    lines.push('Substituições comuns:\n• Ovo: linhaça/chia gel ou purê de frutas\n• Leite: bebidas vegetais\n• Trigo: blends sem glúten + xantana\n• Açúcar: reduzir 10–20% ou adoçante culinário');
  }
  return { content: lines.join('\n'), recipes: [], suggestions: ['bolos sem ovo', 'pão sem glúten', 'vegana fácil'] };
}

function nutritionGeneralAnswer(q: string): AIResponse {
  const t = normalize(q);
  const blocks: string[] = [];

  if (/\bprote[ií]na|ganhar massa|hipertrof|m[úu]sculo/.test(t)) {
    blocks.push('Proteína: distribua 1.2–2.0 g/kg/dia ao longo do dia; inclua fontes magras e/ou vegetais (soja, leguminosas).');
  }
  if (/\bemagrec|déficit|deficit/.test(t)) {
    blocks.push('Emagrecimento: foque em déficit calórico sustentável, fibra (vegetais, integrais) e fontes magras de proteína para saciedade.');
  }
  if (/\bcarbo|energia|corrida|bike|treino/.test(t)) {
    blocks.push('Carboidratos: priorize integrais no dia a dia; para treino longo, use carbo de fácil digestão antes/durante; recupere com carbo + proteína.');
  }
  if (/\bgordur|colesterol|hdl|ldl/.test(t)) {
    blocks.push('Gorduras: prefira mono e poli-insaturadas (azeite, abacate, castanhas, peixes); limite gorduras trans e saturadas.');
  }
  if (/\bfibra|intest|saciedad/.test(t)) {
    blocks.push('Fibras: 25–35 g/dia; aumente gradualmente e hidrate bem. Boas fontes: feijões, aveia, frutas e verduras.');
  }
  if (blocks.length === 0) {
    blocks.push('Nutrição em geral: equilíbrio entre carboidratos, proteínas e gorduras; priorize alimentos minimamente processados, fibras e hidratação.');
  }

  blocks.push('\n⚠️ Esta orientação é educativa e **não substitui** acompanhamento profissional.');

  return { content: blocks.join('\n'), recipes: [], suggestions: ['rica em proteína 30 min', 'baixo carboidrato fácil'] };
}

function nutritionForRecipeAnswer(query: string, rows: RecipeRow[]): AIResponse {
  // tentativa simples: procurar uma receita pelo que o usuário digitou
  const t = normalize(query);
  const found = rows.find(r => normalize(r.title).includes(t)) || rows.find(r => t.includes(normalize(r.title)));

  if (!found) {
    return {
      content: 'Posso te passar informações nutricionais de uma receita específica do site. Me diga o **nome exato** (ou copie do card) 😉',
      recipes: [],
      suggestions: ['informações nutricionais do "Bolo de Banana Fit"'],
    };
  }

  const nf = found.nutrition_facts || {};
  const parts: string[] = [
    `**${found.title}** — informações nutricionais (por porção):`,
    `• Calorias: ${round1(nf.calories)} kcal`,
    `• Proteínas: ${round1(nf.protein)} g`,
    `• Carboidratos: ${round1(nf.carbs)} g`,
    `• Gorduras: ${round1(nf.fat)} g`,
    `• Fibras: ${round1(nf.fiber)} g`,
  ];
  parts.push('\nValores são estimativas e podem variar conforme porções e marcas. Para ajustes finos, consulte seu nutricionista.');

  return { content: parts.join('\n'), recipes: [], suggestions: [] };
}

// =============================================================================
// API pública: recomendação de receitas
// =============================================================================
export async function recommendRecipesFromText(query: string): Promise<AIResponse> {
  const f = parseQueryToFilters(query);
  const allRows = await fetchRecipesFromDB();
  const filtered = applyFilters(allRows, f);

  if (filtered.length === 0) {
    return {
      content:
        'Não encontrei receitas com esses critérios. Tente "vegana fácil", "rápida 4.5+" ou "sem glúten em 15 min".',
      recipes: [],
      suggestions: ['vegana fácil', 'baixo carboidrato rápido', 'rica em proteína 4.5+'],
    };
  }

  const bits: string[] = [];
  if (f.category) bits.push(f.category);
  if (f.difficulty) bits.push(f.difficulty === 'easy' ? 'fáceis' : f.difficulty === 'medium' ? 'médias' : 'difíceis');
  if (typeof f.maxPrep === 'number') bits.push(`até ${f.maxPrep} min`);
  if (typeof f.minPrep === 'number') bits.push(`mais de ${f.minPrep - 1} min`);
  if (typeof f.minRating === 'number') bits.push(`${f.minRating}+ ⭐`);

  const msg =
    filtered.length > 1
      ? `Encontrei ${filtered.length} receita(s)${bits.length ? ` (${bits.join(', ')})` : ''}.`
      : `Encontrei 1 receita${bits.length ? ` (${bits.join(', ')})` : ''}.`;

  return {
    content: msg,
    recipes: capAndMap(filtered, f.wantAll ? 100 : 12),
    suggestions: filtered.length < 5 ? ['receitas fáceis', 'receitas rápidas', 'receitas 5 ⭐'] : [],
  };
}

// =============================================================================
// Supabase: configurações / conversas / mensagens
// =============================================================================
export async function getAIConfiguration(nutritionistId: string): Promise<AIConfiguration | null> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .single();

  if (error && (error as any).code !== 'PGRST116') throw error;
  return data as AIConfiguration | null;
}

export async function createAIConfiguration(
  config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .insert([config])
    .select()
    .single();

  if (error) throw error;
  return data as AIConfiguration;
}

export async function updateAIConfiguration(
  configId: string,
  updates: Partial<AIConfiguration>
): Promise<AIConfiguration> {
  const { data, error } = await supabase
    .from('ai_configurations')
    .update(updates)
    .eq('id', configId)
    .select()
    .single();

  if (error) throw error;
  return data as AIConfiguration;
}

export async function createAIConversation(input: {
  client_id: string;
  nutritionist_id?: string | null;
  ai_config_id?: string | null;
  title?: string;
  is_active?: boolean;
}): Promise<AIConversation> {
  let payload: any = input;
  if (typeof input === 'string') {
    try { payload = JSON.parse(input); }
    catch { throw new Error('createAIConversation: payload inválido (string não é JSON)'); }
  }

  const row = {
    client_id: payload.client_id,
    nutritionist_id: payload.nutritionist_id ?? null,
    ai_config_id: payload.ai_config_id ?? null,
    title: payload.title ?? 'Nova conversa com IA',
    is_active: payload.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert([row])
    .select('*')
    .single();

  if (error) throw error;
  return data as AIConversation;
}

export async function getAIConversations(userId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('client_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AIConversation[];
}

export async function getAIMessages(conversationId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as AIMessage[];
}

export async function createAIMessage(message: Omit<AIMessage, 'id' | 'created_at' | 'updated_at'>): Promise<AIMessage> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert([message])
    .select()
    .single();

  if (error) throw error;
  return data as AIMessage;
}

// =============================================================================
// Orquestração principal — compatível com as duas assinaturas
// =============================================================================
// Antiga: processAIMessage(content: string, ...)
// Nova:   processAIMessage({ conversationId, content, senderId })
export async function processAIMessage(
  arg1: any,
  _arg2?: any,
  _arg3?: any
): Promise<AIResponse> {
  let content = '';
  if (typeof arg1 === 'string') content = arg1;
  else if (arg1 && typeof arg1 === 'object' && 'content' in arg1) content = toSafeString(arg1.content);

  const intent = detectIntent(content);

  switch (intent) {
    case 'recipe_search':
      return recommendRecipesFromText(content);

    case 'nutrition_recipe': {
      const rows = await fetchRecipesFromDB();
      return nutritionForRecipeAnswer(content, rows);
    }

    case 'nutrition_general':
      return nutritionGeneralAnswer(content);

    case 'cooking_tips':
      return cookingTipsAnswer(content);

    case 'substitutions':
      return substitutionsAnswer(content);

    case 'site_info':
      return siteInfoAnswer();

    case 'greetings':
      return greetingsAnswer();

    case 'thanks':
      return thanksAnswer();

    case 'help':
      return helpAnswer();

    case 'fallback':
    default: {
      // fallback educado + incentivo de filtros naturais
      const rows = await fetchRecipesFromDB();
      const hint = rows.length
        ? 'Você pode pedir por **categoria**, **dificuldade**, **tempo** e **avaliação**. Ex.: "vegana fácil 15 min 4.5+"'
        : 'Posso te ajudar com dúvidas de nutrição e dicas de cozinha.';
      return {
        content: `Entendi! ${hint}`,
        recipes: [],
        suggestions: ['vegana fácil', 'sem glúten 30 min', 'rica em proteína 5⭐'],
      };
    }
  }
}
