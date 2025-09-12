// src/store/ai-rag.ts
import * as aiService from '../services/ai'; // usa seu serviço já existente p/ criar mensagens
import { answerQuestionWithSiteData } from '../services/ai_rag';

/**
 * Envia uma mensagem do usuário e cria a resposta do assistente
 * baseada SOMENTE no conteúdo do site/banco (RAG simples).
 *
 * Use esta função no lugar do envio "puro" para o Gemini.
 */
export async function sendMessageWithRAG(params: {
  conversationId: string;
  content: string;
  senderId: string; // id do usuário logado
}) {
  const { conversationId, content, senderId } = params;

  // 1) registra a mensagem do usuário
  await aiService.createAIMessage({
    conversation_id: conversationId,
    sender_id: senderId,
    sender_type: 'user',
    content
  });

  // 2) responde usando dados do site
  const result = await answerQuestionWithSiteData(content);

  // 3) registra a resposta do assistente
  await aiService.createAIMessage({
    conversation_id: conversationId,
    sender_id: 'assistant',
    sender_type: 'assistant',
    content: result.text
  });

  // (Opcional) Retorna os dados para a UI usar (ex.: cards com receitas)
  return result;
}
