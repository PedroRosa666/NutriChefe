import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getUserProfile } from '../services/database';
import { useToastStore } from './toast';
import type { User, UserType } from '../types/user';

function isEmailConfirmed(u: any): boolean {
  // Supabase (GoTrue v2) expõe uma destas chaves
  return Boolean(u?.email_confirmed_at || u?.confirmed_at);
}

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
          const { data: { session } } = await supabase.auth.getSession();

          // Se não houver sessão, limpa estado
          if (!session?.user) {
            set({ user: null, isAuthenticated: false, token: null });
            return;
          }

          // ⚠️ Gate: recusa sessão de e-mail não confirmado
          if (!isEmailConfirmed(session.user)) {
            await supabase.auth.signOut();
            set({ user: null, isAuthenticated: false, token: null });
            useToastStore.getState().showToast('Confirme seu e-mail para acessar.', 'error');
            return;
          }

          // Carrega perfil
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

          // Inicializações dependentes
          try {
            const { useRecipesStore } = await import('./recipes');
            useRecipesStore.getState().initializeAuth();
          } catch {}
          try {
            const { useSubscriptionStore } = await import('./subscription');
            useSubscriptionStore.getState().fetchUserSubscription(session.user.id);
          } catch {}
        } catch (e) {
          console.error('initializeAuth error:', e);
          set({ user: null, isAuthenticated: false, token: null });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) {
            let friendly = 'Erro ao fazer login';
            if (error.message.includes('Invalid login credentials')) friendly = 'Email ou senha incorretos.';
            if (error.message.includes('Email not confirmed')) friendly = 'Email não confirmado. Verifique sua caixa de entrada.';
            if (error.message.includes('Too many requests')) friendly = 'Muitas tentativas. Tente mais tarde.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly });
            return;
          }

          const u = data.user;
          if (!u || !data.session) {
            useToastStore.getState().showToast('Falha ao obter sessão.', 'error');
            set({ error: 'Falha ao obter sessão.' });
            return;
          }

          // ⚠️ Gate: recusa login sem e-mail confirmado
          if (!isEmailConfirmed(u)) {
            await supabase.auth.signOut();
            useToastStore.getState().showToast('Confirme seu e-mail para acessar.', 'error');
            set({ user: null, isAuthenticated: false, token: null });
            return;
          }

          const profile = await getUserProfile(u.id);
          const userData: User = {
            id: u.id,
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

          try {
            const { useRecipesStore } = await import('./recipes');
            useRecipesStore.getState().initializeAuth();
          } catch {}
          try {
            const { useSubscriptionStore } = await import('./subscription');
            useSubscriptionStore.getState().fetchUserSubscription(u.id);
          } catch {}
        } catch (err: any) {
          console.error('signIn error:', err);
          const msg = err?.message ?? 'Falha no login';
          set({ error: msg });
          useToastStore.getState().showToast(msg, 'error');
        } finally {
          set({ loading: false });
        }
      },

      // Cadastro com verificação: envia link e NÃO autentica
      signUp: async (email: string, password: string, name: string, type: UserType) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/confirm`,
              data: { full_name: name, user_type: type }
            }
          });

          if (error) {
            let friendly = 'Erro ao criar conta';
            if (error.message.includes('User already registered')) friendly = 'Este e-mail já está cadastrado.';
            if (error.message.includes('Password should be at least')) friendly = 'A senha deve ter pelo menos 6 caracteres.';
            if (error.message.includes('Invalid email')) friendly = 'E-mail inválido.';
            useToastStore.getState().showToast(friendly, 'error');
            set({ error: friendly });
            return;
          }

          // Tentativa extra (opcional) de reenviar o e-mail caso o projeto permita
          try {
            await supabase.auth.resend({ type: 'signup', email });
          } catch {}

          // Não autenticar aqui
          set({ user: null, isAuthenticated: false, token: null });
          useToastStore.getState().showToast('Conta criada! Confirme seu e-mail para acessar.', 'success');
        } catch (err: any) {
          console.error('signUp error:', err);
          const msg = err?.message ?? 'Falha no cadastro';
          set({ error: msg });
          useToastStore.getState().showToast(msg, 'error');
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          set({ user: null, token: null, isAuthenticated: false });
          try {
            const { useRecipesStore } = await import('./recipes');
            useRecipesStore.getState().clearUserData();
          } catch {}
          try {
            const { useSubscriptionStore } = await import('./subscription');
            useSubscriptionStore.getState().reset?.();
          } catch {}
          await supabase.auth.signOut();
          useToastStore.getState().showToast('Logout realizado!', 'info');
        } catch (e) {
          console.error('signOut error:', e);
          useToastStore.getState().showToast('Logout realizado', 'info');
        }
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
