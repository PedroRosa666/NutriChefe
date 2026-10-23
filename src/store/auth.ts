import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getUserProfile } from '../services/database';
import { useToastStore } from './toast';
import type { User, UserType } from '../types/user';
import { cleanupDeviceOnLogout } from '../lib/push';
import { forgetSavedAdminSession } from '../services/admin';
import { feedback } from '../lib/i18n/current';
import { translations } from '../lib/i18n/translations';

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

const AFTER_CONFIRM_KEY = 'nc-after-confirm';

function rememberAfterConfirm(next: string | null) {
  try {
    if (next && next.startsWith('/') && !next.startsWith('//')) localStorage.setItem(AFTER_CONFIRM_KEY, next);
    else localStorage.removeItem(AFTER_CONFIRM_KEY);
  } catch {
    // Sem armazenamento: depois de confirmar, a pessoa vai para o Início.
  }
}

/** Endereço guardado no cadastro para depois da confirmação do e-mail (lido uma vez só). */
export function takeAfterConfirm(): string {
  try {
    const next = localStorage.getItem(AFTER_CONFIRM_KEY);
    localStorage.removeItem(AFTER_CONFIRM_KEY);
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  } catch {
    // ignora
  }
  return '/perfil';
}

// O AuthModal usa isto para oferecer o reenvio da confirmação (vale nos dois idiomas).
export const isEmailNotConfirmedError = (message: string | null) =>
  !!message && Object.values(translations).some((tr) => tr.feedback.auth.emailNotConfirmed === message);

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
            // O perfil manda (o usuário consegue editar user_metadata, mas não profiles.user_type).
            type: ((profile?.user_type as UserType) || (u.user_metadata?.user_type as UserType)) ?? 'Client',
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
            const a = feedback().auth;
            let friendly = a.signInError;
            if (error.message.includes('Invalid login credentials')) friendly = a.invalidCredentials;
            if (error.message.includes('Email not confirmed')) friendly = a.emailNotConfirmed;
            if (error.message.includes('Too many requests')) friendly = a.tooManyAttempts;
            if (error.message.includes('Error sending confirmation email')) friendly = a.emailServiceError;
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
            // O perfil manda (o usuário consegue editar user_metadata, mas não profiles.user_type).
            type: ((profile?.user_type as UserType) || (u.user_metadata?.user_type as UserType)) ?? 'Client',
            avatar_url: profile?.avatar_url || null,
            profile: undefined
          };

          set({
            user: mapped,
            token: session?.access_token ?? null,
            isAuthenticated: true,
            loading: false
          });

          useToastStore.getState().showToast(feedback().auth.signedIn, 'success');
          return true;
        } catch (e) {
          console.error('signIn error:', e);
          useToastStore.getState().showToast(feedback().auth.unexpectedSignInError, 'error');
          set({ error: feedback().auth.unexpectedError, loading: false });
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
            const a = feedback().auth;
            let friendly = a.signUpError;
            if (error.message.includes('User already registered')) friendly = a.emailAlreadyRegistered;
            if (error.message.includes('Password should be at least')) friendly = a.passwordTooShort;
            if (error.message.includes('Invalid email')) friendly = a.invalidEmail;
            if (error.message.includes('email rate limit exceeded')) friendly = a.signUpRateLimit;
            if (error.message.includes('Error sending confirmation email')) friendly = a.emailServiceError;
            if (error.message.includes('unexpected_failure')) friendly = a.serverError;
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

            useToastStore.getState().showToast(feedback().auth.accountCreated, 'success');
            return 'signed_in';
          }

          useToastStore.getState().showToast(feedback().auth.accountCreatedConfirm, 'success');
          // Para onde ir depois de confirmar o e-mail (ex.: o link de convite que trouxe a pessoa).
          rememberAfterConfirm(new URLSearchParams(window.location.search).get('next'));
          set({ loading: false });
          return 'confirm_email';
        } catch (e) {
          console.error('signUp error:', e);
          useToastStore.getState().showToast(feedback().auth.unexpectedSignUpError, 'error');
          set({ error: feedback().auth.unexpectedError, loading: false });
          return null;
        }
      },

      signOut: async () => {
        try {
          // Antes de sair (ainda logado): o aparelho para de receber notificações dessa pessoa.
          await cleanupDeviceOnLogout();
          // Saiu de propósito: não guarda mais o caminho de volta para a conta do admin.
          forgetSavedAdminSession();
          await supabase.auth.signOut();
        } catch (e) {
          console.error('signOut error:', e);
        } finally {
          // Limpa o estado local mesmo se a chamada de rede falhar.
          get().clearSession();
          useToastStore.getState().showToast(feedback().auth.signedOut, 'info');
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

      clearSession: () => {
        // Saiu por qualquer caminho (outra aba, sessão expirada, troca de conta demo): o service
        // worker apaga os dados guardados para uso offline.
        try {
          navigator.serviceWorker?.controller?.postMessage({ type: 'logout' });
        } catch {
          /* sem service worker */
        }
        set({ user: null, token: null, isAuthenticated: false, error: null });
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
      isNutritionist: () => get().user?.type === 'Nutritionist'
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated })
    }
  )
);