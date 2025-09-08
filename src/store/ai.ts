import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import * as aiService from '../services/ai';
import { useToastStore } from './toast';
import type { AIConfiguration, AIConversation, AIMessage, AIResponse } from '../types/ai';

interface AIState {
  // Configurações
  aiConfig: AIConfiguration | null;
  
  // Conversas
  conversations: AIConversation[];
  currentConversation: AIConversation | null;
  messages: AIMessage[];
  
  // Estados
  loading: boolean;
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

  // Ações para mensagens
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  
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
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar configuração da IA';
      set({ error: errorMessage, loading: false });
    }
  },

  createAIConfiguration: async (config) => {
    set({ loading: true, error: null });
    try {
      const newConfig = await aiService.createAIConfiguration(config);
      set({ aiConfig: newConfig, loading: false });
      useToastStore.getState().showToast('Configuração da IA criada com sucesso!', 'success');
    } catch (error) {
      console.error('Error creating AI configuration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar configuração da IA';
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast('Erro ao criar configuração da IA', 'error');
      throw error;
    }
  },

  updateAIConfiguration: async (configId: string, updates) => {
    set({ loading: true, error: null });
    try {
      const updatedConfig = await aiService.updateAIConfiguration(configId, updates);
      set({ aiConfig: updatedConfig, loading: false });
      useToastStore.getState().showToast('Configuração da IA atualizada com sucesso!', 'success');
    } catch (error) {
      console.error('Error updating AI configuration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar configuração da IA';
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast('Erro ao atualizar configuração da IA', 'error');
      throw error;
    }
  },

  // Conversas
  fetchConversations: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const conversations = await aiService.getAIConversations(userId);
      set({ conversations, loading: false });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar conversas';
      set({ error: errorMessage, loading: false });
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
        title: 'Nova conversa com IA',
        is_active: true
      });

      set(state => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
        loading: false
      }));

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar conversa';
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast('Erro ao criar conversa', 'error');
      throw error;
    }
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation, messages: [] });
    if (conversation) {
      get().fetchMessages(conversation.id);
    }
  },

  // Mensagens
  fetchMessages: async (conversationId: string) => {
    set({ loading: true, error: null });
    try {
      const messages = await aiService.getAIMessages(conversationId);
      set({ messages, loading: false });
    } catch (error) {
      console.error('Error fetching messages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar mensagens';
      set({ error: errorMessage, loading: false });
    }
  },

  sendMessage: async (conversationId: string, content: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    set({ sendingMessage: true, error: null });
    
    try {
      // Adicionar mensagem do usuário
      const userMessage = await aiService.createAIMessage({
        conversation_id: conversationId,
        sender_type: 'user',
        content,
        metadata: {}
      });

      set(state => ({
        messages: [...state.messages, userMessage]
      }));

      // Buscar configuração da IA
      let aiConfig = get().aiConfig;
      if (!aiConfig && currentConversation.ai_config_id) {
        // Buscar configuração se não estiver carregada
        const { data } = await supabase
          .from('ai_configurations')
          .select('*')
          .eq('id', currentConversation.ai_config_id)
          .single();
        aiConfig = data;
      }

      // Processar resposta da IA
      const aiResponse = await aiService.processAIMessage(
        content,
        aiConfig || {
          ai_name: 'NutriBot',
          personality: 'empathetic',
          custom_instructions: ''
        } as AIConfiguration,
        get().messages
      );

      // Adicionar resposta da IA
      const aiMessage = await aiService.createAIMessage({
        conversation_id: conversationId,
        sender_type: 'ai',
        content: aiResponse.content,
        metadata: {
          recipes: aiResponse.recipes,
          suggestions: aiResponse.suggestions
        }
      });

      set(state => ({
        messages: [...state.messages, aiMessage],
        sendingMessage: false
      }));

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      set({ error: errorMessage, sendingMessage: false });
      useToastStore.getState().showToast('Erro ao enviar mensagem', 'error');
    }
  },

  // Utilitários
  clearError: () => set({ error: null }),
  
  reset: () => set({
    aiConfig: null,
    conversations: [],
    currentConversation: null,
    messages: [],
    loading: false,
    sendingMessage: false,
    error: null
  })
}));