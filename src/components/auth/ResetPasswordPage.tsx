import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield, Loader2 } from 'lucide-react';
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
    const checkToken = async () => {
      try {
        const hash = window.location.hash;

        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token') || '';
          const refresh_token = params.get('refresh_token') || '';
          const type = params.get('type');

          if (type === 'recovery' && access_token) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
            if (sessionError) {
              setStatus('error');
              setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
            } else {
              setValidToken(true);
            }
            setInitialLoading(false);
            return;
          }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) {
            setStatus('error');
            setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
          } else {
            setValidToken(true);
          }
          setInitialLoading(false);
          return;
        }

        setStatus('error');
        setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
        setInitialLoading(false);
      } catch {
        setStatus('error');
        setError('Erro ao validar link de recuperação. Tente novamente.');
        setInitialLoading(false);
      }
    };

    checkToken();
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
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'];
  const strengthLabels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Erro ao redefinir senha. Tente novamente.');
        return;
      }

      setStatus('success');
      setTimeout(async () => {
        await supabase.auth.signOut();
        setTimeout(() => { window.location.href = '/'; }, 2000);
      }, 1000);
    } catch {
      setError('Erro inesperado. Tente novamente.');
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
          className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 text-center shadow-xl border border-slate-100 dark:border-slate-800"
        >
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-600" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Verificando link...
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Aguarde enquanto validamos seu link de recuperação.
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
          className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 text-center shadow-xl border border-slate-100 dark:border-slate-800"
        >
          <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            Senha redefinida!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
            Sua senha foi alterada com sucesso. Você será redirecionado para a página inicial em instantes.
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-6">
            <motion.div
              className="bg-emerald-600 h-1.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
            />
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
          >
            Ir para o início agora
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'error' || !validToken) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 text-center shadow-xl border border-slate-100 dark:border-slate-800"
        >
          <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-5">
            <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            Link inválido ou expirado
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
            {error || 'Este link de recuperação é inválido ou já expirou. Solicite um novo link de recuperação.'}
          </p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm"
          >
            Voltar ao início
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
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-8 shadow-xl border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Nova senha
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Crie uma senha segura para sua conta
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-3 mb-6">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <p className="font-medium text-slate-600 dark:text-slate-300">Dicas para uma senha segura:</p>
              <p>Mínimo de 6 caracteres, com letras e números</p>
              <p>Inclua símbolos para maior proteção</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-slate-900 dark:text-slate-50 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40 transition"
                placeholder="Mínimo 6 caracteres"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div
                    className={cn('h-1.5 rounded-full transition-all duration-300', strengthColors[Math.max(0, passwordStrength - 1)])}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 w-20 text-right">
                  {strengthLabels[Math.max(0, passwordStrength - 1)]}
                </span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirmar senha
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 pr-10 text-slate-900 dark:text-slate-50 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40 transition"
                placeholder="Repita a nova senha"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">As senhas não coincidem</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || password !== confirmPassword}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition',
              loading || !password || password !== confirmPassword
                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition font-medium"
            disabled={loading}
          >
            Voltar ao início
          </button>
        </div>
      </motion.div>
    </div>
  );
}
