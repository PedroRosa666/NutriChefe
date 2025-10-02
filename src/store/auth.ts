import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getUserProfile, createUserProfile } from '../services/database';
import { useToastStore } from './toast';
import { useRecipesStore } from './recipes';
import type { User, UserType } from '../types/user';

// Define URL segura de redirecionamento para confirmação de e-mail
const getRedirectUrl = () => {
  const envUrl = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (envUrl) return envUrl;
  
  const origin = window.location.origin;
  const isUnsafe = /webcontainer-api\.io|credentialless|\.local-credentialless\./.test(origin);
  return isUnsafe ? 'http://localhost:5173' : origin;
};

function isEmailConfirmed(user: any): boolean {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
  pendingEmailVerification: string | null;
  emailVerificationSent: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, type: UserType) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  confirmEmail: (token: string) => Promise<void>;
  clearError: () => void;
  isNutritionist: () => boolean;
  setPendingEmailVerification: (email: string | null) => void;
  clearPendingVerification: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      loading: false,
      pendingEmailVerification: null,
      emailVerificationSent: false,

      initializeAuth: async () => {
        console.log('Initializing authentication...');
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Session error:', error);
            set({ user: null, token: null, isAuthenticated: false });
            return;
          }

          if (!session?.user) {
            console.log('No active session found');
            set({ user: null, token: null, isAuthenticated: false });
            return;
          }

          const user = session.user;
          console.log('Session found for user:', user.id, 'Email confirmed:', isEmailConfirmed(user));

          // Verificar se o email foi confirmado
          if (!isEmailConfirmed(user)) {
            console.log('Email not confirmed, signing out...');
            await supabase.auth.signOut();
            set({ 
              user: null, 
              token: null, 
              isAuthenticated: false,
              pendingEmailVerification: user.email || null
            });
            return;
          }

          // Buscar ou criar perfil do usuário
          let profile;
          try {
            profile = await getUserProfile(user.id);
          } catch (profileError: any) {
            // Se perfil não existe, criar um novo
            if (profileError.code === 'PGRST116') {
              console.log('Profile not found, creating new profile...');
              const userData = {
                id: user.id,
                email: user.email || '',
                full_name: user.user_metadata?.full_name || '',
                user_type: user.user_metadata?.user_type || 'Client'
              };
              profile = await createUserProfile(userData);
            } else {
              throw profileError;
            }
          }

          const mappedUser: User = {
            id: user.id,
            email: user.email || '',
            name: profile?.full_name || user.user_metadata?.full_name || '',
            type: profile?.user_type || user.user_metadata?.user_type || 'Client',
            profile: undefined
          };

          set({
            user: mappedUser,
            token: session.access_token,
            isAuthenticated: true,
            pendingEmailVerification: null
          });

          console.log('Authentication initialized successfully for:', mappedUser.name);

          // Inicializar dados do usuário
          const recipesStore = useRecipesStore.getState();
          if (recipesStore.initializeAuth) {
            await recipesStore.initializeAuth();
          }

        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      signIn: async (email, password) => {
        set({ loading: true, error: null });
        
        try {
          console.log('Attempting sign in for:', email);
          
          const { data, error } = await supabase.auth.signInWithPassword({ 
            email: email.toLowerCase().trim(), 
            password 
          });

          if (error) {
            console.error('Sign in error:', error);
            
            let friendlyMessage = 'Erro ao fazer login';
            
            if (error.message.includes('Invalid login credentials')) {
              friendlyMessage = 'Email ou senha incorretos. Verifique suas credenciais.';
            } else if (error.message.includes('Email not confirmed')) {
              friendlyMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
              set({ pendingEmailVerification: email });
            } else if (error.message.includes('Too many requests')) {
              friendlyMessage = 'Muitas tentativas de login. Aguarde alguns minutos.';
            } else if (error.message.includes('signup_disabled')) {
              friendlyMessage = 'Cadastros temporariamente desabilitados.';
            }

            set({ error: friendlyMessage, loading: false });
            useToastStore.getState().showToast(friendlyMessage, 'error');
            return;
          }

          const user = data.user;
          
          // Verificar confirmação de email
          if (!isEmailConfirmed(user)) {
            console.log('Email not confirmed for user:', user.id);
            await supabase.auth.signOut();
            
            const message = 'Email não confirmado. Verifique sua caixa de entrada e clique no link de confirmação.';
            set({ 
              error: message, 
              loading: false, 
              isAuthenticated: false, 
              user: null, 
              token: null,
              pendingEmailVerification: email
            });
            useToastStore.getState().showToast(message, 'error');
            return;
          }

          // Buscar perfil do usuário
          let profile;
          try {
            profile = await getUserProfile(user.id);
          } catch (profileError: any) {
            if (profileError.code === 'PGRST116') {
              // Criar perfil se não existir
              const userData = {
                id: user.id,
                email: user.email || '',
                full_name: user.user_metadata?.full_name || '',
                user_type: user.user_metadata?.user_type || 'Client'
              };
              profile = await createUserProfile(userData);
            } else {
              throw profileError;
            }
          }

          const mappedUser: User = {
            id: user.id,
            email: user.email || '',
            name: profile?.full_name || user.user_metadata?.full_name || '',
            type: profile?.user_type || user.user_metadata?.user_type || 'Client',
            profile: undefined
          };

          set({
            user: mappedUser,
            token: data.session?.access_token || null,
            isAuthenticated: true,
            loading: false,
            pendingEmailVerification: null,
            error: null
          });

          console.log('Sign in successful for:', mappedUser.name);
          useToastStore.getState().showToast('Login realizado com sucesso!', 'success');

          // Inicializar dados do usuário
          const recipesStore = useRecipesStore.getState();
          if (recipesStore.initializeAuth) {
            await recipesStore.initializeAuth();
          }

        } catch (error: any) {
          console.error('Unexpected sign in error:', error);
          const message = 'Erro inesperado ao fazer login. Tente novamente.';
          set({ error: message, loading: false });
          useToastStore.getState().showToast(message, 'error');
        }
      },

      signUp: async (email, password, name, type) => {
        set({ loading: true, error: null });
        
        try {
          console.log('Attempting sign up for:', email, 'as', type);
          
          const trimmedEmail = email.toLowerCase().trim();
          const redirectUrl = `${getRedirectUrl()}/auth/confirm`;
          
          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              emailRedirectTo: redirectUrl,
              data: { 
                full_name: name.trim(), 
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
            } else if (error.message.includes('signup_disabled')) {
              friendlyMessage = 'Cadastros temporariamente desabilitados.';
            }

            set({ error: friendlyMessage, loading: false });
            useToastStore.getState().showToast(friendlyMessage, 'error');
            return;
          }

          console.log('Sign up successful, verification email sent to:', trimmedEmail);
          
          set({ 
            loading: false, 
            pendingEmailVerification: trimmedEmail,
            emailVerificationSent: true,
            error: null 
          });
          
          useToastStore.getState().showToast(
            'Conta criada! Verifique seu email para confirmar o cadastro.', 
            'success'
          );

        } catch (error: any) {
          console.error('Unexpected sign up error:', error);
          const message = 'Erro inesperado ao criar conta. Tente novamente.';
          set({ error: message, loading: false });
          useToastStore.getState().showToast(message, 'error');
        }
      },

      signOut: async () => {
        try {
          console.log('Signing out user...');
          
          // Limpar dados do usuário antes do logout
          const recipesStore = useRecipesStore.getState();
          if (recipesStore.clearUserData) {
            recipesStore.clearUserData();
          }

          await supabase.auth.signOut();
          
          set({ 
            user: null, 
            token: null, 
            isAuthenticated: false, 
            pendingEmailVerification: null,
            emailVerificationSent: false,
            error: null
          });
          
          console.log('Sign out successful');
          useToastStore.getState().showToast('Logout realizado com sucesso!', 'info');
          
        } catch (error) {
          console.error('Sign out error:', error);
          // Mesmo com erro, limpar estado local
          set({ 
            user: null, 
            token: null, 
            isAuthenticated: false, 
            pendingEmailVerification: null,
            emailVerificationSent: false
          });
          useToastStore.getState().showToast('Logout realizado', 'info');
        }
      },

      resendVerificationEmail: async (email: string) => {
        set({ loading: true, error: null });
        
        try {
          console.log('Resending verification email to:', email);
          
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.toLowerCase().trim(),
            options: {
              emailRedirectTo: `${getRedirectUrl()}/auth/confirm`
            }
          });

          if (error) {
            console.error('Resend email error:', error);
            
            let friendlyMessage = 'Erro ao reenviar email de confirmação';
            
            if (error.message.includes('rate limit') || error.message.includes('Email rate limit')) {
              friendlyMessage = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
            } else if (error.message.includes('User not found')) {
              friendlyMessage = 'Email não encontrado. Verifique se o email está correto.';
            }
            
            set({ error: friendlyMessage, loading: false });
            useToastStore.getState().showToast(friendlyMessage, 'error');
            throw new Error(friendlyMessage);
          }

          set({ loading: false, emailVerificationSent: true });
          useToastStore.getState().showToast('Email de confirmação reenviado com sucesso!', 'success');
          
        } catch (error: any) {
          console.error('Unexpected resend error:', error);
          if (!get().error) {
            const message = 'Erro inesperado ao reenviar email. Tente novamente.';
            set({ error: message, loading: false });
            useToastStore.getState().showToast(message, 'error');
          }
          throw error;
        }
      },

      confirmEmail: async (token: string) => {
        set({ loading: true, error: null });
        
        try {
          console.log('Confirming email with token...');
          
          const { data, error } = await supabase.auth.verifyOtp({
            type: 'signup',
            token_hash: token
          });

          if (error) {
            console.error('Email confirmation error:', error);
            
            let friendlyMessage = 'Erro ao confirmar email';
            
            if (error.message.includes('expired')) {
              friendlyMessage = 'Link de confirmação expirado. Solicite um novo email.';
            } else if (error.message.includes('invalid')) {
              friendlyMessage = 'Link de confirmação inválido. Solicite um novo email.';
            }
            
            set({ error: friendlyMessage, loading: false });
            useToastStore.getState().showToast(friendlyMessage, 'error');
            throw new Error(friendlyMessage);
          }

          if (data?.user) {
            console.log('Email confirmed successfully for user:', data.user.id);
            
            // Buscar ou criar perfil
            let profile;
            try {
              profile = await getUserProfile(data.user.id);
            } catch (profileError: any) {
              if (profileError.code === 'PGRST116') {
                const userData = {
                  id: data.user.id,
                  email: data.user.email || '',
                  full_name: data.user.user_metadata?.full_name || '',
                  user_type: data.user.user_metadata?.user_type || 'Client'
                };
                profile = await createUserProfile(userData);
              } else {
                throw profileError;
              }
            }

            const mappedUser: User = {
              id: data.user.id,
              email: data.user.email || '',
              name: profile?.full_name || data.user.user_metadata?.full_name || '',
              type: profile?.user_type || data.user.user_metadata?.user_type || 'Client',
              profile: undefined
            };

            set({
              user: mappedUser,
              token: data.session?.access_token || null,
              isAuthenticated: true,
              loading: false,
              pendingEmailVerification: null,
              emailVerificationSent: false,
              error: null
            });

            useToastStore.getState().showToast('Email confirmado com sucesso! Bem-vindo!', 'success');

            // Inicializar dados do usuário
            const recipesStore = useRecipesStore.getState();
            if (recipesStore.initializeAuth) {
              await recipesStore.initializeAuth();
            }
          }
        } catch (error: any) {
          console.error('Unexpected confirmation error:', error);
          if (!get().error) {
            const message = 'Erro inesperado ao confirmar email';
            set({ error: message, loading: false });
            useToastStore.getState().showToast(message, 'error');
          }
          throw error;
        }
      },

      clearError: () => set({ error: null }),
      
      isNutritionist: () => get().user?.type === 'Nutritionist',
      
      setPendingEmailVerification: (email: string | null) => set({ pendingEmailVerification: email }),
      
      clearPendingVerification: () => set({ 
        pendingEmailVerification: null, 
        emailVerificationSent: false 
      })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated,
        pendingEmailVerification: state.pendingEmailVerification
      })
    }
  )
);

// Listener para mudanças de autenticação
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event, session?.user?.id);
  
  const store = useAuthStore.getState();
  
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    store.clearPendingVerification();
    
    // Limpar dados do usuário
    const recipesStore = useRecipesStore.getState();
    if (recipesStore.clearUserData) {
      recipesStore.clearUserData();
    }
  } else if (event === 'SIGNED_IN' && session?.user) {
    console.log('User signed in via auth state change');
    
    // Verificar se email foi confirmado
    if (isEmailConfirmed(session.user)) {
      // Re-inicializar autenticação para atualizar estado
      await store.initializeAuth();
    }
  } else if (event === 'TOKEN_REFRESHED' && session?.user) {
    console.log('Token refreshed');
    // Atualizar token no estado
    useAuthStore.setState({ token: session.access_token });
  }
});