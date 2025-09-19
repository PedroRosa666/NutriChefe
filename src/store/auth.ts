import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
// REMOVIDO: createUserProfile (perfil será criado pelo trigger no banco)
import { getUserProfile } from '../services/database';
import { useToastStore } from './toast';
import type { User, UserType } from '../types/user';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
  signIn: (email: string, password: string, name?: string) => Promise<void>;
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
          console.log('Initializing auth...');
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error getting session:', error);
            set({ user: null, isAuthenticated: false, token: null });
            return;
          }

          if (session?.user) {
            console.log('Session found, getting profile...');
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
            } catch (profileError) {
              console.error('Error fetching profile on init:', profileError);
              set({ user: null, isAuthenticated: false, token: null });
            }
          } else {
            console.log('No session found');
            set({ user: null, isAuthenticated: false, token: null });
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ user: null, isAuthenticated: false, token: null });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          console.log('Attempting sign in...');
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) {
            console.error('Sign in error:', error);
            let friendlyMessage = 'Erro ao fazer login';
            if (error.message.includes('Invalid login credentials')) {
              friendlyMessage = 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.';
            } else if (error.message.includes('Email not confirmed')) {
              friendlyMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
            } else if (error.message.includes('Too many requests')) {
              friendlyMessage = 'Muitas tentativas de login. Tente novamente em alguns minutos.';
            }
            set({ error: friendlyMessage });
            useToastStore.getState().showToast(friendlyMessage, 'error');
            return;
          }

          if (!data.session?.user) {
            set({ error: 'Falha ao obter sessão.' });
            useToastStore.getState().showToast('Falha ao obter sessão.', 'error');
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
        } catch (error) {
          console.error('Sign in error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
          set({ error: errorMessage });
          useToastStore.getState().showToast(errorMessage, 'error');
        } finally {
          set({ loading: false });
        }
      },

      // >>> ALTERADO: cadastro não autentica; envia link de verificação e orienta o usuário
      signUp: async (email: string, password: string, name: string, type: UserType) => {
        set({ loading: true, error: null });
        try {
          console.log('Attempting sign up...');
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
            console.error('Sign up error:', error);
            let friendlyMessage = 'Erro ao criar conta';
            if (error.message.includes('User already registered')) {
              friendlyMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email.';
            } else if (error.message.includes('Password should be at least')) {
              friendlyMessage = 'A senha deve ter pelo menos 6 caracteres.';
            } else if (error.message.includes('Invalid email')) {
              friendlyMessage = 'Email inválido. Verifique o formato do email.';
            } else if (error.message.includes('duplicate key value')) {
              friendlyMessage = 'Este email já está cadastrado. Tente fazer login.';
            }
            useToastStore.getState().showToast(friendlyMessage, 'error');
            set({ error: friendlyMessage });
            return;
          }

          if (!data.user) {
            throw new Error('Nenhum usuário retornado pelo Supabase');
          }

          // NÃO criamos perfil aqui (o trigger faz isso).
          // NÃO autenticamos antes da confirmação.
          set({
            user: null,
            isAuthenticated: false,
            token: null
          });

          useToastStore.getState().showToast(
            'Conta criada! Confirme seu e-mail para acessar.',
            'success'
          );
        } catch (error) {
          console.error('Sign up error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
          set({ error: errorMessage });
          useToastStore.getState().showToast(errorMessage, 'error');
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          console.log('Signing out...');
          set({ user: null, token: null, isAuthenticated: false });

          const { useRecipesStore } = await import('./recipes');
          useRecipesStore.getState().clearUserData();

          const { useSubscriptionStore } = await import('./subscription');
          useSubscriptionStore.getState().reset?.();

          const { error } = await supabase.auth.signOut();
          if (error) console.error('Supabase signOut error:', error);

          useToastStore.getState().showToast('Logout realizado com sucesso!', 'info');
        } catch (error) {
          console.error('Error signing out:', error);
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
