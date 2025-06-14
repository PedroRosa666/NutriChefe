import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerUser, loginUser } from '../services/authService';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, accountType: 'Nutritionist' | 'Client', email: string, password: string) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      signIn: async (email, password) => {
        console.log('signIn called with:', { email, password });
        set({ loading: true, error: null });
        try {
          await loginUser(email, password);
          set({ isAuthenticated: true });
          console.log('signIn successful');
        } catch (error: any) {
          console.error('signIn error:', error.message);
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      signUp: async (fullName, accountType, email, password) => {
        console.log('signUp called with:', { fullName, accountType, email });
        set({ loading: true, error: null });
        try {
          await registerUser({ fullName, accountType, email, password });
          set({ isAuthenticated: true });
          console.log('signUp successful');
        } catch (error: any) {
          console.error('signUp error:', error.message);
          set({ error: error.message });
        } finally {
          set({ loading: false });
        }
      },

      signOut: () => {
        console.log('signOut called');
        set({ user: null, isAuthenticated: false });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

export function signUp(email: string, password: string, name: string, type: string): { user: any; token: any; } | PromiseLike<{ user: any; token: any; }> {
  throw new Error('Function not implemented.');
}
export function signIn(email: string, password: string): { user: any; token: any; } | PromiseLike<{ user: any; token: any; }> {
  throw new Error('Function not implemented.');
}

