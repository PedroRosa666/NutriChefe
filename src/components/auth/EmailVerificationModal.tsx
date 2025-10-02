import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { cn } from '../../lib/utils';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onSuccess?: () => void;
}

export function EmailVerificationModal({ isOpen, onClose, email, onSuccess }: EmailVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'sent' | 'error'>('pending');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setStatus('pending');
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify-email`
        }
      });

      if (error) throw error;

      setStatus('sent');
      setMessage('Email de confirmação reenviado com sucesso!');
      setResendCooldown(60);
    } catch (error: any) {
      console.error('Error resending email:', error);
      setStatus('error');
      
      if (error.message?.includes('rate limit')) {
        setMessage('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
        setResendCooldown(300); // 5 minutos
      } else {
        setMessage('Erro ao reenviar email. Tente novamente em alguns minutos.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Countdown effect
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Mail className="w-8 h-8 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'sent':
        return 'from-green-500 to-emerald-500';
      case 'error':
        return 'from-red-500 to-rose-500';
      default:
        return 'from-blue-500 to-indigo-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          {/* Ícone animado */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className={`p-3 bg-gradient-to-r ${getStatusColor()} rounded-full`}>
              {getStatusIcon()}
            </div>
          </motion.div>

          {/* Título */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl font-bold text-gray-900 dark:text-white mb-4"
          >
            {status === 'sent' ? 'Email reenviado!' : 
             status === 'error' ? 'Erro no envio' : 
             'Confirme seu email'}
          </motion.h2>

          {/* Mensagem */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {message || `Enviamos um link de confirmação para:`}
            </p>
            
            {!message && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900 dark:text-white break-all">
                  {email}
                </p>
              </div>
            )}

            {status === 'pending' && !message && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                      Não recebeu o email?
                    </p>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Verifique sua pasta de spam</li>
                      <li>• Aguarde alguns minutos</li>
                      <li>• Certifique-se que o email está correto</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Botões de ação */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-3"
          >
            {/* Botão de reenvio */}
            <button
              onClick={handleResendEmail}
              disabled={loading || resendCooldown > 0}
              className={cn(
                "w-full py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2",
                loading || resendCooldown > 0
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700 hover:scale-105"
              )}
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {resendCooldown > 0 
                ? `Aguarde ${resendCooldown}s`
                : loading 
                  ? 'Reenviando...'
                  : 'Reenviar email'
              }
            </button>

            {/* Botão de fechar */}
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-200 font-medium"
            >
              Fechar
            </button>
          </motion.div>

          {/* Progresso do cooldown */}
          {resendCooldown > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4"
            >
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <motion.div
                  className="bg-green-600 h-1 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: resendCooldown }}
                />
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}