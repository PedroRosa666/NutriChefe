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
  initialized: boolean;
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

let authListenerRegistered = false;

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
      initialized: false,
      pendingConfirmationEmail: null,

      initializeAuth: async () => {
        if (get().initialized) return;

        try {
          const { data } = await supabase.auth.getSession();
          const session = data.session;

          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            const mapped = mapSupabaseUser(session.user, profile);
            set({
              user: mapped,
              token: session.access_token,
              isAuthenticated: true,
              initialized: true,
            });
          } else {
            set({ user: null, token: null, isAuthenticated: false, initialized: true });
          }
        } catch {
          set({ user: null, token: null, isAuthenticated: false, initialized: true });
        }

        if (!authListenerRegistered) {
          authListenerRegistered = true;
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
        }
      },

      signIn: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password,
          });

          if (error) {
            let friendly = 'Erro ao fazer login.';
            const msg = error.message.toLowerCase();
            if (msg.includes('invalid login credentials'))
              friendly = 'Email ou senha incorretos.';
            else if (msg.includes('email not confirmed'))
              friendly = 'E-mail não confirmado. Verifique sua caixa de entrada e clique no link de ativação.';
            else if (msg.includes('too many requests'))
              friendly = 'Muitas tentativas. Tente novamente mais tarde.';
            else if (msg.includes('network') || msg.includes('fetch'))
              friendly = 'Erro de conexão. Verifique sua internet e tente novamente.';
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
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

          const res = await fetch(`${supabaseUrl}/functions/v1/auth-signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              email: email.toLowerCase().trim(),
              password,
              full_name: name,
              user_type: type,
              redirectTo: `${window.location.origin}/confirmar-email`,
            }),
          });

          const result = await res.json();

          if (!res.ok) {
            let friendly = result.error || 'Erro ao criar conta.';
            if (friendly.includes('já está cadastrado') || res.status === 409)
              friendly = 'Este e-mail já está cadastrado.';
            if (res.status === 429)
              friendly = 'Muitas tentativas. Aguarde alguns minutos.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return;
          }

          set({
            loading: false,
            user: null,
            token: null,
            isAuthenticated: false,
            error: 'EMAIL_CONFIRMATION_REQUIRED',
            pendingConfirmationEmail: email.toLowerCase().trim(),
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
