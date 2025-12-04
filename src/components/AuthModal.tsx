import React, { useEffect, useState } from 'react';
import { X, Leaf } from 'lucide-react';
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const t = useTranslation();

  const { signIn, signUp } = useAuthStore();

  // Sincroniza o modo sempre que o modal abrir
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

  // Persiste a escolha do usuário
  useEffect(() => {
    try {
      localStorage.setItem(AUTH_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const isSignup = mode === 'signup';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password, name);
      } else {
        await signUp(email, password, name, userType);
      }
      onClose();
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white/95 shadow-2xl dark:bg-slate-900/95 border border-slate-100/70 dark:border-slate-800">
          {/* Botão fechar */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">{t.common.close}</span>
          </button>

          {/* Header com ícone e título */}
          <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Leaf className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                NutriChef
              </p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                {isSignup ? t.common.createaccount : t.common.signIn}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSignup
                  ? t.common.dontHaveAccount
                  : t.common.alreadyHaveAccount}
              </p>
            </div>

            {/* Abas Sign In / Sign Up */}
            <div className="mt-2 flex w-full rounded-full bg-slate-100 p-1 text-xs dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 font-medium transition-all',
                  mode === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                {t.common.signIn}
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 font-medium transition-all',
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                {t.common.signUp}
              </button>
            </div>
          </div>

          {/* Formulário */}
          <form
            onSubmit={handleSubmit}
            className="space-y-4 border-t border-slate-100 px-6 pb-6 pt-4 dark:border-slate-800"
          >
            {isSignup && (
              <>
                <div className="space-y-1">
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-100">
                    {t.profile.accountType}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType('Client')}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-sm transition-all dark:bg-slate-900',
                        userType === 'Client'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-100'
                          : 'border-slate-200 hover:border-emerald-200 dark:border-slate-700 dark:hover:border-emerald-500/60'
                      )}
                    >
                      <span className="font-semibold">{t.profile.client}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.home?.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType('Nutritionist')}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left text-sm transition-all dark:bg-slate-900',
                        userType === 'Nutritionist'
                          ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-100'
                          : 'border-slate-200 hover:border-emerald-200 dark:border-slate-700 dark:hover:border-emerald-500/60'
                      )}
                    >
                      <span className="font-semibold">
                        {t.profile.nutricionist}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.profile.statistics}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
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
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-100"
              >
                {t.profile.password}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              />
            </div>

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  {t.common.forgotPassword}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'mt-2 inline-flex w-full items-center justify-center rounded-xl border border-transparent bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-400 dark:focus-visible:ring-offset-slate-900',
                loading && 'opacity-80'
              )}
            >
              {loading
                ? t.common.loading
                : mode === 'signin'
                ? t.common.signIn
                : t.common.signUp}
            </button>

            {/* Rodapé com alternância extra */}
            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              {mode === 'signin'
                ? t.common.dontHaveAccount
                : t.common.alreadyHaveAccount}
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
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
