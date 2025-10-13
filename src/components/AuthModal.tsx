import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
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

function GoogleIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path fill="#EA4335" d="M12 10.8v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.7-4.1 2.7-6.9 0-.7-.1-1.3-.2-2H12z" />
      <path fill="#34A853" d="M6.5 14.3l-.8.6-2.5 1.9C4.9 20.9 8.2 23 12 23c2.4 0 4.5-.8 6-2.3l-3.1-2.4c-.8.6-1.8 1-2.9 1-2.3 0-4.3-1.6-5-3.7z" />
      <path fill="#4A90E2" d="M3.2 7.2C2.4 8.7 2 10.3 2 12s.4 3.3 1.2 4.8l3.3-2.5C6.2 13.5 6 12.8 6 12s.2-1.5.5-2.2L3.2 7.2z" />
      <path fill="#FBBC05" d="M12 5c1.3 0 2.5.5 3.4 1.4l2.5-2.5C16.5 2.4 14.4 1.5 12 1.5c-3.8 0-7.1 2.1-8.9 5.3l3.3 2.6C7.7 7 9.7 5 12 5z" />
    </svg>
  );
}

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
  const { signIn, signUp, signInWithGoogle, authLoading } = useAuthStore((state) => ({
    signIn: state.signIn,
    signUp: state.signUp,
    signInWithGoogle: state.signInWithGoogle,
    authLoading: state.loading
  }));

  // === 🔧 Sincroniza o modo sempre que o modal abrir ===
  useEffect(() => {
    if (!isOpen) return;
    // 1) se a prop vier, respeita a prop
    let nextMode: 'signin' | 'signup' = initialMode;
    // 2) senão, usa o último modo persistido (se existir)
    try {
      const persisted = localStorage.getItem(AUTH_MODE_KEY) as 'signin' | 'signup' | null;
      if (!initialMode && persisted) nextMode = persisted;
    } catch { /* ignore */ }
    setMode(nextMode);
  }, [isOpen, initialMode]);

  // Persiste a escolha do usuário
  useEffect(() => {
    try {
      localStorage.setItem(AUTH_MODE_KEY, mode);
    } catch { /* ignore */ }
  }, [mode]);

  // Abas
  const isSignup = mode === 'signup';

  if (!isOpen) return null;
@@ -161,58 +181,84 @@ export function AuthModal({ isOpen, onClose, initialMode = 'signin' }: AuthModal
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                required
              />
            </div>

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
              disabled={loading || authLoading}
              className={cn(
                'w-full py-2 rounded-lg text-white font-medium transition-colors',
                loading
                loading || authLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              )}
            >
              {loading ? t.common.loading : mode === 'signin' ? t.common.signIn : t.common.signUp}
              {loading || authLoading ? t.common.loading : mode === 'signin' ? t.common.signIn : t.common.signUp}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <span className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800">
                  {t.common.orContinue}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={authLoading}
              className={cn(
                'w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-600 rounded-lg py-2 font-medium transition-colors',
                authLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-white'
              )}
            >
              <GoogleIcon />
              {t.common.continueWithGoogle}
            </button>
          </form>

          {/* Troca rápida no rodapé (mantida) */}
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