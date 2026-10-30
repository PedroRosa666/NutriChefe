import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield, Loader2 } from 'lucide-react';
import { validateRecoveryToken, updatePassword } from '../../services/database';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { feedback } from '../../lib/i18n/current';

export function ResetPasswordPage() {
  const t = useTranslation();
  const rp = t.feedback.resetPassword;
  const navigate = useNavigate();
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
    // Verificar se há um token de recuperação válido na URL
    const checkToken = async () => {
      try {
        console.log('Checking recovery token...');
        const result = await validateRecoveryToken();
        
        if (!result.valid) {
          setStatus('error');
          setError(feedback().resetPassword.invalidLinkError);
          setValidToken(false);
        } else {
          console.log('Valid recovery token found');
          setValidToken(true);
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setStatus('error');
        setError(feedback().resetPassword.validateError);
        setValidToken(false);
      } finally {
        setInitialLoading(false);
      }
    };

    checkToken();
  }, []);

  // Senha trocada: leva ao início depois da barra de progresso (3 s).
  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => navigate('/', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [status, navigate]);

  const validatePassword = (pwd: string) => {
    const errors: string[] = [];
    if (pwd.length < 6) errors.push(rp.tooShort);
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validações
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0]);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(rp.mismatch);
      setLoading(false);
      return;
    }

    try {
      // Atualizar a senha
      await updatePassword(password);
      
      // A pessoa continua conectada com a senha nova. Sair aqui remontava esta tela (o layout
      // troca de chave com o usuário), que revalidava o link já sem sessão e mostrava "link expirado".
      setStatus('success');
    } catch (err) {
      console.error('Password reset error:', err);
      // Mantém o formulário: o link continua válido e o usuário pode tentar outra senha.
      setError(err instanceof Error && err.message ? err.message : rp.unexpectedError);
    } finally {
      setLoading(false);
    }
  };

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
  const strengthLabels = rp.strengthLabels;

  // Loading inicial
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8 text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {rp.checkingTitle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {rp.checkingText}
          </p>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8 text-center"
        >
          <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {rp.successTitle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {rp.successText}
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
            <motion.div
              className="bg-emerald-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 3 }}
            />
          </div>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            {rp.goHome}
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'error' || !validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8 text-center"
        >
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {rp.invalidTitle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || rp.invalidText}
          </p>
          <button
            onClick={() => navigate('/forgot-password', { replace: true })}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            {rp.requestNewLink}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-8"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <Lock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {rp.newPassword}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {rp.subtitle}
            </p>
          </div>
        </div>

        {/* Dicas de segurança */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                {rp.tipsTitle}
              </h3>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                {rp.tips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {rp.newPassword}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                placeholder={rp.newPasswordPlaceholder}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
                aria-pressed={showPassword}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {password && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        strengthColors[Math.max(0, passwordStrength - 1)]
                      )}
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {strengthLabels[Math.max(0, passwordStrength - 1)]}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {rp.confirmPassword}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                placeholder={rp.confirmPasswordPlaceholder}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? t.common.hidePassword : t.common.showPassword}
                aria-pressed={showConfirmPassword}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {rp.mismatch}
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || password !== confirmPassword || password.length < 6}
            className={cn(
              "w-full py-2.5 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2",
              loading || password !== confirmPassword || password.length < 6
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? rp.resetting : rp.reset}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/', { replace: true })}
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
            disabled={loading}
          >
            {rp.cancel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
