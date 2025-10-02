import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, Shield, Star } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { AuthModal } from './AuthModal';
import { EmailVerificationModal } from './auth/EmailVerificationModal';

interface ProtectedFeatureProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireEmailVerification?: boolean;
  feature?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

/**
 * Wrapper para funcionalidades que requerem autenticação e/ou verificação de email
 */
export function ProtectedFeature({
  children,
  requireAuth = true,
  requireEmailVerification = true,
  feature,
  fallbackTitle = "Acesso restrito",
  fallbackDescription = "Você precisa estar logado para acessar esta funcionalidade."
}: ProtectedFeatureProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  const { 
    isAuthenticated, 
    user, 
    pendingEmailVerification,
    clearPendingVerification 
  } = useAuthStore();

  // Verificar se tem acesso
  const hasAccess = () => {
    if (requireAuth && !isAuthenticated) return false;
    if (requireEmailVerification && pendingEmailVerification) return false;
    return true;
  };

  if (hasAccess()) {
    return <>{children}</>;
  }

  // Determinar qual modal mostrar
  const needsAuth = requireAuth && !isAuthenticated;
  const needsEmailVerification = isAuthenticated && requireEmailVerification && pendingEmailVerification;

  const getIcon = () => {
    if (needsEmailVerification) return <Mail className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />;
    return <Lock className="w-8 h-8 text-green-600 dark:text-green-400" />;
  };

  const getIconBg = () => {
    if (needsEmailVerification) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-green-100 dark:bg-green-900/30';
  };

  const getTitle = () => {
    if (needsEmailVerification) return 'Confirme seu email';
    return fallbackTitle;
  };

  const getDescription = () => {
    if (needsEmailVerification) {
      return 'Você precisa confirmar seu email para acessar esta funcionalidade.';
    }
    return fallbackDescription;
  };

  const getPrimaryAction = () => {
    if (needsEmailVerification) {
      return {
        label: 'Verificar email',
        action: () => setShowEmailModal(true),
        className: 'bg-yellow-600 hover:bg-yellow-700'
      };
    }
    
    return {
      label: 'Fazer login',
      action: () => setShowAuthModal(true),
      className: 'bg-green-600 hover:bg-green-700'
    };
  };

  const primaryAction = getPrimaryAction();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-lg max-w-md mx-auto"
      >
        <div className={`p-3 ${getIconBg()} rounded-full w-fit mx-auto mb-4`}>
          {getIcon()}
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {getTitle()}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {getDescription()}
        </p>

        {/* Informação adicional para verificação de email */}
        {needsEmailVerification && pendingEmailVerification && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Email enviado para:
            </p>
            <p className="font-medium text-blue-900 dark:text-blue-100 mt-1 break-all">
              {pendingEmailVerification}
            </p>
          </div>
        )}

        {/* Funcionalidades premium */}
        {feature && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Funcionalidade Premium
              </span>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Esta funcionalidade requer uma conta verificada e ativa.
            </p>
          </div>
        )}
        
        <button
          onClick={primaryAction.action}
          className={`w-full py-2.5 text-white rounded-lg transition-all duration-200 font-medium hover:scale-105 ${primaryAction.className}`}
        >
          {primaryAction.label}
        </button>

        {/* Ação secundária */}
        {needsEmailVerification && (
          <button
            onClick={() => clearPendingVerification()}
            className="w-full mt-3 py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
          >
            Dispensar aviso
          </button>
        )}
      </motion.div>

      {/* Modais */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signin"
      />

      {needsEmailVerification && (
        <EmailVerificationModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          email={pendingEmailVerification || ''}
          onSuccess={() => {
            setShowEmailModal(false);
            clearPendingVerification();
          }}
        />
      )}
    </>
  );
}