import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { sendPasswordResetEmail } from '../../services/database';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

export function ForgotPasswordPage() {
  const t = useTranslation();
  const fp = t.feedback.forgotPassword;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await sendPasswordResetEmail(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(fp.pageSendError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{fp.title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{fp.pageSubtitle}</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {fp.pageSent}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {fp.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.feedback.auth.emailPlaceholder}
              required
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className={cn(
              'w-full py-2.5 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2',
              loading || !email.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? fp.sending : fp.sendLink}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
