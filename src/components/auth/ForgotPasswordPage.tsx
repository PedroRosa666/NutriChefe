import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle, Leaf, Loader2, Mail, MailCheck } from 'lucide-react';
import { sendPasswordResetEmail } from '../../services/database';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

// O Supabase só aceita um novo envio para o mesmo e-mail a cada 60 segundos.
const COOLDOWN_SECONDS = 60;

export function ForgotPasswordPage() {
  const t = useTranslation();
  const fp = t.feedback.forgotPassword;
  const navigate = useNavigate();
  // O e-mail digitado no login chega pelo estado da navegação (nunca pela URL).
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async (address: string) => {
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(address);
      setSentTo(address);
      setCooldown(COOLDOWN_SECONDS);
      return true;
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err instanceof Error && err.message === fp.rateLimited ? fp.rateLimited : fp.pageSendError);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResent(false);
    await send(email.trim().toLowerCase());
  };

  const handleResend = async () => {
    setResent(false);
    if (await send(sentTo)) setResent(true);
  };

  const useOtherEmail = () => {
    setSentTo('');
    setResent(false);
    setError('');
  };

  const errorBox = error && (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/40">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-100/70 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400" />

        <div className="px-6 pb-6 pt-5 sm:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="-ml-2 mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {fp.backHome}
          </button>

          {sentTo ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <MailCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{fp.sentTitle}</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {fp.sentText.split('{email}')[0]}
                <span className="font-semibold text-slate-900 dark:text-slate-50">{sentTo}</span>
                {fp.sentText.split('{email}')[1]}
              </p>
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                {fp.spamHint}
              </p>

              {errorBox && <div className="mt-4 text-left">{errorBox}</div>}
              {resent && !error && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="h-4 w-4" />
                  {fp.resent}
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                {fp.backHome}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {cooldown > 0 ? fp.resendIn.replace('{seconds}', String(cooldown)) : fp.resend}
              </button>
              <button
                type="button"
                onClick={useOtherEmail}
                className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {fp.otherEmail}
              </button>
            </motion.div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <Leaf className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                    NutriChef
                  </span>
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{fp.title}</h1>
                </div>
              </div>
              <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{fp.pageSubtitle}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-100">
                    {fp.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.feedback.auth.emailPlaceholder}
                      required
                      disabled={loading}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                    />
                  </div>
                </div>

                {errorBox}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400',
                    loading && 'opacity-80'
                  )}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? fp.sending : fp.sendLink}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
                {fp.rememberPrompt}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="ml-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {t.common.signIn}
                </button>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
