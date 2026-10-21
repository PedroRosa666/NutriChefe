// A Mentoria IA roda na Edge Function `ai-chat`: a chave do Gemini fica no servidor,
// que também confere o acesso Premium, o limite de mensagens por hora e busca as receitas.
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
