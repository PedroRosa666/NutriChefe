import { create } from 'zustand';
import * as chatService from '../services/chat';
import { useAuthStore } from './auth';
import { useToastStore } from './toast';
import type { MentoringRelationship, Conversation, Message, ClientGoal, GoalProgress, MentoringSession } from '../types/chat';

interface ChatState {
  // Relacionamentos de mentoria
  mentoringRelationships: MentoringRelationship[];
  
  // Conversas
  conversations: Conversation[];
  activeConversation: Conversation | null;
  
  // Mensagens
  messages: Message[];
  
  // Metas
  clientGoals: ClientGoal[];
  
  // Sessões
  mentoringSessions: MentoringSession[];
  
  // Estados de loading
  loading: {
    relationships: boolean;
    conversations: boolean;
    messages: boolean;
    goals: boolean;
    sessions: boolean;
  };
  
  // Ações para relacionamentos
  fetchMentoringRelationships: () => Promise<void>;
  createMentoringRelationship: (clientId: string, notes?: string) => Promise<void>;
  updateMentoringRelationship: (id: string, updates: Partial<MentoringRelationship>) => Promise<void>;
  
  // Ações para conversas
  fetchConversations: () => Promise<void>;
  createConversation: (mentoringRelationshipId: string, title?: string) => Promise<void>;
  setActiveConversation: (conversation: Conversation | null) => void;
  
  // Ações para mensagens
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, messageType?: Message['message_type']) => Promise<void>;
  addMessage: (message: Message) => void;
  
  // Ações para metas
  fetchClientGoals: (clientId?: string) => Promise<void>;
  createClientGoal: (goalData: Omit<ClientGoal, 'id' | 'created_at' | 'updated_at' | 'current_value'>) => Promise<void>;
  updateClientGoal: (id: string, updates: Partial<ClientGoal>) => Promise<void>;
  addGoalProgress: (goalId: string, value: number, notes?: string) => Promise<void>;
  
  // Ações para sessões
  fetchMentoringSessions: (mentoringRelationshipId: string) => Promise<void>;
  createMentoringSession: (sessionData: Omit<MentoringSession, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMentoringSession: (id: string, updates: Partial<MentoringSession>) => Promise<void>;
  
  // Limpeza
  clearChatData: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  mentoringRelationships: [],
  conversations: [],
  activeConversation: null,
  messages: [],
  clientGoals: [],
  mentoringSessions: [],
  
  loading: {
    relationships: false,
    conversations: false,
    messages: false,
    goals: false,
    sessions: false
  },

  fetchMentoringRelationships: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set(state => ({ loading: { ...state.loading, relationships: true } }));
    try {
      const relationships = await chatService.getMentoringRelationships(user.id);
      set({ mentoringRelationships: relationships });
    } catch (error) {
      console.error('Error fetching mentoring relationships:', error);
      useToastStore.getState().showToast('Erro ao carregar relacionamentos de mentoria', 'error');
    } finally {
      set(state => ({ loading: { ...state.loading, relationships: false } }));
    }
  },

  createMentoringRelationship: async (clientId: string, notes?: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const relationship = await chatService.createMentoringRelationship(user.id, clientId, notes);
      set(state => ({
        mentoringRelationships: [relationship, ...state.mentoringRelationships]
      }));
      useToastStore.getState().showToast('Relacionamento de mentoria criado com sucesso!', 'success');
    } catch (error) {
      console.error('Error creating mentoring relationship:', error);
      useToastStore.getState().showToast('Erro ao criar relacionamento de mentoria', 'error');
      throw error;
    }
  },

  updateMentoringRelationship: async (id: string, updates: Partial<MentoringRelationship>) => {
    try {
      const updatedRelationship = await chatService.updateMentoringRelationship(id, updates);
      set(state => ({
        mentoringRelationships: state.mentoringRelationships.map(rel =>
          rel.id === id ? updatedRelationship : rel
        )
      }));
      useToastStore.getState().showToast('Relacionamento atualizado com sucesso!', 'success');
    } catch (error) {
      console.error('Error updating mentoring relationship:', error);
      useToastStore.getState().showToast('Erro ao atualizar relacionamento', 'error');
      throw error;
    }
  },

  fetchConversations: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set(state => ({ loading: { ...state.loading, conversations: true } }));
    try {
      const conversations = await chatService.getConversations(user.id);
      set({ conversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      useToastStore.getState().showToast('Erro ao carregar conversas', 'error');
    } finally {
      set(state => ({ loading: { ...state.loading, conversations: false } }));
    }
  },

  createConversation: async (mentoringRelationshipId: string, title?: string) => {
    try {
      const conversation = await chatService.createConversation(mentoringRelationshipId, title);
      set(state => ({
        conversations: [conversation, ...state.conversations],
        activeConversation: conversation
      }));
    } catch (error) {
      console.error('Error creating conversation:', error);
      useToastStore.getState().showToast('Erro ao criar conversa', 'error');
      throw error;
    }
  },

  setActiveConversation: (conversation: Conversation | null) => {
    set({ activeConversation: conversation, messages: [] });
    if (conversation) {
      get().fetchMessages(conversation.id);
    }
  },

  fetchMessages: async (conversationId: string) => {
    set(state => ({ loading: { ...state.loading, messages: true } }));
    try {
      const messages = await chatService.getMessages(conversationId);
      set({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      useToastStore.getState().showToast('Erro ao carregar mensagens', 'error');
    } finally {
      set(state => ({ loading: { ...state.loading, messages: false } }));
    }
  },

  sendMessage: async (content: string, messageType: Message['message_type'] = 'text') => {
    const { user } = useAuthStore.getState();
    const { activeConversation } = get();
    
    if (!user || !activeConversation) return;

    try {
      const message = await chatService.sendMessage(activeConversation.id, user.id, content, messageType);
      set(state => ({
        messages: [...state.messages, message]
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      useToastStore.getState().showToast('Erro ao enviar mensagem', 'error');
      throw error;
    }
  },

  addMessage: (message: Message) => {
    set(state => ({
      messages: [...state.messages, message]
    }));
  },

  fetchClientGoals: async (clientId?: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    const targetClientId = clientId || (user.type === 'Client' ? user.id : undefined);
    if (!targetClientId) return;

    set(state => ({ loading: { ...state.loading, goals: true } }));
    try {
      const goals = await chatService.getClientGoals(
        targetClientId,
        user.type === 'Nutritionist' ? user.id : undefined
      );
      set({ clientGoals: goals });
    } catch (error) {
      console.error('Error fetching client goals:', error);
      useToastStore.getState().showToast('Erro ao carregar metas', 'error');
    } finally {
      set(state => ({ loading: { ...state.loading, goals: false } }));
    }
  },

  createClientGoal: async (goalData) => {
    try {
      const goal = await chatService.createClientGoal(goalData);
      set(state => ({
        clientGoals: [goal, ...state.clientGoals]
      }));
      useToastStore.getState().showToast('Meta criada com sucesso!', 'success');
    } catch (error) {
      console.error('Error creating client goal:', error);
      useToastStore.getState().showToast('Erro ao criar meta', 'error');
      throw error;
    }
  },

  updateClientGoal: async (id: string, updates: Partial<ClientGoal>) => {
    try {
      const updatedGoal = await chatService.updateClientGoal(id, updates);
      set(state => ({
        clientGoals: state.clientGoals.map(goal =>
          goal.id === id ? updatedGoal : goal
        )
      }));
      useToastStore.getState().showToast('Meta atualizada com sucesso!', 'success');
    } catch (error) {
      console.error('Error updating client goal:', error);
      useToastStore.getState().showToast('Erro ao atualizar meta', 'error');
      throw error;
    }
  },

  addGoalProgress: async (goalId: string, value: number, notes?: string) => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      await chatService.addGoalProgress(goalId, user.id, value, notes);
      // Recarregar metas para obter progresso atualizado
      await get().fetchClientGoals();
      useToastStore.getState().showToast('Progresso registrado com sucesso!', 'success');
    } catch (error) {
      console.error('Error adding goal progress:', error);
      useToastStore.getState().showToast('Erro ao registrar progresso', 'error');
      throw error;
    }
  },

  fetchMentoringSessions: async (mentoringRelationshipId: string) => {
    set(state => ({ loading: { ...state.loading, sessions: true } }));
    try {
      const sessions = await chatService.getMentoringSessions(mentoringRelationshipId);
      set({ mentoringSessions: sessions });
    } catch (error) {
      console.error('Error fetching mentoring sessions:', error);
      useToastStore.getState().showToast('Erro ao carregar sessões', 'error');
    } finally {
      set(state => ({ loading: { ...state.loading, sessions: false } }));
    }
  },

  createMentoringSession: async (sessionData) => {
    try {
      const session = await chatService.createMentoringSession(sessionData);
      set(state => ({
        mentoringSessions: [...state.mentoringSessions, session].sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        )
      }));
      useToastStore.getState().showToast('Sessão agendada com sucesso!', 'success');
    } catch (error) {
      console.error('Error creating mentoring session:', error);
      useToastStore.getState().showToast('Erro ao agendar sessão', 'error');
      throw error;
    }
  },

  updateMentoringSession: async (id: string, updates: Partial<MentoringSession>) => {
    try {
      const updatedSession = await chatService.updateMentoringSession(id, updates);
      set(state => ({
        mentoringSessions: state.mentoringSessions.map(session =>
          session.id === id ? updatedSession : session
        )
      }));
      useToastStore.getState().showToast('Sessão atualizada com sucesso!', 'success');
    } catch (error) {
      console.error('Error updating mentoring session:', error);
      useToastStore.getState().showToast('Erro ao atualizar sessão', 'error');
      throw error;
    }
  },

  clearChatData: () => {
    set({
      mentoringRelationships: [],
      conversations: [],
      activeConversation: null,
      messages: [],
      clientGoals: [],
      mentoringSessions: []
    });
  }
}));