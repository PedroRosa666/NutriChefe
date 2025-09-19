import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getUserProfile } from '../services/database';
import { useToastStore } from './toast';
import type { User, UserType } from '../types/user';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, type: UserType) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearError: () => void;
  isNutritionist: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      loading: false,

      initializeAuth: async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error getting session:', error);
            set({ user: null, isAuthenticated: false, token: null });
            return;
          }

          if (session?.user) {
            try {
              const profile = await getUserProfile(session.user.id);
              const userData: User = {
                id: session.user.id,
                email: profile.email,
                name: profile.full_name,
                type: profile.user_type as UserType,
                profile: {}
              };
              set({
                user: userData,
                isAuthenticated: true,
                token: session.access_token || null
              });

              // Inicializações dependentes de usuário
              const { useRecipesStore } = await import('./recipes');
              useRecipesStore.getState().initializeAuth();

              const { useSubscriptionStore } = await import('./subscription');
              useSubscriptionStore.getState().fetchUserSubscription(session.user.id);
            } catch (profileError) {
              console.error('Error fetching profile on init:', profileError);
              set({ user: null, isAuthenticated: false, token: null });
            }
          } else {
            set({ user: null, isAuthenticated: false, token: null });
          }
        } catch (e) {
          console.error('Error initializing auth:', e);
          set({ user: null, isAuthenticated: false, token: null });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            let friendlyMessage = 'Erro ao fazer login';
            if (error.message.includes('Invalid login credentials')) {
              friendlyMessage = 'Email ou senha incorretos. Verifique e tente novamente.';
            } else if (error.message.includes('Email not confirmed')) {
              friendlyMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
            } else if (error.message.includes('Too many requests')) {
              friendlyMessage = 'Muitas tentativas. Tente novamente em alguns minutos.';
            }
            useToastStore.getState().showToast(friendlyMessage, 'error');
            set({ error: friendlyMessage });
            return;
          }

          if (!data.session?.user) {
            useToastStore.getState().showToast('Falha ao obter sessão.', 'error');
            set({ error: 'Falha ao obter sessão.' });
            return;
          }

          const profile = await getUserProfile(data.session.user.id);
          const userData: User = {
            id: data.session.user.id,
            email: profile.email,
            name: profile.full_name,
            type: profile.user_type as UserType,
            profile: {}
          };

          set({
            user: userData,
            isAuthenticated: true,
            token: data.session.access_token || null
          });

          useToastStore.getState().showToast('Login realizado com sucesso!', 'success');

          const { useRecipesStore } = await import('./recipes');
          useRecipesStore.getState().initializeAuth();

          const { useSubscriptionStore } = await import('./subscription');
          useSubscriptionStore.getState().fetchUserSubscription(data.session.user.id);
        } catch (err) {
          console.error('Sign in error:', err);
          const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
          set({ error: errorMessage });
          useToastStore.getState().showToast(errorMessage, 'error');
        } finally {
          set({ loading: false });
        }
      },

      // >>> CADASTRO COM VERIFICAÇÃO: NÃO autentica antes de confirmar o e-mail
      signUp: async (email: string, password: string, name: string, type: UserType) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/confirm`,
              data: {
                full_name: name,
                user_type: type
              }
            }
          });

          if (error) {
            let friendlyMessage = 'Erro ao criar conta';
            if (error.message.includes('User already registered')) {
              friendlyMessage = 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.';
            } else if (error.message.includes('Password should be at least')) {
              friendlyMessage = 'A senha deve ter pelo menos 6 caracteres.';
            } else if (error.message.includes('Invalid email')) {
              friendlyMessage = 'E-mail inválido. Verifique o formato.';
            }
            useToastStore.getState().showToast(friendlyMessage, 'error');
            set({ error: friendlyMessage });
            return;
          }

          if (!data.user) {
            throw new Error('Falha ao criar usuário.');
          }

          // Não criamos perfil no cliente (há trigger no banco).
          // Não autenticamos antes da confirmação.
          set({ user: null, isAuthenticated: false, token: null });

          useToastStore.getState().showToast(
            'Conta criada! Confirme seu e-mail para acessar.',
            'success'
          );
        } catch (err) {
          console.error('Sign up error:', err);
          const errorMessage = err instanceof Error ? err.message : 'Sign up failed';
          set({ error: errorMessage });
          useToastStore.getState().showToast(errorMessage, 'error');
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          set({ user: null, token: null, isAuthenticated: false });

          const { useRecipesStore } = await import('./recipes');
          useRecipesStore.getState().clearUserData();

          const { useSubscriptionStore } = await import('./subscription');
          useSubscriptionStore.getState().reset?.();

          const { error } = await supabase.auth.signOut();
          if (error) console.error('Supabase signOut error:', error);

          useToastStore.getState().showToast('Logout realizado!', 'info');
        } catch (err) {
          console.error('Error signing out:', err);
          set({ user: null, token: null, isAuthenticated: false });
          useToastStore.getState().showToast('Logout realizado', 'info');
        }
      },

      clearError: () => set({ error: null }),
      isNutritionist: () => get().user?.type === 'Nutritionist'
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
