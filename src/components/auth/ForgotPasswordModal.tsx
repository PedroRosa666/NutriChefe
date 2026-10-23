import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { sendPasswordResetEmail } from '../../services/database';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

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
  const fp = t.feedback.forgotPassword;

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = email.toLowerCase().trim();
    
    // Validações básicas
    if (!trimmedEmail) {
      setError(fp.emailRequired);
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError(fp.emailInvalid);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Não revelamos se o email existe (evita enumeração de contas):
      // o Supabase só envia o link quando a conta existe.
      await sendPasswordResetEmail(trimmedEmail);
      setStep('sent');
    } catch (err) {
      console.error('Password reset error:', err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : fp.sendError
      );
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

        {step === 'email' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {fp.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {fp.subtitle}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {fp.emailLabel}
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  placeholder={t.feedback.auth.emailPlaceholder}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={cn(
                  "w-full py-2.5 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2",
                  loading || !email.trim()
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? fp.checking : fp.sendLink}
              </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>{fp.tipLabel}</strong> {fp.tipText}
              </p>
            </div>
          </div>
        )}

        {step === 'sent' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {fp.sentTitle}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {fp.sentBefore}<strong>{email}</strong>{fp.sentAfter}
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{fp.importantLabel}</strong> {fp.importantText}
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {t.common.close}
              </button>
              <button
                onClick={handleRetry}
                className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
              >
                {fp.sendAgain}
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {fp.errorTitle}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {t.common.retry}
              </button>
              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
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