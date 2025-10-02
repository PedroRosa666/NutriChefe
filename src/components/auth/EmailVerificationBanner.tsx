import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Banner que aparece no topo da aplicação quando há email pendente de verificação
 */
export function EmailVerificationBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  
  const { 
    pendingEmailVerification, 
    resendVerificationEmail, 
    clearPendingVerification 
  } = useAuthStore();

  // Cooldown timer
  React.useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  if (!pendingEmailVerification || !isVisible) return null;

  const handleResend = async () => {
    if (cooldown > 0) return;
    
    setLoading(true);
    try {
      await resendVerificationEmail(pendingEmailVerification);
      setCooldown(60); // 60 segundos de cooldown
    } catch (error) {
      console.error('Error resending email:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    clearPendingVerification();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-1 bg-white/20 rounded-full">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Email não confirmado
                </p>
                <p className="text-xs opacity-90 truncate">
                  Verifique sua caixa de entrada: {pendingEmailVerification}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  loading || cooldown > 0
                    ? "bg-white/20 text-white/60 cursor-not-allowed"
                    : "bg-white/20 hover:bg-white/30 text-white"
                )}
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {cooldown > 0 
                  ? `${cooldown}s`
                  : loading 
                    ? 'Enviando...'
                    : 'Reenviar'
                }
              </button>

              <button
                onClick={handleDismiss}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Dispensar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de progresso do cooldown */}
          {cooldown > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2"
            >
              <div className="w-full bg-white/20 rounded-full h-1">
                <motion.div
                  className="bg-white h-1 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: cooldown, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}