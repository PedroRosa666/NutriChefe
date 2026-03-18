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
  pendingConfirmationEmail: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, type: UserType) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  clearPendingConfirmation: () => void;
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
      pendingConfirmationEmail: null,

      initializeAuth: async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (!session?.user) {
            set({ user: null, token: null, isAuthenticated: false });
            return;
          }

          const u = session.user;

          const profile = await getUserProfile(u.id).catch(() => null);
          const mapped: User = {
            id: u.id,
            email: u.email ?? '',
            name: (u.user_metadata?.full_name as string) || profile?.full_name || '',
            type: ((u.user_metadata?.user_type as UserType) || (profile?.user_type as UserType)) ?? 'Client',
            avatar_url: profile?.avatar_url || null,
            profile: undefined
          };

          set({
            user: mapped,
            token: session.access_token,
            isAuthenticated: true
          });
        } catch (e) {
          console.error('initializeAuth error:', e);
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      signIn: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            let friendly = 'Erro ao fazer login';
            if (error.message.includes('Invalid login credentials')) friendly = 'Email ou senha incorretos.';
            if (error.message.includes('Email not confirmed')) friendly = 'Email não confirmado. Verifique sua caixa de entrada e clique no link de ativação.';
            if (error.message.includes('Too many requests')) friendly = 'Muitas tentativas. Tente mais tarde.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return;
          }

          const u = data.user;
          const session = data.session ?? (await supabase.auth.getSession()).data.session;
          const profile = await getUserProfile(u.id).catch(() => null);
          const mapped: User = {
            id: u.id,
            email: u.email ?? '',
            name: (u.user_metadata?.full_name as string) || profile?.full_name || '',
            type: ((u.user_metadata?.user_type as UserType) || (profile?.user_type as UserType)) ?? 'Client',
            avatar_url: profile?.avatar_url || null,
            profile: undefined
          };

          set({
            user: mapped,
            token: session?.access_token ?? null,
            isAuthenticated: true,
            loading: false
          });

          useToastStore.getState().showToast('Login realizado com sucesso!', 'success');
        } catch (e) {
          console.error('signIn error:', e);
          useToastStore.getState().showToast('Erro inesperado ao fazer login.', 'error');
          set({ error: 'Erro inesperado', loading: false });
        }
      },

      signUp: async (email, password, name, type) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/confirmar-email`,
              data: { full_name: name, user_type: type }
            }
          });

          if (error) {
            let friendly = 'Erro ao criar conta';
            if (error.message.includes('User already registered')) friendly = 'Este e-mail já está cadastrado.';
            if (error.message.includes('Password should be at least')) friendly = 'A senha deve ter pelo menos 6 caracteres.';
            if (error.message.includes('Invalid email')) friendly = 'E-mail inválido.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return;
          }

          const u = data.user;
          const session = data.session;

          // Se já veio sessão (confirm email desabilitado no Supabase), loga direto
          if (u && session?.access_token) {
            const profile = await getUserProfile(u.id).catch(() => null);
            const mapped: User = {
              id: u.id,
              email: u.email ?? '',
              name: (u.user_metadata?.full_name as string) || profile?.full_name || '',
              type: ((u.user_metadata?.user_type as UserType) || (profile?.user_type as UserType)) ?? 'Client',
              avatar_url: profile?.avatar_url || null,
              profile: undefined
            };

            set({
              user: mapped,
              token: session.access_token,
              isAuthenticated: true,
              loading: false
            });

            useToastStore.getState().showToast('Conta criada com sucesso!', 'success');
            return;
          }

          // Confirmação de email necessária — guarda o email para mostrar na tela
          set({
            loading: false,
            error: 'EMAIL_CONFIRMATION_REQUIRED',
            pendingConfirmationEmail: email,
          });
        } catch (e) {
          console.error('signUp error:', e);
          useToastStore.getState().showToast('Erro inesperado ao criar conta.', 'error');
          set({ error: 'Erro inesperado', loading: false });
        }
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut();
          set({ user: null, token: null, isAuthenticated: false });
          useToastStore.getState().showToast('Logout realizado!', 'info');
        } catch (e) {
          console.error('signOut error:', e);
          useToastStore.getState().showToast('Logout realizado', 'info');
        }
      },

      updateProfile: async (updates) => {
        const currentUser = get().user;
        if (!currentUser) return;

        set({
          user: {
            ...currentUser,
            ...updates
          }
        });
      },

      clearError: () => set({ error: null }),
      clearPendingConfirmation: () => set({ pendingConfirmationEmail: null, error: null }),
      isNutritionist: () => get().user?.type === 'Nutritionist'
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated })
    }
  )
);
