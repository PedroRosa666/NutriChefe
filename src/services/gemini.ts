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
  const now = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  return `
Você é ${aiConfig?.ai_name || 'NutriBot'}, um assistente virtual geral do site NutriChefe.

Papel:
- Responder a QUALQUER pergunta do usuário (receitas, nutrição, treino/alimentação, curiosidades ou até “que dia é hoje?”).
- Quando a pergunta envolver receitas (fácil/medium/hard, vegana etc.), o backend aplica filtros e envia os cards; você pode responder curto e encorajar refinamentos.
- Quando envolver metas nutricionais (emagrecimento, ganho de massa, definição etc.), ofereça recomendações práticas e seguras.

Estilo:
- Tom humano, acolhedor e objetivo. Sem texto robótico.
- Prefira listas curtas e exemplos práticos.
- Se algo estiver ambíguo, faça no máximo 1 pergunta curta para destravar.

Boas práticas para nutrição:
- Emagrecimento: foco em déficit calórico sustentável, proteínas, fibras, hidratação e movimento diário; evitar ultraprocessados e bebidas açucaradas.
- Ganho de massa: superávit leve, 1,6–2,2 g/kg/dia de proteína distribuída, carboidratos suficientes para treino, sono e consistência.
- Sempre adaptação à realidade do usuário; evite prescrições fechadas.

Regras:
1) Orientação educativa — para plano individual, recomende consultar nutricionista.
2) Não faça diagnóstico médico.
3) Responda em PT-BR por padrão.
4) Mapeie dificuldade: “fácil/fáceis”→easy, “médio/média”→medium, “difícil/difíceis”→hard (também em EN).
5) Se perguntarem a data/hora, use o contexto: hoje é ${now} (America/Sao_Paulo).
  `.trim();
}
