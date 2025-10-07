import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { getUserProfile, createUserProfile } from '../services/database';
import { useToastStore } from './toast';
import { useRecipesStore } from './recipes';
import type { User, UserType } from '../types/user';
import type { Provider } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: any;
  loading: boolean;
  initialized: boolean;

  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, name: string, type: UserType) => Promise<{ success: boolean; error?: string }>;
  signInWithProvider: (provider: Provider) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  initializeAuth: async () => {
    if (get().initialized) return;

    set({ loading: true });

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        set({ user: null, session: null, loading: false, initialized: true });
        return;
      }

      await loadUserProfile(session, set);
      set({ initialized: true, loading: false });
    } catch (error) {
      console.error('[Auth] Initialization error:', error);
      set({ user: null, session: null, loading: false, initialized: true });
    }
  },

  signUpWithEmail: async (email: string, password: string, name: string, type: UserType) => {
    set({ loading: true });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            user_type: type,
          },
        },
      });

      if (error) {
        set({ loading: false });

        let message = 'Erro ao criar conta';

        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          message = 'Este email já está cadastrado. Tente fazer login.';
        } else if (error.message.includes('Password') || error.message.includes('password')) {
          message = 'A senha deve ter pelo menos 6 caracteres';
        } else if (error.message.includes('Invalid email') || error.message.includes('invalid email')) {
          message = 'Email inválido';
        } else if (error.message.includes('rate limit') || error.message.includes('Email rate limit')) {
          message = 'Muitas tentativas. Aguarde alguns minutos.';
        } else {
          message = `Erro ao criar conta: ${error.message}`;
        }

        useToastStore.getState().showToast(message, 'error');
        return { success: false, error: message };
      }

      const identities = data.user?.identities;
      const needsConfirmation = identities && identities.length === 0;

      set({ loading: false });

      if (needsConfirmation) {
        useToastStore.getState().showToast(
          'Conta criada! Verifique seu email para confirmar o cadastro.',
          'success'
        );
      } else {
        if (data.session) {
          await loadUserProfile(data.session, set);
          useToastStore.getState().showToast('Conta criada e login realizado!', 'success');
        } else {
          useToastStore.getState().showToast('Conta criada! Faça login para continuar.', 'success');
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Unexpected sign up error:', error);
      set({ loading: false });

      const message = error.message || 'Erro inesperado ao criar conta';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, error: message };
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ loading: true });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        set({ loading: false });

        let message = 'Erro ao fazer login';

        if (error.message.includes('Invalid login') || error.message.includes('invalid')) {
          message = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed') || error.message.includes('not confirmed')) {
          message = 'Confirme seu email antes de fazer login. Verifique sua caixa de entrada.';
        } else if (error.status === 400) {
          message = 'Email ou senha incorretos';
        } else {
          message = `Erro ao fazer login: ${error.message}`;
        }

        useToastStore.getState().showToast(message, 'error');
        return { success: false, error: message };
      }

      if (!data.session) {
        set({ loading: false });
        const message = 'Erro ao criar sessão. Tente novamente.';
        useToastStore.getState().showToast(message, 'error');
        return { success: false, error: message };
      }

      await loadUserProfile(data.session, set);
      set({ loading: false });

      useToastStore.getState().showToast('Login realizado com sucesso!', 'success');

      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Unexpected sign in error:', error);
      set({ loading: false });

      const message = error.message || 'Erro inesperado ao fazer login';
      useToastStore.getState().showToast(message, 'error');
      return { success: false, error: message };
    }
  },

  signInWithProvider: async (provider: Provider) => {
    set({ loading: true });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        set({ loading: false });
        useToastStore.getState().showToast('Erro ao fazer login com ' + provider, 'error');
        return;
      }
    } catch (error: any) {
      console.error('[Auth] Unexpected OAuth error:', error);
      set({ loading: false });
      useToastStore.getState().showToast('Erro inesperado ao fazer login', 'error');
    }
  },

  signOut: async () => {
    try {
      const recipesStore = useRecipesStore.getState();
      if (recipesStore.clearUserData) {
        recipesStore.clearUserData();
      }

      await supabase.auth.signOut();

      set({
        user: null,
        session: null,
      });

      useToastStore.getState().showToast('Logout realizado com sucesso!', 'info');
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      set({
        user: null,
        session: null,
      });
      useToastStore.getState().showToast('Logout realizado', 'info');
    }
  },
}));

async function loadUserProfile(session: any, set: any) {
  try {
    const user = session.user;

    let profile;
    try {
      profile = await getUserProfile(user.id);
    } catch (error: any) {
      if (error.code === 'PGRST116') {
        const userData = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
          user_type: (user.user_metadata?.user_type || 'Client') as UserType,
        };

        profile = await createUserProfile(userData);
      } else {
        throw error;
      }
    }

    if (!profile) {
      throw new Error('Perfil não encontrado ou não pôde ser criado');
    }

    const mappedUser: User = {
      id: user.id,
      email: user.email || '',
      name: profile.full_name,
      type: profile.user_type,
      profile: undefined,
    };

    set({
      user: mappedUser,
      session,
    });

    const recipesStore = useRecipesStore.getState();
    if (recipesStore.fetchRecipes) {
      await recipesStore.fetchRecipes();
    }
  } catch (error) {
    console.error('[Auth] Error loading profile:', error);
    throw error;
  }
}
