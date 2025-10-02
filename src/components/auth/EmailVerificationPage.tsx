import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, AlertCircle, RefreshCw, ArrowLeft, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface EmailVerificationPageProps {
  email?: string;
  onBackToAuth?: () => void;
}

export function EmailVerificationPage({ email, onBackToAuth }: EmailVerificationPageProps) {
  const [status, setStatus] = useState<'pending' | 'success' | 'error' | 'expired'>('pending');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');

  // Cooldown timer para reenvio
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Verificar confirmação automática se vier de redirect
  useEffect(() => {
    const checkEmailConfirmation = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const type = url.searchParams.get('type');

      if (code) {
        // Novo fluxo com code
        try {
          setLoading(true);
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) throw error;
          
          if (data?.user) {
            setStatus('success');
            setMessage('Email confirmado com sucesso! Redirecionando...');
            
            // Redirecionar após 2 segundos
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          }
        } catch (error: any) {
          console.error('Error confirming email:', error);
          setStatus('error');
          setMessage(error.message?.includes('expired') 
            ? 'Link expirado. Solicite um novo email de confirmação.'
            : 'Erro ao confirmar email. Tente novamente.');
        } finally {
          setLoading(false);
        }
      } else if (tokenHash && type === 'signup') {
        // Fluxo legado
        try {
          setLoading(true);
          const { data, error } = await supabase.auth.verifyOtp({
            type: 'signup',
            token_hash: tokenHash
          });
          
          if (error) throw error;
          
          if (data?.user) {
            setStatus('success');
            setMessage('Email confirmado com sucesso! Redirecionando...');
            
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          }
        } catch (error: any) {
          console.error('Error confirming email:', error);
          setStatus('error');
          setMessage('Erro ao confirmar email. Tente novamente.');
        } finally {
          setLoading(false);
        }
      }
    };

    checkEmailConfirmation();
  }, []);

  const handleResendEmail = async () => {
    if (!email || resendCooldown > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify-email`
        }
      });

      if (error) throw error;

      setMessage('Email de confirmação reenviado com sucesso!');
      setResendCooldown(60); // 60 segundos de cooldown
    } catch (error: any) {
      console.error('Error resending email:', error);
      setMessage('Erro ao reenviar email. Tente novamente em alguns minutos.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
      case 'expired':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      default:
        return <Mail className="w-12 h-12 text-blue-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'success':
        return 'Email confirmado!';
      case 'error':
        return 'Erro na confirmação';
      case 'expired':
        return 'Link expirado';
      default:
        return 'Confirme seu email';
    }
  };

  const getStatusMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'success':
        return 'Seu email foi confirmado com sucesso. Você será redirecionado automaticamente.';
      case 'error':
        return 'Houve um problema ao confirmar seu email. Tente reenviar o email de confirmação.';
      case 'expired':
        return 'O link de confirmação expirou. Solicite um novo email de confirmação.';
      default:
        return email 
          ? `Enviamos um email de confirmação para ${email}. Clique no link para ativar sua conta.`
          : 'Verifique sua caixa de entrada e clique no link de confirmação.';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8 text-center shadow-lg"
      >
        {/* Ícone de status */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="flex justify-center mb-6"
        >
          {loading ? (
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className={`p-3 rounded-full ${
              status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
              status === 'error' || status === 'expired' ? 'bg-red-100 dark:bg-red-900/30' :
              'bg-blue-100 dark:bg-blue-900/30'
            }`}>
              {getStatusIcon()}
            </div>
          )}
        </motion.div>

        {/* Título */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
        >
          {getStatusTitle()}
        </motion.h1>

        {/* Mensagem */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed"
        >
          {getStatusMessage()}
        </motion.p>

        {/* Dicas importantes */}
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
        )}

        {/* Botões de ação */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          {/* Botão de reenvio */}
          {(status === 'pending' || status === 'error' || status === 'expired') && email && (
            <button
              onClick={handleResendEmail}
              disabled={loading || resendCooldown > 0}
              className={`w-full py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                loading || resendCooldown > 0
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105'
              }`}
            >
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {resendCooldown > 0 
                ? `Aguarde ${resendCooldown}s para reenviar`
                : loading 
                  ? 'Reenviando...'
                  : 'Reenviar email de confirmação'
              }
            </button>
          )}

          {/* Botão de voltar */}
          {onBackToAuth && (
            <button
              onClick={onBackToAuth}
              className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-200 font-medium flex items-center justify-center gap-2 hover:scale-105"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </button>
          )}

          {/* Botão para ir ao login (quando não há callback) */}
          {!onBackToAuth && status !== 'success' && (
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-200 font-medium flex items-center justify-center gap-2 hover:scale-105"
            >
              <ArrowLeft className="w-4 h-4" />
              Ir para o login
            </button>
          )}
        </motion.div>

        {/* Barra de progresso para sucesso */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6"
          >
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-green-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2 }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Redirecionando automaticamente...
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}