import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Loader2, CheckCircle, AlertCircle, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Página de confirmação de email que trata todos os formatos do Supabase:
 * - ?code=... (novo fluxo PKCE)
 * - #access_token=...&refresh_token=... (fluxo com hash)
 * - ?token_hash=...&type=signup (fluxo legado)
 */
export default function ConfirmEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('Confirmando seu email...');
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { pendingEmailVerification, resendVerificationEmail } = useAuthStore();

  // Cooldown para reenvio
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const url = new URL(window.location.href);
        console.log('Confirming email with URL:', url.toString());

        // 1) Novo fluxo PKCE (?code=...)
        const code = url.searchParams.get('code');
        if (code) {
          console.log('Using PKCE flow with code');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('PKCE confirmation error:', error);
            throw error;
          }
          
          if (data?.user && data?.session) {
            console.log('PKCE confirmation successful');
            setStatus('success');
            setMessage('Email confirmado com sucesso! Redirecionando...');
            
            // Aguardar um momento e redirecionar
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return;
          }
        }

        // 2) Fluxo com hash (#access_token=...&refresh_token=...)
        if (window.location.hash.includes('access_token')) {
          console.log('Using hash flow');
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            
            if (error) {
              console.error('Hash session error:', error);
              throw error;
            }
            
            console.log('Hash confirmation successful');
            setStatus('success');
            setMessage('Email confirmado com sucesso! Redirecionando...');
            
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return;
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
            throw error;
          }
          
          if (data?.user) {
            console.log('Legacy confirmation successful');
            setStatus('success');
            setMessage('Email confirmado com sucesso! Redirecionando...');
            
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return;
          }
        }

        // Se chegou até aqui, não há parâmetros válidos
        console.log('No valid confirmation parameters found');
        setStatus('error');
        setMessage('Link de confirmação inválido ou malformado.');
        setCanResend(true);

      } catch (error: any) {
        console.error('Email confirmation error:', error);
        
        let friendlyMessage = 'Erro ao confirmar email';
        let newStatus: typeof status = 'error';
        
        if (error.message?.includes('expired') || error.message?.includes('token_hash_expired')) {
          friendlyMessage = 'Link de confirmação expirado. Solicite um novo email de confirmação.';
          newStatus = 'expired';
        } else if (error.message?.includes('invalid') || error.message?.includes('token_hash_invalid')) {
          friendlyMessage = 'Link de confirmação inválido. Solicite um novo email de confirmação.';
        } else if (error.message?.includes('already_confirmed')) {
          friendlyMessage = 'Email já confirmado! Você pode fazer login normalmente.';
          newStatus = 'success';
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
        
        setStatus(newStatus);
        setMessage(friendlyMessage);
        setCanResend(newStatus !== 'success');
      }
    };

    confirmEmail();
  }, []);

  const handleResendEmail = async () => {
    if (!pendingEmailVerification || resendCooldown > 0) return;

    try {
      await resendVerificationEmail(pendingEmailVerification);
      setResendCooldown(60); // 60 segundos de cooldown
    } catch (error) {
      console.error('Error resending email:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
      case 'expired':
        return <AlertCircle className="w-12 h-12 text-red-500" />;
      case 'loading':
        return <LoadingSpinner size="lg" />;
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
      case 'loading':
        return 'Confirmando email...';
      default:
        return 'Processando...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'from-green-500 to-emerald-500';
      case 'error':
      case 'expired':
        return 'from-red-500 to-rose-500';
      case 'loading':
        return 'from-blue-500 to-indigo-500';
      default:
        return 'from-gray-500 to-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8 text-center shadow-lg"
      >
        {/* Ícone de status animado */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="flex justify-center mb-6"
        >
          <div className={`p-3 bg-gradient-to-r ${getStatusColor()} rounded-full`}>
            {getStatusIcon()}
          </div>
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
          {message}
        </motion.p>

        {/* Barra de progresso para sucesso */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-6"
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

        {/* Botões de ação */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          {/* Botão de reenvio para casos de erro/expiração */}
          {canResend && pendingEmailVerification && (status === 'error' || status === 'expired') && (
            <button
              onClick={handleResendEmail}
              disabled={resendCooldown > 0}
              className={`w-full py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                resendCooldown > 0
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              {resendCooldown > 0 
                ? `Aguarde ${resendCooldown}s para reenviar`
                : 'Reenviar email de confirmação'
              }
            </button>
          )}

          {/* Botão para voltar ao login */}
          {status !== 'loading' && status !== 'success' && (
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-200 font-medium flex items-center justify-center gap-2 hover:scale-105"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </button>
          )}

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
        </motion.div>

        {/* Dicas importantes para casos de erro */}
        {(status === 'error' || status === 'expired') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
          >
            <div className="flex items-start gap-2">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Dicas importantes:
                </h3>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Verifique sua pasta de spam/lixo eletrônico</li>
                  <li>• Links de confirmação expiram em 24 horas</li>
                  <li>• Use o mesmo dispositivo/navegador se possível</li>
                  <li>• Aguarde alguns minutos para o email chegar</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}