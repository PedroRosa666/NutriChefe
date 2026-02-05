import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { updatePassword } from '../../services/database';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidToken(true);
        setInitialLoading(false);
      }
    });

    const timeout = setTimeout(async () => {
      if (!validToken) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setValidToken(true);
        } else {
          setStatus('error');
          setError('Link de recuperacao invalido ou expirado. Solicite um novo link.');
        }
        setInitialLoading(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.match(/[a-z]/)) strength++;
    if (pwd.match(/[A-Z]/)) strength++;
    if (pwd.match(/[0-9]/)) strength++;
    if (pwd.match(/[^a-zA-Z0-9]/)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-sky-500', 'bg-emerald-500'];
  const strengthLabels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.');
      setLoading(false);
      return;
    }

    try {
      await updatePassword(password);
      setStatus('success');

      setTimeout(async () => {
        await supabase.auth.signOut();
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado. Tente novamente.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-slate-100/70 dark:border-slate-800 shadow-2xl max-w-md w-full p-8 text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
            Verificando link...
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aguarde enquanto validamos seu link de recuperacao.
          </p>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-slate-100/70 dark:border-slate-800 shadow-2xl max-w-md w-full px-6 py-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
            <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
            Senha redefinida!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
            Sua senha foi alterada com sucesso. Voce sera redirecionado para o login.
          </p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-5">
            <motion.div
              className="bg-emerald-600 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
            />
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Ir para login
          </button>
        </motion.div>
      </div>
    );
  }

  if ((status === 'error' && !validToken) || !validToken) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-slate-100/70 dark:border-slate-800 shadow-2xl max-w-md w-full px-6 py-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-7 w-7 text-red-500 dark:text-red-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
            Link invalido ou expirado
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
            {error || 'Este link de recuperacao e invalido ou expirou. Solicite um novo link.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Voltar ao login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/95 dark:bg-slate-900/95 rounded-2xl border border-slate-100/70 dark:border-slate-800 shadow-2xl max-w-md w-full"
      >
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
              NutriChef
            </span>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Nova senha
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 px-6 pb-6 pt-4 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Digite sua nova senha abaixo.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-100">
              Nova senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                placeholder="Sua nova senha"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {password && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      strengthColors[Math.max(0, passwordStrength - 1)]
                    )}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {strengthLabels[Math.max(0, passwordStrength - 1)]}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-100">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                placeholder="Confirme a nova senha"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                As senhas nao coincidem
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password !== confirmPassword || passwordStrength < 2 || !password}
            className={cn(
              'inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-base font-semibold text-white shadow-sm transition',
              loading || password !== confirmPassword || passwordStrength < 2 || !password
                ? 'bg-slate-300 cursor-not-allowed dark:bg-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>

          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            disabled={loading}
          >
            Voltar ao login
          </button>
        </form>
      </motion.div>
    </div>
  );
}
