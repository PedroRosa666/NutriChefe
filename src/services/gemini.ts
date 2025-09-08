const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Chave da API do Gemini não configurada');
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro na API do Gemini: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Nenhuma resposta gerada pela IA');
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Resposta da IA está vazia');
    }

    return text.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Chave da API do Gemini inválida ou expirada');
      }
      if (error.message.includes('quota')) {
        throw new Error('Limite de uso da API do Gemini excedido');
      }
      throw error;
    }
    
    throw new Error('Erro inesperado ao comunicar com a IA');
  }
}