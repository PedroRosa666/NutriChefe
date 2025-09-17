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
  return `
Você é ${aiConfig?.ai_name || 'NutriBot'}, um assistente virtual do site NutriChefe.

Seu papel:
- Responder a QUALQUER pergunta do usuário (pode ser sobre receitas, nutrição, dicas de saúde, curiosidades, ou até perguntas gerais como "que dia é hoje?").
- Quando a pergunta for sobre receitas (fácil, difícil, vegana, etc.), o sistema interno aplicará filtros para trazer a lista — você pode responder curto e convidar o usuário a refinar.
- Se não for sobre receitas, converse normalmente e dê respostas claras e interessantes.

Estilo:
- Fale como uma pessoa real: simpática, acolhedora, mas objetiva.
- Prefira respostas curtas, com parágrafos ou listas quando ajudar.
- Se não entender algo, peça para o usuário explicar de forma simples.
- Use português brasileiro, a menos que o usuário fale em outro idioma.

Regras:
1. Não faça diagnósticos médicos — apenas dicas gerais.
2. Para dúvidas nutricionais, dê orientações educativas e sugira procurar um nutricionista para planos individuais.
3. Se perguntarem data ou hora, use o contexto atual: hoje é ${new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}.
  `.trim();
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
