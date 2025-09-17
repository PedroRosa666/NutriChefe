// Importações necessárias
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from '@google/generative-ai';
import type { AIConfiguration, AIMessage } from '../types/ai';

// --- CONFIGURAÇÕES CENTRALIZADAS ---
// Centralizar as configurações torna o código mais fácil de manter.
const MODEL_NAME = "gemini-2.5-flash";
const CONVERSATION_HISTORY_LENGTH = 10; // Aumentei um pouco, mas pode ser ajustado.

// --- INICIALIZAÇÃO SEGURA ---
// Acessa a chave da API de forma segura.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  // Lança um erro se a chave não estiver configurada.
  // Isso evita que o app tente funcionar com uma configuração inválida.
  throw new Error("VITE_GEMINI_API_KEY não está definida no seu arquivo .env");
}
const genAI = new GoogleGenerativeAI(apiKey);

// --- TIPOS E INTERFACES ---
export interface GeminiResponse {
  content: string;
  error?: string;
}

// Criamos um tipo para as personalidades, garantindo que apenas valores válidos sejam usados.
type Personality = 'empathetic' | 'scientific' | 'friendly' | 'professional';

// --- FUNÇÃO PRINCIPAL ---
export async function getGeminiResponse(
  userPrompt: string,
  aiConfig?: AIConfiguration,
  conversationHistory: AIMessage[] = []
): Promise<GeminiResponse> {
  try {
    // 1) SYSTEM PROMPT mais humano e útil
    const systemInstruction = buildSystemInstruction(aiConfig);

    // 2) HISTÓRICO
    const history = formatConversationHistory(conversationHistory, aiConfig);

    // 3) MODELO + chat
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const chat = model.startChat({ history });

    // 4) RESPOSTA
    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const text = (response?.text?.() || '').trim();

    // Fallback simpático caso algo venha vazio
    return {
      content: text || 'Oi! Como posso te ajudar hoje? Posso sugerir receitas por dificuldade (easy/medium/hard), tempo (ex.: até 30 min) e avaliação (ex.: 4.5+ ⭐).'
    };

  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    let errorMessage = "Desculpe, ocorreu um erro ao tentar processar sua solicitação. Tente novamente em alguns instantes.";

    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        errorMessage = "Erro de configuração da IA. Entre em contato com o suporte.";
      } else if (error.message.includes('quota')) {
        errorMessage = "Limite de uso da IA atingido. Tente novamente mais tarde.";
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
      }
    }

    return {
      content: errorMessage,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// --- FUNÇÕES AUXILIARES ---

/**
 * Constrói a instrução do sistema com base na configuração da IA.
 * Reforça conversa natural, follow-up curto e mapeamento de dificuldades.
 */
function buildSystemInstruction(aiConfig?: AIConfiguration): string {
  const instructions = [
    `Você é ${aiConfig?.ai_name || 'NutriBot'}, uma IA especializada em nutrição e alimentação saudável para o site NutriChefe.`,
    `Personalidade: ${getPersonalityPrompt(aiConfig?.personality as Personality || 'empathetic')}`,
    aiConfig?.custom_instructions ? `Instruções específicas: ${aiConfig.custom_instructions}` : '',
    '',
    'Estilo de conversa:',
    '- Fale como uma pessoa real, acolhedora e direta (sem soar robótico).',
    '- Use listas curtas quando ajudar; evite blocos longos.',
    '- Se a intenção não estiver clara, faça no máximo **1 pergunta curta** para destravar a conversa.',
    '- Convide o usuário a refinar: tempo (ex.: ≤ 30 min), avaliação (ex.: ⭐≥4.5), dificuldade (easy/medium/hard) e ingredientes.',
    '',
    'Regras importantes:',
    '1) Sempre lembre que orientações são educativas — para plano individual, consulte um nutricionista.',
    '2) Não faça diagnósticos médicos.',
    '3) Responda em português brasileiro, com linguagem simples.',
    '4) Seja objetivo: vá direto ao ponto sem perder a simpatia.',
    '5) Quando o usuário disser "difícil/dificeis", interprete como **hard**; "médio/média" → **medium**; "fácil/fáceis" → **easy**.',
    '6) Em inglês, "hard/difficult", "medium", "easy" mapeiam para os mesmos níveis.',
  ];

  return instructions.filter(Boolean).join('\n');
}

/**
 * Retorna a descrição da personalidade da IA.
 */
function getPersonalityPrompt(personality: Personality): string {
  const personalityPrompts: Record<Personality, string> = {
    empathetic: 'Você é empática e motivacional. Demonstre compreensão e ofereça encorajamento. Tom caloroso e acolhedor.',
    scientific: 'Você é focada em dados e evidências. Baseie respostas em fatos e pesquisas. Tom técnico porém acessível.',
    friendly: 'Você é amigável e casual. Tom descontraído e próximo, como uma amiga dando conselhos.',
    professional: 'Você é profissional e objetiva. Tom respeitoso e técnico, como um profissional de saúde.',
  };
  return personalityPrompts[personality] || personalityPrompts.empathetic;
}

/**
 * Formata o histórico da conversa para o formato esperado pela API do Gemini.
 */
function formatConversationHistory(history: AIMessage[], _aiConfig?: AIConfiguration): Content[] {
  return history
    .slice(-CONVERSATION_HISTORY_LENGTH)
    .map(msg => ({
      // A API espera 'user' ou 'model'
      role: msg.sender_type === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
}

/**
 * Checagem simples de configuração da API
 */
export function isGeminiConfigured(): boolean {
  return !!apiKey && apiKey !== 'your-api-key-here';
}
