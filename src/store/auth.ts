import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
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

async function fetchUserProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, user_type, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

function mapSupabaseUser(supabaseUser: any, profile: any): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name:
      (supabaseUser.user_metadata?.full_name as string) ||
      profile?.full_name ||
      '',
    type:
      ((supabaseUser.user_metadata?.user_type as UserType) ||
        (profile?.user_type as UserType)) ??
      'Client',
    avatar_url: profile?.avatar_url || null,
    profile: undefined,
  };
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

          const profile = await fetchUserProfile(session.user.id);
          const mapped = mapSupabaseUser(session.user, profile);

          set({
            user: mapped,
            token: session.access_token,
            isAuthenticated: true,
          });
        } catch {
          set({ user: null, token: null, isAuthenticated: false });
        }

        supabase.auth.onAuthStateChange((event, session) => {
          (async () => {
            if (event === 'SIGNED_OUT' || !session) {
              set({ user: null, token: null, isAuthenticated: false });
              return;
            }

            if (
              event === 'SIGNED_IN' ||
              event === 'TOKEN_REFRESHED' ||
              event === 'USER_UPDATED'
            ) {
              const profile = await fetchUserProfile(session.user.id);
              const mapped = mapSupabaseUser(session.user, profile);
              set({
                user: mapped,
                token: session.access_token,
                isAuthenticated: true,
              });
            }
          })();
        });
      },

      signIn: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            let friendly = 'Erro ao fazer login';
            if (error.message.includes('Invalid login credentials'))
              friendly = 'Email ou senha incorretos.';
            if (error.message.includes('Email not confirmed'))
              friendly =
                'E-mail não confirmado. Verifique sua caixa de entrada e clique no link de ativação.';
            if (error.message.includes('Too many requests'))
              friendly = 'Muitas tentativas. Tente mais tarde.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return;
          }

          const u = data.user;
          const session = data.session;
          const profile = await fetchUserProfile(u.id);
          const mapped = mapSupabaseUser(u, profile);

          set({
            user: mapped,
            token: session?.access_token ?? null,
            isAuthenticated: true,
            loading: false,
            error: null,
          });

          useToastStore.getState().showToast('Login realizado com sucesso!', 'success');
        } catch {
          useToastStore
            .getState()
            .showToast('Erro inesperado ao fazer login.', 'error');
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
              data: { full_name: name, user_type: type },
            },
          });

          if (error) {
            let friendly = 'Erro ao criar conta';
            if (error.message.includes('User already registered'))
              friendly = 'Este e-mail já está cadastrado.';
            if (error.message.includes('already registered'))
              friendly = 'Este e-mail já está cadastrado.';
            if (error.message.includes('Password should be at least'))
              friendly = 'A senha deve ter pelo menos 6 caracteres.';
            if (error.message.includes('Invalid email'))
              friendly = 'E-mail inválido.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return;
          }

          // Always sign out any auto-created session so the user must confirm their email.
          // This enforces email verification even when the Supabase project has autoconfirm enabled.
          if (data.session) {
            await supabase.auth.signOut();
          }

          set({
            loading: false,
            user: null,
            token: null,
            isAuthenticated: false,
            error: 'EMAIL_CONFIRMATION_REQUIRED',
            pendingConfirmationEmail: email,
          });
        } catch {
          useToastStore
            .getState()
            .showToast('Erro inesperado ao criar conta.', 'error');
          set({ error: 'Erro inesperado', loading: false });
        }
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        set({ user: null, token: null, isAuthenticated: false });
        useToastStore.getState().showToast('Até logo!', 'info');
      },

      updateProfile: async (updates) => {
        const currentUser = get().user;
        if (!currentUser) return;
        set({ user: { ...currentUser, ...updates } });
      },

      clearError: () => set({ error: null }),
      clearPendingConfirmation: () =>
        set({ pendingConfirmationEmail: null, error: null }),
      isNutritionist: () => get().user?.type === 'Nutritionist',
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
