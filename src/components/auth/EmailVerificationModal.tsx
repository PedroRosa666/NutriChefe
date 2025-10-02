import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, RefreshCw, CheckCircle, AlertCircle, Clock, Send, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
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
  const [attempts, setAttempts] = useState(0);
  
  const { resendVerificationEmail, clearPendingVerification } = useAuthStore();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('pending');
      setMessage('');
      setAttempts(0);
      setResendCooldown(0);
    }
  }, [isOpen]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email) return;

    setLoading(true);
    setStatus('pending');
    setMessage('');
    
    try {
      await resendVerificationEmail(email);
      setStatus('sent');
      setMessage('Email de confirmação reenviado com sucesso!');
      setAttempts(prev => prev + 1);
      
      // Cooldown progressivo baseado no número de tentativas
      const cooldownTime = Math.min(60 + (attempts * 30), 300); // Max 5 minutos
      setResendCooldown(cooldownTime);
      
    } catch (error: any) {
      console.error('Error resending email:', error);
      setStatus('error');
      
      if (error.message?.includes('rate limit')) {
        setMessage('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
        setResendCooldown(300); // 5 minutos para rate limit
      } else {
        setMessage(error.message || 'Erro ao reenviar email. Tente novamente em alguns minutos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    clearPendingVerification();
    onClose();
  };

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

  const getMainMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'sent':
        return 'Email de confirmação reenviado com sucesso!';
      case 'error':
        return 'Erro ao enviar email de confirmação.';
      default:
        return `Enviamos um email de confirmação para ${email}. Clique no link para ativar sua conta.`;
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
          onClick={handleClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          disabled={loading}
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
              {loading ? (
                <LoadingSpinner size="md" className="text-white" />
              ) : (
                getStatusIcon()
              )}
            </div>
          </motion.div>

          {/* Título */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl font-bold text-gray-900 dark:text-white mb-4"
          >
            {loading ? 'Enviando email...' :
             status === 'sent' ? 'Email enviado!' : 
             status === 'error' ? 'Erro no envio' : 
             'Confirme seu email'}
          </motion.h2>

          {/* Mensagem principal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6"
          >
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {getMainMessage()}
            </p>
            
            {/* Email destacado */}
            {!message && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900 dark:text-white break-all text-sm">
                  {email}
                </p>
              </div>
            )}
          </motion.div>

          {/* Dicas importantes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Dicas importantes:
                </h3>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Verifique sua pasta de spam/lixo eletrônico</li>
                  <li>• O link expira em 24 horas</li>
                  <li>• Pode levar alguns minutos para chegar</li>
                  <li>• Use o mesmo dispositivo/navegador se possível</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Botões de ação */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-3"
          >
            {/* Botão de reenvio */}
            <button
              onClick={handleResendEmail}
              disabled={loading || resendCooldown > 0 || !email}
              className={cn(
                "w-full py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2",
                loading || resendCooldown > 0 || !email
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700 hover:scale-105"
              )}
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {resendCooldown > 0 
                ? `Aguarde ${resendCooldown}s para reenviar`
                : loading 
                  ? 'Reenviando...'
                  : attempts > 0 
                    ? 'Reenviar novamente'
                    : 'Reenviar email'
              }
            </button>

            {/* Botão de voltar */}
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-200 font-medium flex items-center justify-center gap-2 hover:scale-105"
              disabled={loading}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </button>
          </motion.div>

          {/* Progresso do cooldown */}
          <AnimatePresence>
            {resendCooldown > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4"
              >
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <motion.div
                    className="bg-green-600 h-1 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: resendCooldown, ease: "linear" }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Aguarde para reenviar novamente
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contador de tentativas */}
          {attempts > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center"
            >
              {attempts === 1 ? '1 email enviado' : `${attempts} emails enviados`}
            </motion.p>
          )}
        </div>
      </motion.div>
    </div>
  );
}