import { create } from 'zustand';
import { countUnreadMessages } from '../services/messages';
import { useAuthStore } from './auth';

interface UnreadMessagesState {
  count: number;
  refresh: (userId: string) => Promise<void>;
  reset: () => void;
}

/** Mensagens recebidas e ainda não lidas (paciente ou nutricionista), para o contador da navegação. */
export const useUnreadMessagesStore = create<UnreadMessagesState>((set) => ({
  count: 0,
  refresh: async (userId) => {
    try {
      const count = await countUnreadMessages(userId);
      // Resposta de outra conta (troca de usuário no meio do caminho): descarta.
      if (useAuthStore.getState().user?.id === userId) set({ count });
    } catch (error) {
      console.error('Error counting unread messages:', error);
    }
  },
  reset: () => set({ count: 0 }),
}));
