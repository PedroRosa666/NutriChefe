import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('VITE_GEMINI_API_KEY não configurada');
}
export async function callGeminiAPI(prompt: string): Promise<string> {
  if (!genAI) {
    throw new Error('Chave da API do Gemini não configurada');
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new Error('Resposta da IA está vazia');
    }
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
    return text.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        throw new Error('Chave da API do Gemini inválida ou expirada');
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error('Limite de uso da API do Gemini excedido');
      }
      throw error;
    }
    
    throw new Error('Erro inesperado ao comunicar com a IA');
  }
}