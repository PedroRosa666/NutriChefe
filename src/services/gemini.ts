// A Mentoria IA roda na Edge Function `ai-chat`: a chave do Gemini fica no servidor,
// que também confere o acesso Premium, o limite de mensagens por hora e busca as receitas.
import type { MealSlot, PlanMeal } from './care';
import { supabase } from '../lib/supabase';
import type { AIConfiguration, AIMessage, AIResponse } from '../types/ai';

/** Dados do próprio usuário usados para personalizar as respostas. */
export interface AIUserContext {
  name?: string;
  goal?: string;
  allergies?: string[];
  dietaryPreferences?: string[];
  dailyGoals?: Record<string, number>;
  todayTotals?: Record<string, number>;
}

const HISTORY_LENGTH = 10;

// Fica falso quando o servidor avisa que não há chave configurada (modo limitado).
let configured = true;

export type AssistResult =
  | { ok: true; response: AIResponse }
  // limited: sem chave no servidor ou falha de rede, o app usa a busca local.
  | { ok: false; code: string; message?: string; limited: boolean };

interface AssistReply {
  ok: boolean;
  content?: string;
  recipes?: AIResponse['recipes'];
  suggestions?: string[];
  meta?: Record<string, unknown>;
  error?: string;
  code?: string;
  limited?: boolean;
}

// As respostas antigas mostraram receitas em cartões que não fazem parte do texto:
// os títulos vão junto no histórico para a IA entender "a primeira", "essa", etc.
function historyEntry(m: AIMessage) {
  const titles = m.sender_type === 'ai' ? (m.metadata?.recipes ?? []).map((r) => r.title) : [];
  return {
    sender_type: m.sender_type,
    content: titles.length ? `${m.content}\n[Receitas mostradas: ${titles.join('; ')}]` : m.content,
  };
}

export async function assistAI(
  message: string,
  history: AIMessage[],
  aiConfig?: AIConfiguration,
  context?: AIUserContext
): Promise<AssistResult> {
  try {
    const { data, error } = await supabase.functions.invoke<AssistReply>('ai-chat', {
      body: {
        action: 'assist',
        message,
        history: history.slice(-HISTORY_LENGTH).map(historyEntry),
        aiConfig: aiConfig
          ? { ai_name: aiConfig.ai_name, personality: aiConfig.personality, custom_instructions: aiConfig.custom_instructions }
          : undefined,
        context,
      },
    });
    if (error && !data) throw error;
    if (data?.ok && data.content) {
      configured = true;
      return {
        ok: true,
        response: { content: data.content, recipes: data.recipes ?? [], suggestions: data.suggestions ?? [], meta: data.meta },
      };
    }
    if (data?.limited) configured = false;
    const code = data?.code ?? 'error';
    // Só limite, acesso e login são respostas finais; o resto (sem chave, erro, função
    // desatualizada) cai na busca local para a pessoa não ficar sem receitas.
    const final = code === 'rate_limited' || code === 'forbidden' || code === 'unauthenticated';
    return { ok: false, code, message: data?.error, limited: !final };
  } catch (error) {
    console.warn('Mentoria IA indisponível, usando a busca local:', error);
    return { ok: false, code: 'network', limited: true };
  }
}

/** Falso depois que o servidor informa que a chave do Gemini não está configurada. */
export function isGeminiConfigured(): boolean {
  return configured;
}

export interface PhotoEstimate {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: 'low' | 'medium' | 'high';
}

/** Reduz a foto para no máximo 1024 px (JPEG) antes de enviar: menos dados, resposta mais rápida. */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
}

/** Estimativa de calorias e macros de um prato pela foto (Mentoria IA). */
export async function estimateFoodPhoto(file: File): Promise<PhotoEstimate> {
  const image = await shrinkPhoto(file);
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; estimate?: PhotoEstimate; code?: string; error?: string }>(
    'ai-chat',
    { body: { action: 'photo', image, mimeType: 'image/jpeg' } }
  );
  if (error && !data) throw error;
  if (!data?.ok || !data.estimate) throw new Error(data?.error ?? data?.code ?? 'photo_failed');
  return data.estimate;
}

export interface AIPlanItem {
  day: number;
  meal_id: string;
  recipe_id: string | null;
  servings: number;
  food_id: string | null;
  grams: number | null;
  note: string;
}

/** Item como a função devolve: com o bloco (meal_id) ou, na versão anterior dela, só a categoria. */
type RawAIPlanItem = Omit<AIPlanItem, 'meal_id'> & { meal_id?: string; meal?: MealSlot };

/**
 * Plano da semana montado pela IA nos blocos de refeição do plano (Premium Nutricionista ou o próprio
 * plano do cliente Premium). Só rascunho: quem pediu revisa antes de salvar. Itens fora dos blocos e
 * dos dias de cada um não entram (`dropped` diz quantos).
 */
export async function generatePlanWithAI(
  clientId: string,
  notes: string,
  dailyCalories: number,
  meals: PlanMeal[]
): Promise<{ items: AIPlanItem[]; summary: string; dropped: number }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; items?: RawAIPlanItem[]; summary?: string; code?: string; error?: string }>(
    'ai-chat',
    {
      body: {
        action: 'plan',
        client_id: clientId,
        notes,
        dailyCalories,
        meals: meals.map((m) => ({ id: m.id, name: m.name, category: m.category, days: m.days, share: m.kcalShare })),
      },
    }
  );
  if (error && !data) throw error;
  if (!data?.ok || !data.items) throw new Error(data?.error ?? data?.code ?? 'plan_failed');
  const items: AIPlanItem[] = [];
  let dropped = 0;
  for (const raw of data.items) {
    const { meal, meal_id, ...rest } = raw;
    const block = meal_id
      ? meals.find((m) => m.id === meal_id && m.days.includes(raw.day))
      : meals.find((m) => m.category === meal && m.days.includes(raw.day));
    if (block) items.push({ ...rest, meal_id: block.id });
    else dropped++;
  }
  return { items, summary: data.summary ?? '', dropped };
}
