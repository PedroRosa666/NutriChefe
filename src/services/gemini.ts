import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIConfiguration, AIMessage } from '../types/ai';

// Inicializar o cliente Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyCNnsAYj6b91FFMrcunLlrRtWVohnS9JQE');

export interface GeminiResponse {
  content: string;
  error?: string;
}

export async function getGeminiResponse(
  userPrompt: string,
  aiConfig?: AIConfiguration,
  conversationHistory?: AIMessage[]
): Promise<GeminiResponse> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Construir o contexto da conversa
    let systemPrompt = `Você é ${aiConfig?.ai_name || 'NutriBot'}, uma IA especializada em nutrição e alimentação saudável.

Personalidade: ${getPersonalityPrompt(aiConfig?.personality || 'empathetic')}

${aiConfig?.custom_instructions ? `Instruções específicas: ${aiConfig.custom_instructions}` : ''}

Regras importantes:
1. Sempre lembre o cliente de consultar seu nutricionista para planos alimentares personalizados
2. Não faça diagnósticos médicos
3. Seja útil e prestativo
4. Mantenha o foco em alimentação saudável e bem-estar
5. Responda em português brasileiro
6. Use uma linguagem clara e acessível

`;

    // Adicionar histórico da conversa se disponível
    if (conversationHistory && conversationHistory.length > 0) {
      systemPrompt += `\nHistórico da conversa:\n`;
      conversationHistory.slice(-5).forEach(msg => {
        const sender = msg.sender_type === 'user' ? 'Cliente' : aiConfig?.ai_name || 'NutriBot';
        systemPrompt += `${sender}: ${msg.content}\n`;
      });
    }

    systemPrompt += `\nResponda à seguinte mensagem do cliente:`;

    // Combinar o prompt do sistema com a mensagem do usuário
    const fullPrompt = `${systemPrompt}\n\nCliente: ${userPrompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return {
      content: text.trim()
    };

  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    
    let errorMessage = "Desculpe, ocorreu um erro ao tentar processar sua solicitação. Tente novamente em alguns instantes.";
    
    // Tratar diferentes tipos de erro
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

function getPersonalityPrompt(personality: string): string {
  const personalityPrompts = {
    empathetic: 'Você é empática e motivacional. Sempre demonstre compreensão e ofereça encorajamento. Use um tom caloroso e acolhedor.',
    scientific: 'Você é focada em dados científicos e evidências. Base suas respostas em fatos nutricionais e pesquisas. Use um tom técnico mas acessível.',
    friendly: 'Você é amigável e casual. Use um tom descontraído e próximo, como se fosse uma amiga dando conselhos.',
    professional: 'Você é profissional e formal. Mantenha um tom respeitoso e técnico, como um profissional de saúde.'
  };

  return personalityPrompts[personality as keyof typeof personalityPrompts] || personalityPrompts.empathetic;
}

// Função auxiliar para validar se a API key está configurada
export function isGeminiConfigured(): boolean {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  return !!apiKey && apiKey !== 'your-api-key-here';
}