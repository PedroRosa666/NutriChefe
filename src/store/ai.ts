import { create } from 'zustand';
import * as aiService from '../services/ai';
import { useToastStore } from './toast';
import type { AIConfiguration, AIConversation, AIMessage } from '../types/ai';
import type { AIUserContext } from '../services/gemini';
import { feedback } from '../lib/i18n/current';

interface AIState {
  // Configurações
  aiConfig: AIConfiguration | null;
  
  // Conversas
  conversations: AIConversation[];
  currentConversation: AIConversation | null;
  messages: AIMessage[];
  
  // Estados
  loading: boolean;
  loadingConversations: boolean;
  sendingMessage: boolean;
  error: string | null;

  // Ações para configuração
  fetchAIConfiguration: (nutritionistId: string) => Promise<void>;
  updateAIConfiguration: (configId: string, updates: Partial<AIConfiguration>) => Promise<void>;
  createAIConfiguration: (config: Omit<AIConfiguration, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;

  // Ações para conversas
  fetchConversations: (userId: string) => Promise<void>;
  createConversation: (clientId: string, nutritionistId?: string) => Promise<AIConversation>;
  setCurrentConversation: (conversation: AIConversation | null) => void;
  archiveConversation: (conversationId: string) => Promise<void>;
  archiveAllConversations: (userId: string) => Promise<void>;

  // Ações para mensagens
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, context?: AIUserContext) => Promise<void>;
  
  // Utilitários
  clearError: () => void;
  reset: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  // Estado inicial
  aiConfig: null,
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  loadingConversations: false,
  sendingMessage: false,
  error: null,

  // Configurações da IA
  fetchAIConfiguration: async (nutritionistId: string) => {
    set({ loading: true, error: null });
    try {
      const config = await aiService.getAIConfiguration(nutritionistId);
      set({ aiConfig: config, loading: false });
    } catch (error) {
      console.error('Error fetching AI configuration:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().ai.loadConfigError;
      set({ error: errorMessage, loading: false });
    }
  },

  createAIConfiguration: async (config) => {
    set({ loading: true, error: null });
    try {
      const newConfig = await aiService.createAIConfiguration(config);
      set({ aiConfig: newConfig, loading: false });
      useToastStore.getState().showToast(feedback().ai.configCreated, 'success');
    } catch (error) {
      console.error('Error creating AI configuration:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().ai.createConfigError;
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast(feedback().ai.createConfigError, 'error');
      throw error;
    }
  },

  updateAIConfiguration: async (configId: string, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedConfig = await aiService.updateAIConfiguration(configId, updates);
      set({ aiConfig: updatedConfig, loading: false });
      useToastStore.getState().showToast(feedback().ai.configUpdated, 'success');
    } catch (error) {
      console.error('Error updating AI configuration:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().ai.updateConfigError;
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast(feedback().ai.updateConfigError, 'error');
      throw error;
    }
  },

  // Conversas
  fetchConversations: async (userId: string) => {
    set({ loadingConversations: true, error: null });
    try {
      const conversations = await aiService.getAIConversations(userId);
      set({ conversations, loadingConversations: false });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().ai.loadConversationsError;
      set({ error: errorMessage, loadingConversations: false });
    }
  },

  createConversation: async (clientId: string, nutritionistId?: string) => {
    set({ loading: true, error: null });
    try {
      // Buscar configuração da IA do nutricionista se fornecido
      let aiConfigId = null;
      if (nutritionistId) {
        const config = await aiService.getAIConfiguration(nutritionistId);
        aiConfigId = config?.id || null;
      }

      const conversation = await aiService.createAIConversation({
        client_id: clientId,
        nutritionist_id: nutritionistId,
        ai_config_id: aiConfigId,
        title: 'Nova conversa',
        is_active: true
      });

      // Conversa nova não tem mensagens: não buscamos nada (antes um fetch tardio
      // podia apagar a primeira mensagem enviada logo em seguida).
      set(state => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
        messages: [],
        loading: false
      }));

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().ai.createConversationError;
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast(feedback().ai.createConversationError, 'error');
      throw error;
    }
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation, messages: [] });
    if (conversation) {
      get().fetchMessages(conversation.id);
    }
  },

  archiveConversation: async (conversationId: string) => {
    const previous = get().conversations;
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== conversationId),
      ...(state.currentConversation?.id === conversationId ? { currentConversation: null, messages: [] } : {}),
    }));
    try {
      await aiService.updateAIConversation(conversationId, { is_active: false });
    } catch (error) {
      console.error('Error archiving conversation:', error);
      set({ conversations: previous });
      useToastStore.getState().showToast(feedback().ai.deleteConversationError, 'error');
    }
  },

  archiveAllConversations: async (userId: string) => {
    const previous = get().conversations;
    set({ conversations: [], currentConversation: null, messages: [] });
    try {
      await aiService.archiveAllAIConversations(userId);
    } catch (error) {
      console.error('Error archiving conversations:', error);
      set({ conversations: previous });
      useToastStore.getState().showToast(feedback().ai.clearHistoryError, 'error');
    }
  },

  // Mensagens
  fetchMessages: async (conversationId: string) => {
    set({ loading: true, error: null });
    try {
      const messages = await aiService.getAIMessages(conversationId);
      // Ignora a resposta se o usuário já trocou de conversa.
      if (get().currentConversation?.id !== conversationId) return;
      set({ messages, loading: false });
    } catch (error) {
      console.error('Error fetching messages:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().ai.loadMessagesError;
      set({ error: errorMessage, loading: false });
    }
  },

  sendMessage: async (conversationId: string, content: string, context?: AIUserContext) => {
    const { currentConversation, sendingMessage } = get();
    if (!currentConversation || sendingMessage) return;

    const isCurrent = () => get().currentConversation?.id === conversationId;
    set({ sendingMessage: true, error: null });

    try {
      const isFirstMessage = get().messages.length === 0;
      const userMessage = await aiService.createAIMessage({
        conversation_id: conversationId,
        sender_type: 'user',
        content,
        metadata: {}
      });

      if (isCurrent()) {
        set(state => ({ messages: [...state.messages, userMessage] }));
      }

      let aiResponse;
      try {
        aiResponse = await aiService.processAIMessage(
          content,
          get().aiConfig || undefined,
          isCurrent() ? get().messages : [userMessage],
          context
        );
      } catch (processError) {
        console.warn('Erro ao processar mensagem, usando fallback:', processError);
        aiResponse = {
          content: feedback().ai.processError,
          recipes: [],
          suggestions: [...feedback().ai.fallbackSuggestions],
        };
      }

      const aiMessage = await aiService.createAIMessage({
        conversation_id: conversationId,
        sender_type: 'ai',
        content: aiResponse.content || feedback().ai.emptyReply,
        metadata: {
          recipes: aiResponse.recipes || [],
          suggestions: aiResponse.suggestions || [],
          ...(aiResponse.meta ? { meta: aiResponse.meta } : {})
        }
      });

      // A 1ª pergunta vira o título da conversa (aparece no histórico).
      const updates: Partial<AIConversation> = { last_message_at: new Date().toISOString() };
      if (isFirstMessage) updates.title = content.length > 60 ? `${content.slice(0, 57)}...` : content;
      aiService.updateAIConversation(conversationId, updates).catch(e => console.warn('Conversation update failed:', e));

      set(state => ({
        conversations: [
          ...state.conversations.filter(c => c.id === conversationId).map(c => ({ ...c, ...updates })),
          ...state.conversations.filter(c => c.id !== conversationId),
        ],
        currentConversation: state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, ...updates }
          : state.currentConversation,
        messages: state.currentConversation?.id === conversationId ? [...state.messages, aiMessage] : state.messages,
        sendingMessage: false
      }));
    } catch (error) {
      console.error('Erro crítico ao enviar mensagem:', error);
      set({ sendingMessage: false });
      const errorMsg = error instanceof Error && error.message
        ? error.message
        : feedback().ai.sendError;
      useToastStore.getState().showToast(errorMsg, 'error');
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  
  reset: () => set({
    aiConfig: null,
    conversations: [],
    currentConversation: null,
    messages: [],
    loading: false,
    loadingConversations: false,
    sendingMessage: false,
    error: null
  })
}));