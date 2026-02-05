import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, CheckCircle, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { checkEmailExists, sendPasswordResetEmail } from '../../services/database';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'sent' | 'error';

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const t = useTranslation();

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.toLowerCase().trim();

    if (!trimmedEmail) {
      setError('Por favor, digite seu email.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Por favor, digite um email valido.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const emailExists = await checkEmailExists(trimmedEmail);

      if (!emailExists) {
        setError('Email nao encontrado. Verifique se o email esta correto ou crie uma conta.');
        setStep('error');
        return;
      }

      await sendPasswordResetEmail(trimmedEmail);
      setStep('sent');
    } catch (err: any) {
      let friendlyMessage = 'Erro ao enviar email de recuperacao. Tente novamente em alguns minutos.';
      if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setStep('email');
    setError('');
    setLoading(false);
    onClose();
  };

  const handleRetry = () => {
    setStep('email');
    setError('');
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl bg-white/95 shadow-2xl dark:bg-slate-900/95 border border-slate-100/70 dark:border-slate-800"
      >
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {step === 'email' && (
          <>
            <div className="flex items-center gap-3 px-6 pt-6 pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                  NutriChef
                </span>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {t.common.forgotPassword}
                </h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 px-6 pb-6 pt-4 dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-100"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    id="forgot-email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                    placeholder="seu@email.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={cn(
                  'inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-base font-semibold text-white shadow-sm transition',
                  loading || !email.trim()
                    ? 'bg-slate-300 cursor-not-allowed dark:bg-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Voltar ao login
              </button>
            </form>
          </>
        )}

        {step === 'sent' && (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Email enviado!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
              Enviamos um link para <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>. Verifique sua caixa de entrada e spam.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleClose}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                {t.common.close}
              </button>
              <button
                onClick={handleRetry}
                className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                Enviar novamente
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-7 w-7 text-red-500 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
              Algo deu errado
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
              {error}
            </p>
            <div className="space-y-2">
              <button
                onClick={handleRetry}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                Tentar novamente
              </button>
              <button
                onClick={handleClose}
                className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
