import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'sent' | 'not_found';

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail) { setError('Por favor, digite seu e-mail.'); return; }

    setLoading(true);
    setError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/auth-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      const result = await res.json();

      if (res.status === 404 || result.error === 'EMAIL_NOT_FOUND') {
        setStep('not_found');
        return;
      }

      if (!res.ok) {
        const isRateLimit = result.error?.includes('rate limit') || result.error?.includes('security');
        setError(isRateLimit
          ? 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
          : 'Erro ao enviar e-mail. Tente novamente em alguns minutos.');
        return;
      }

      setStep('sent');
    } catch {
      setError('Erro inesperado. Tente novamente.');
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

  const handleRetry = () => { setStep('email'); setError(''); setEmail(''); };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 relative shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>

            {step === 'email' && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                    <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Esqueci minha senha</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Enviaremos um link para redefinir sua senha</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      E-mail cadastrado
                    </label>
                    <input
                      type="email"
                      id="reset-email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-50 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40 transition"
                      placeholder="seu@email.com"
                      required
                      disabled={loading}
                      autoFocus
                      autoComplete="email"
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className={cn(
                      'w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition',
                      loading || !email.trim()
                        ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    )}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Verificando...' : 'Enviar link de recuperação'}
                  </button>
                </form>

                <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong>Dica:</strong> Verifique sua pasta de spam caso não receba o e-mail em alguns minutos.
                  </p>
                </div>
              </div>
            )}

            {step === 'sent' && (
              <div className="text-center py-2">
                <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-5">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">E-mail enviado!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-1 text-sm">Enviamos um link de recuperação para:</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 mb-5 break-all text-sm">{email}</p>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 mb-6 text-left">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
                      <p className="font-medium">Próximos passos:</p>
                      <ol className="list-decimal list-inside space-y-1 text-emerald-700 dark:text-emerald-300">
                        <li>Abra o e-mail que enviamos</li>
                        <li>Clique no link "Redefinir senha"</li>
                        <li>Crie uma nova senha segura</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleClose}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleRetry}
                    className="w-full py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition text-sm font-medium"
                  >
                    Enviar para outro e-mail
                  </button>
                </div>
              </div>
            )}

            {step === 'not_found' && (
              <div className="text-center py-2">
                <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-5">
                  <AlertCircle className="w-8 h-8 text-amber-500 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">E-mail não encontrado</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-5 text-sm">
                  Não encontramos nenhuma conta com o e-mail{' '}
                  <strong className="text-slate-700 dark:text-slate-200 break-all">{email}</strong>.
                  Verifique se digitou corretamente ou crie uma nova conta.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleRetry}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
                  >
                    Tentar com outro e-mail
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition text-sm font-medium"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
