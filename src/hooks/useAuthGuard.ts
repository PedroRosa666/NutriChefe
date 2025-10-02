import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';

interface UseAuthGuardOptions {
  requireAuth?: boolean;
  requireEmailVerification?: boolean;
  redirectOnFail?: boolean;
  showToastOnFail?: boolean;
  onAuthRequired?: () => void;
  onEmailVerificationRequired?: () => void;
}

/**
 * Hook para proteger funcionalidades que requerem autenticação
 */
export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const {
    requireAuth = true,
    requireEmailVerification = true,
    redirectOnFail = false,
    showToastOnFail = true,
    onAuthRequired,
    onEmailVerificationRequired
  } = options;

  const { 
    isAuthenticated, 
    user, 
    pendingEmailVerification 
  } = useAuthStore();
  
  const { showToast } = useToastStore();

  const hasAccess = () => {
    if (requireAuth && !isAuthenticated) return false;
    if (requireEmailVerification && pendingEmailVerification) return false;
    return true;
  };

  const checkAccess = () => {
    if (requireAuth && !isAuthenticated) {
      if (showToastOnFail) {
        showToast('Você precisa estar logado para acessar esta funcionalidade.', 'error');
      }
      if (onAuthRequired) {
        onAuthRequired();
      }
      return false;
    }

    if (requireEmailVerification && pendingEmailVerification) {
      if (showToastOnFail) {
        showToast('Confirme seu email para acessar esta funcionalidade.', 'error');
      }
      if (onEmailVerificationRequired) {
        onEmailVerificationRequired();
      }
      return false;
    }

    return true;
  };

  return {
    hasAccess: hasAccess(),
    checkAccess,
    isAuthenticated,
    user,
    needsEmailVerification: !!pendingEmailVerification
  };
}