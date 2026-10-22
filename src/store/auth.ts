import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getUserProfile } from '../services/database';
import { useToastStore } from './toast';
import type { User, UserType } from '../types/user';
import { cleanupDeviceOnLogout } from '../lib/push';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;

  /** true quando o login deu certo. */
  signIn: (email: string, password: string) => Promise<boolean>;
  /** 'signed_in' (já logado), 'confirm_email' (precisa confirmar) ou null em caso de erro. */
  signUp: (email: string, password: string, name: string, type: UserType) => Promise<'signed_in' | 'confirm_email' | null>;
  updateName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearSession: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  isNutritionist: () => boolean;
}

// O AuthModal compara com esta mensagem para oferecer o reenvio da confirmação.
export const EMAIL_NOT_CONFIRMED_MESSAGE = 'Email não confirmado. Verifique sua caixa de entrada.';

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
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (!session?.user) {
            set({ user: null, token: null, isAuthenticated: false });
            return;
          }

          const u = session.user;

          // Montar objeto User do app
          const profile = await getUserProfile(u.id).catch(() => null);
          const mapped: User = {
            id: u.id,
            email: u.email ?? '',
            name: profile?.full_name || (u.user_metadata?.full_name as string) || '',
            created_at: u.created_at,
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
            if (error.message.includes('Email not confirmed')) friendly = EMAIL_NOT_CONFIRMED_MESSAGE;
            if (error.message.includes('Too many requests')) friendly = 'Muitas tentativas. Tente mais tarde.';
            if (error.message.includes('Error sending confirmation email')) friendly = 'Erro no serviço de email. Tente novamente mais tarde ou entre em contato com o suporte.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return false;
          }

          const u = data.user;

          const session = data.session ?? (await supabase.auth.getSession()).data.session;
          const profile = await getUserProfile(u.id).catch(() => null);
          const mapped: User = {
            id: u.id,
            email: u.email ?? '',
            name: profile?.full_name || (u.user_metadata?.full_name as string) || '',
            created_at: u.created_at,
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
          return true;
        } catch (e) {
          console.error('signIn error:', e);
          useToastStore.getState().showToast('Erro inesperado ao fazer login.', 'error');
          set({ error: 'Erro inesperado', loading: false });
          return false;
        }
      },

      signUp: async (email, password, name, type) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              // Aceite da política de privacidade (LGPD): o formulário só envia com a caixa marcada.
              data: { full_name: name, user_type: type, privacy_accepted_at: new Date().toISOString() },
              emailRedirectTo: `${window.location.origin}/confirm-email`
            }
          });

          if (error) {
            let friendly = 'Erro ao criar conta';
            if (error.message.includes('User already registered')) friendly = 'Este e-mail já está cadastrado.';
            if (error.message.includes('Password should be at least')) friendly = 'A senha deve ter pelo menos 6 caracteres.';
            if (error.message.includes('Invalid email')) friendly = 'E-mail inválido.';
            if (error.message.includes('email rate limit exceeded')) friendly = 'Muitas tentativas de cadastro. Por favor, aguarde alguns minutos e tente novamente.';
            if (error.message.includes('Error sending confirmation email')) friendly = 'Erro no serviço de email. Tente novamente mais tarde ou entre em contato com o suporte.';
            if (error.message.includes('unexpected_failure')) friendly = 'Erro no servidor. Tente novamente mais tarde.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly, loading: false });
            return null;
          }

          const u = data.user;
          const session = data.session ?? (await supabase.auth.getSession()).data.session;

          if (u && session?.access_token) {
            const mapped: User = {
              id: u.id,
              email: u.email ?? '',
              name: name,
              type: type,
              avatar_url: null,
              profile: undefined
            };

            set({
              user: mapped,
              token: session.access_token,
              isAuthenticated: true,
              loading: false
            });

            useToastStore.getState().showToast('Conta criada com sucesso!', 'success');
            return 'signed_in';
          }

          useToastStore.getState().showToast('Conta criada! Enviamos um link de confirmação para o seu e-mail.', 'success');
          set({ loading: false });
          return 'confirm_email';
        } catch (e) {
          console.error('signUp error:', e);
          useToastStore.getState().showToast('Erro inesperado ao criar conta.', 'error');
          set({ error: 'Erro inesperado', loading: false });
          return null;
        }
      },

      signOut: async () => {
        try {
          // Antes de sair (ainda logado): o aparelho para de receber notificações dessa pessoa.
          await cleanupDeviceOnLogout();
          await supabase.auth.signOut();
        } catch (e) {
          console.error('signOut error:', e);
        } finally {
          // Limpa o estado local mesmo se a chamada de rede falhar.
          get().clearSession();
          useToastStore.getState().showToast('Logout realizado!', 'info');
        }
      },

      updateName: async (name) => {
        const currentUser = get().user;
        const trimmed = name.trim();
        if (!currentUser || !trimmed) return;
        const { error } = await supabase.from('profiles').update({ full_name: trimmed }).eq('id', currentUser.id);
        if (error) throw error;
        // Metadado do auth também, pois o nome é lido dele no login.
        await supabase.auth.updateUser({ data: { full_name: trimmed } }).catch(() => undefined);
        set({ user: { ...currentUser, name: trimmed } });
      },

      clearSession: () => set({ user: null, token: null, isAuthenticated: false, error: null }),

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
      isNutritionist: () => get().user?.type === 'Nutritionist'
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated })
    }
  )
);