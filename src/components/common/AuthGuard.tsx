import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { AuthModal } from '../AuthModal';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireEmailVerification?: boolean;
}

/**
 * Componente que protege rotas/funcionalidades que requerem autenticação
 */
export function AuthGuard({ 
  children, 
  fallback, 
  requireEmailVerification = true 
}: AuthGuardProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, user, pendingEmailVerification } = useAuthStore();

  // Se não está autenticado, mostrar fallback ou modal de login
  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-lg max-w-md mx-auto"
        >
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mx-auto mb-4">
            <Lock className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso restrito
          </h3>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Você precisa estar logado para acessar esta funcionalidade.
          </p>
          
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Fazer login
          </button>
        </motion.div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="signin"
        />
      </>
    );
  }

  // Se está autenticado mas email não foi verificado
  if (requireEmailVerification && pendingEmailVerification) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-lg max-w-md mx-auto"
      >
        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full w-fit mx-auto mb-4">
          <Mail className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Confirme seu email
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Você precisa confirmar seu email para acessar todas as funcionalidades.
        </p>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Verifique sua caixa de entrada e pasta de spam para o email enviado para:
          </p>
          <p className="font-medium text-blue-900 dark:text-blue-100 mt-1 break-all">
            {pendingEmailVerification}
          </p>
        </div>
      </motion.div>
    );
  }

  // Se tudo está OK, renderizar o conteúdo protegido
  return <>{children}</>;
}