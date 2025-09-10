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
// A interface de resposta permanece a mesma.
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
  conversationHistory: AIMessage[] = [] // Definimos um valor padrão
): Promise<GeminiResponse> {
  try {
    // 1. CONSTRUÇÃO DAS INSTRUÇÕES DO SISTEMA (SYSTEM PROMPT)
    // Movido para uma função auxiliar para manter a função principal mais limpa.
    const systemInstruction = buildSystemInstruction(aiConfig);
    
    // 2. FORMATAÇÃO DO HISTÓRICO DA CONVERSA
    // O histórico agora é formatado para o padrão da API de chat.
    const history = formatConversationHistory(conversationHistory, aiConfig);

    // 3. INICIALIZAÇÃO DO MODELO E DO CHAT
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: {
        role: "system", // Opcional, mas bom para clareza
        parts: [{ text: systemInstruction }],
      },
      // Configurações de segurança para evitar respostas indesejadas.
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    const chat = model.startChat({ history });

    // 4. ENVIO DA MENSAGEM E RECEBIMENTO DA RESPOSTA
    const result = await chat.sendMessage(userPrompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text.trim()
    };

  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    
    // O seu tratamento de erros já é muito bom!
    // Mantive a lógica, pois ela é clara e útil para o usuário.
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
 * @param aiConfig A configuração da IA.
 * @returns Uma string com as instruções completas.
 */
function buildSystemInstruction(aiConfig?: AIConfiguration): string {
  // Usamos um array e o método join() para construir a string, que é mais limpo que concatenação.
  const instructions = [
    `Você é ${aiConfig?.ai_name || 'NutriBot'}, uma IA especializada em nutrição e alimentação saudável.`,
    `Personalidade: ${getPersonalityPrompt(aiConfig?.personality as Personality || 'empathetic')}`,
    aiConfig?.custom_instructions ? `Instruções específicas: ${aiConfig.custom_instructions}` : '',
    'Regras importantes:',
    '1. Sempre lembre o cliente de consultar seu nutricionista para planos alimentares personalizados.',
    '2. Não faça diagnósticos médicos.',
    '3. Seja útil e prestativo.',
    '4. Mantenha o foco em alimentação saudável e bem-estar.',
    '5. Responda em português brasileiro.',
    '6. Use uma linguagem clara e acessível.',
    '7. Seja breve, resuma as mensagens antes de enviar.'
  ];

  return instructions.filter(Boolean).join('\n'); // .filter(Boolean) remove linhas vazias.
}

/**
 * Retorna a descrição da personalidade da IA.
 * @param personality O tipo de personalidade.
 * @returns A string de prompt para a personalidade.
 */
function getPersonalityPrompt(personality: Personality): string {
  // Usamos um Record para dar um tipo explícito ao nosso objeto de prompts.
  const personalityPrompts: Record<Personality, string> = {
    empathetic: 'Você é empática e motivacional. Sempre demonstre compreensão e ofereça encorajamento. Use um tom caloroso e acolhedor.',
    scientific: 'Você é focada em dados científicos e evidências. Base suas respostas em fatos nutricionais e pesquisas. Use um tom técnico mas acessível.',
    friendly: 'Você é amigável e casual. Use um tom descontraído e próximo, como se fosse uma amiga dando conselhos.',
    professional: 'Você é profissional e formal. Mantenha um tom respeitoso e técnico, como um profissional de saúde.'
  };

  return personalityPrompts[personality] || personalityPrompts.empathetic;
}

/**
 * Formata o histórico da conversa para o formato esperado pela API do Gemini.
 * @param history O histórico no formato da sua aplicação.
 * @param aiConfig A configuração da IA.
 * @returns Um array de `Content` para a API.
 */
function formatConversationHistory(history: AIMessage[], aiConfig?: AIConfiguration): Content[] {
  return history
    .slice(-CONVERSATION_HISTORY_LENGTH)
    .map(msg => ({
      // Mapeia o 'sender_type' para o 'role' esperado pela API ('user' ou 'model').
      role: msg.sender_type === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
}

/**
 * Função auxiliar para validar se a API key está configurada.
 * A sua implementação já está ótima, apenas verificando a constante.
 * @returns `true` se a chave estiver configurada.
 */
export function isGeminiConfigured(): boolean {
  return !!apiKey && apiKey !== 'your-api-key-here';
}