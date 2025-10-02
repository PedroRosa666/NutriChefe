import { supabase } from '../lib/supabase';

/**
 * Utilitários para autenticação e verificação de email
 */

export interface EmailVerificationResult {
  success: boolean;
  user?: any;
  error?: string;
  needsNewLink?: boolean;
}

/**
 * Processa confirmação de email de diferentes formatos do Supabase
 */
export async function processEmailConfirmation(): Promise<EmailVerificationResult> {
  try {
    const url = new URL(window.location.href);
    console.log('Processing email confirmation from URL:', url.toString());

    // 1) Novo fluxo PKCE (?code=...)
    const code = url.searchParams.get('code');
    if (code) {
      console.log('Using PKCE flow with code');
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('PKCE confirmation error:', error);
        
        if (error.message?.includes('expired')) {
          return { success: false, error: 'Link expirado', needsNewLink: true };
        }
        
        return { success: false, error: error.message || 'Erro ao confirmar email' };
      }
      
      if (data?.user && data?.session) {
        console.log('PKCE confirmation successful');
        return { success: true, user: data.user };
      }
    }

    // 2) Fluxo com hash (#access_token=...&refresh_token=...)
    if (window.location.hash.includes('access_token')) {
      console.log('Using hash flow');
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        
        if (error) {
          console.error('Hash session error:', error);
          return { success: false, error: error.message || 'Erro ao confirmar email' };
        }
        
        if (data?.user) {
          console.log('Hash confirmation successful');
          return { success: true, user: data.user };
        }
      }
    }

    // 3) Fluxo legado (?token_hash=...&type=signup)
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    
    if (tokenHash && type === 'signup') {
      console.log('Using legacy OTP flow');
      const { data, error } = await supabase.auth.verifyOtp({
        type: 'signup',
        token_hash: tokenHash
      });
      
      if (error) {
        console.error('Legacy OTP error:', error);
        
        if (error.message?.includes('expired')) {
          return { success: false, error: 'Link expirado', needsNewLink: true };
        }
        
        return { success: false, error: error.message || 'Erro ao confirmar email' };
      }
      
      if (data?.user) {
        console.log('Legacy confirmation successful');
        return { success: true, user: data.user };
      }
    }

    // Se chegou até aqui, não há parâmetros válidos
    console.log('No valid confirmation parameters found');
    return { 
      success: false, 
      error: 'Link de confirmação inválido ou malformado',
      needsNewLink: true 
    };

  } catch (error: any) {
    console.error('Unexpected email confirmation error:', error);
    return { 
      success: false, 
      error: 'Erro inesperado ao confirmar email',
      needsNewLink: true 
    };
  }
}

/**
 * Valida força da senha
 */
export function validatePasswordStrength(password: string): {
  score: number;
  label: string;
  isValid: boolean;
  suggestions: string[];
} {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 6) score++;
  else suggestions.push('Use pelo menos 6 caracteres');

  if (password.match(/[a-z]/)) score++;
  else suggestions.push('Adicione letras minúsculas');

  if (password.match(/[A-Z]/)) score++;
  else suggestions.push('Adicione letras maiúsculas');

  if (password.match(/[0-9]/)) score++;
  else suggestions.push('Adicione números');

  if (password.match(/[^a-zA-Z0-9]/)) score++;
  else suggestions.push('Adicione símbolos especiais');

  const labels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];
  const label = labels[Math.max(0, score - 1)] || 'Muito fraca';
  const isValid = score >= 3; // Pelo menos "Regular"

  return { score, label, isValid, suggestions };
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitiza email (remove espaços, converte para minúsculo)
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Gera URL de redirecionamento segura
 */
export function getSecureRedirectUrl(path: string = ''): string {
  const envUrl = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (envUrl) return `${envUrl}${path}`;
  
  const origin = window.location.origin;
  const isUnsafe = /webcontainer-api\.io|credentialless|\.local-credentialless\./.test(origin);
  const baseUrl = isUnsafe ? 'http://localhost:5173' : origin;
  
  return `${baseUrl}${path}`;
}