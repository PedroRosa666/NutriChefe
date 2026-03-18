import React, { useEffect, useState } from 'react';
import { X, Leaf, Eye, EyeOff, Mail, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';
import { cn } from '../lib/utils';
import type { UserType } from '../types/user';
import { useTranslation } from '../hooks/useTranslation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

const AUTH_MODE_KEY = 'authMode@NutriChefe';

export function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState<UserType>('Client');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const t = useTranslation();

  const { signIn, signUp, error, clearError, clearPendingConfirmation, pendingConfirmationEmail } = useAuthStore();

  const showEmailConfirmation = error === 'EMAIL_CONFIRMATION_REQUIRED';

  useEffect(() => {
    if (!isOpen) return;

    let nextMode: 'signin' | 'signup' = initialMode;

    try {
      const persisted = localStorage.getItem(AUTH_MODE_KEY) as 'signin' | 'signup' | null;
      if (!initialMode && persisted) nextMode = persisted;
    } catch {
      /* ignore */
    }

    setMode(nextMode);
  }, [isOpen, initialMode]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTH_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const isSignup = mode === 'signup';

  if (!isOpen) return null;

  const handleClose = () => {
    clearError();
    clearPendingConfirmation();
    setEmail('');
    setPassword('');
    setName('');
    setResendCooldown(0);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) handleClose();
      } else {
        await signUp(email, password, name, userType);
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) handleClose();
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !pendingConfirmationEmail) return;
    setResendLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/auth-signup-resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          email: pendingConfirmationEmail,
          redirectTo: `${window.location.origin}/confirmar-email`,
        }),
      });
      setResendCooldown(60);
    } catch {
      // silencioso
    } finally {
      setResendLoading(false);
    }
  };

  const handleBackToSignup = () => {
    clearPendingConfirmation();
    setMode('signup');
    setPassword('');
  };

  if (showEmailConfirmation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white/95 shadow-2xl dark:bg-slate-900/95 border border-slate-100/70 dark:border-slate-800">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center px-6 pt-8 pb-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 mb-4">
              <Mail className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Confirme seu e-mail
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Enviamos um link de confirmação para:
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-5 break-all">
              {pendingConfirmationEmail}
            </p>

            <div className="w-full rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 mb-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
                  <p className="font-medium">Como confirmar sua conta:</p>
                  <ol className="list-decimal list-inside space-y-1 text-emerald-700 dark:text-emerald-300">
                    <li>Abra o e-mail que enviamos</li>
                    <li>Clique no botão "Confirmar meu e-mail"</li>
                    <li>Volte aqui e faça login</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="w-full rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3 mb-6 text-left">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong>Dica:</strong> Verifique também a pasta de spam caso não encontre o e-mail na caixa de entrada.
              </p>
            </div>

            <button
              onClick={handleResendEmail}
              disabled={resendLoading || resendCooldown > 0}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition mb-3',
                resendLoading || resendCooldown > 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', resendLoading && 'animate-spin')} />
              {resendCooldown > 0
                ? `Reenviar em ${resendCooldown}s`
                : 'Reenviar e-mail de confirmação'}
            </button>

            <button
              onClick={handleBackToSignup}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              Usar outro e-mail
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white/95 shadow-2xl dark:bg-slate-900/95 border border-slate-100/70 dark:border-slate-800">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">{t.common.close}</span>
          </button>

          <div className="flex items-center gap-3 px-6 pt-6 pb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Leaf className="h-5 w-5" />
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                NutriChef
              </span>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {isSignup ? t.common.createaccount : t.common.signIn}
              </h2>
            </div>
          </div>

          <div className="px-6 pb-3">
            <div className="flex rounded-full bg-slate-100 p-1.5 text-sm dark:bg-slate-800">
              <button
                type="button"
                onClick={() => { setMode('signin'); clearError(); }}
                className={cn(
                  'flex-1 rounded-full px-3 py-1.5 font-medium transition-all',
                  mode === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                {t.common.signIn}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); clearError(); }}
                className={cn(
                  'flex-1 rounded-full px-3 py-1.5 font-medium transition-all',
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                {t.common.signUp}
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-3 border-t border-slate-100 px-6 pb-5 pt-4 dark:border-slate-800 text-sm"
          >
            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-100"
                  >
                    {t.profile.name}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={name}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-100">
                    {t.profile.accountType}
                  </label>

                  <div className="flex rounded-full bg-slate-100 p-1.5 text-sm dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setUserType('Client')}
                      className={cn(
                        'flex-1 rounded-full px-3 py-1.5 font-medium transition-all',
                        userType === 'Client'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                      )}
                    >
                      {t.profile.client}
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserType('Nutritionist')}
                      className={cn(
                        'flex-1 rounded-full px-3 py-1.5 font-medium transition-all',
                        userType === 'Nutritionist'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                      )}
                    >
                      {t.profile.nutricionist}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-100"
              >
                {t.profile.email}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-100"
              >
                {t.profile.password}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-base text-slate-900 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && error !== 'EMAIL_CONFIRMATION_REQUIRED' && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {t.common.forgotPassword}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:bg-emerald-400',
                loading && 'opacity-80'
              )}
            >
              {loading
                ? t.common.loading
                : mode === 'signin'
                ? t.common.signIn
                : t.common.signUp}
            </button>

            <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
              {mode === 'signin'
                ? t.common.dontHaveAccount
                : t.common.alreadyHaveAccount}
              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); clearError(); }}
                className="ml-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {mode === 'signin' ? t.common.signUp : t.common.signIn}
              </button>
            </p>
          </form>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
}
