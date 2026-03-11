// Importações necessárias
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from '@google/generative-ai';
import type { AIConfiguration, AIMessage } from '../types/ai';

// --- CONFIGURAÇÕES CENTRALIZADAS ---
// Centralizar as configurações torna o código mais fácil de manter.
const MODEL_NAME = "gemini-2.5-flash";
const CONVERSATION_HISTORY_LENGTH = 10; // Aumentei um pouco, mas pode ser ajustado.

// --- INICIALIZAÇÃO SEGURA ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

if (apiKey && apiKey !== 'your-api-key-here') {
  genAI = new GoogleGenerativeAI(apiKey);
}

// --- TIPOS E INTERFACES ---
export interface GeminiResponse {
  content: string;
  error?: string;
}

// Criamos um tipo para as personalidades, garantindo que apenas valores válidos sejam usados.
type Personality = 'empathetic' | 'scientific' | 'friendly' | 'professional';

const DEFAULT_RESPONSE = 'Oi! Como posso te ajudar hoje? Posso sugerir receitas por dificuldade (easy/medium/hard), tempo (ex.: até 30 min) e avaliação (ex.: 4.5+ ⭐).';

async function callGeminiWithRetry(
  chat: any,
  userPrompt: string,
  maxRetries = 1
): Promise<string> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await chat.sendMessage(userPrompt);
      const text = (result.response?.text?.() || '').trim();
      return text || DEFAULT_RESPONSE;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function getGeminiResponse(
  userPrompt: string,
  aiConfig?: AIConfiguration,
  conversationHistory: AIMessage[] = []
): Promise<GeminiResponse> {
  try {
    if (!genAI) {
      return { content: DEFAULT_RESPONSE };
    }

    const systemInstruction = buildSystemInstruction(aiConfig);
    const history = formatConversationHistory(conversationHistory, aiConfig);

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
    const text = await callGeminiWithRetry(chat, userPrompt);
    return { content: text };

  } catch (error) {
    console.warn("Aviso ao chamar Gemini (usando fallback):", error);
    return { content: DEFAULT_RESPONSE };
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

export interface IngredientAnalysis {
  requestedIngredients: string[];
  normalizedIngredients: string[];
  substitutes: string[];
  culinaryCategory: string;
  searchTerms: string[];
  notFound: boolean;
}

export async function analyzeIngredientRequest(userMessage: string): Promise<IngredientAnalysis> {
  const fallback: IngredientAnalysis = {
    requestedIngredients: [],
    normalizedIngredients: [],
    substitutes: [],
    culinaryCategory: '',
    searchTerms: [],
    notFound: false,
  };

  try {
    if (!genAI) return fallback;

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Analise esta mensagem de um usuário buscando receitas: "${userMessage}"

Retorne APENAS um JSON válido (sem markdown, sem blocos de código) com este formato exato:
{
  "requestedIngredients": ["ingrediente1", "ingrediente2"],
  "normalizedIngredients": ["versão normalizada em português minúsculo"],
  "substitutes": ["substituto1", "substituto2", "substituto3"],
  "culinaryCategory": "categoria culinária principal (ex: frutas, carnes, legumes, grãos, laticínios, frutos do mar)",
  "searchTerms": ["termo1", "termo2", "termo3"]
}

Regras:
- requestedIngredients: ingredientes exatamente como o usuário mencionou
- normalizedIngredients: os mesmos ingredientes em português, sem acentos, singular, minúsculos
- substitutes: 3-5 ingredientes similares/substitutos que poderiam aparecer em receitas parecidas
- culinaryCategory: categoria geral do ingrediente principal
- searchTerms: todos os termos de busca úteis (inclui variações, sinônimos, preparações comuns com este ingrediente)

Se não houver ingrediente específico na mensagem, retorne listas vazias.`;

    const result = await model.generateContent(prompt);
    const text = (result.response?.text?.() || '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      requestedIngredients: Array.isArray(parsed.requestedIngredients) ? parsed.requestedIngredients : [],
      normalizedIngredients: Array.isArray(parsed.normalizedIngredients) ? parsed.normalizedIngredients : [],
      substitutes: Array.isArray(parsed.substitutes) ? parsed.substitutes : [],
      culinaryCategory: typeof parsed.culinaryCategory === 'string' ? parsed.culinaryCategory : '',
      searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [],
      notFound: false,
    };
  } catch {
    return fallback;
  }
}

/**
 * Checagem simples de configuração da API
 */
export function isGeminiConfigured(): boolean {
  return !!apiKey && apiKey !== 'your-api-key-here';
}
