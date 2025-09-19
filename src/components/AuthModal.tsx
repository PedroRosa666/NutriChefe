import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';
import { cn } from '../lib/utils';
import type { UserType } from '../types/user';
import { useTranslation } from '../hooks/useTranslation';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

const AUTH_MODE_KEY = 'authMode@NutriChefe';

export function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModalProps) {
  const { signIn, signUp } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('Client');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const t = useTranslation();

  // === 🔧 Sincroniza o modo sempre que o modal abrir ===
  useEffect(() => {
    if (!isOpen) return;
    let nextMode: 'signin' | 'signup' = initialMode;
    try {
      const persisted = localStorage.getItem(AUTH_MODE_KEY) as 'signin' | 'signup' | null;
      if (!initialMode && persisted) nextMode = persisted;
    } catch { /* ignore */ }
    setMode(nextMode);
  }, [isOpen, initialMode]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTH_MODE_KEY, mode);
    } catch { /* ignore */ }
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

  const handleForgotPassword = () => setShowForgotPassword(true);

  async function resendVerification() {
    if (!email) return;
    try {
      setResending(true);
      await supabase.auth.resend({ type: 'signup', email });
      alert('E-mail de verificação reenviado! Confira sua caixa de entrada.');
    } catch (e: any) {
      alert(e?.message || 'Falha ao reenviar.');
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X />
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              {isSignup ? t.common.signUp : t.common.signIn}
            </h2>
            {isSignup && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Você receberá um e-mail de confirmação. Só após confirmar terá acesso ao site.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                required
              />
            </div>

            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                  Tipo de conta
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setUserType('Client')}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 transition-colors dark:bg-white dark:text-black',
                      userType === 'Client'
                        ? 'border-green-500 bg-green-50 dark:bg-green-50 text-green-700 dark:text-green-700'
                        : 'border-gray-200 hover:border-green-200'
                    )}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('Nutritionist')}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 transition-colors dark:bg-white dark:text-black',
                      userType === 'Nutritionist'
                        ? 'border-green-500 bg-green-50 dark:bg-green-50 text-green-700 dark:text-green-700'
                        : 'border-gray-200 hover:border-green-200'
                    )}
                  >
                    Nutricionista
                  </button>
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-2 rounded-lg text-white font-medium transition-colors',
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
              )}
            >
              {loading ? t.common.loading : isSignup ? t.common.signUp : t.common.signIn}
            </button>

            {isSignup && (
              <div className="text-center text-sm text-gray-600 dark:text-gray-300">
                Não recebeu o e-mail?
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={!email || resending}
                  className="ml-1 underline"
                >
                  {resending ? 'Enviando...' : 'Reenviar verificação'}
                </button>
              </div>
            )}
          </form>

          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
            {mode === 'signin' ? t.common.dontHaveAccount : t.common.alreadyHaveAccount}
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-green-600 hover:text-green-700 font-medium ml-1"
            >
              {mode === 'signin' ? t.common.signUp : t.common.signIn}
            </button>
          </p>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
}
