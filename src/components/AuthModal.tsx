import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Mail, Lock, User, Shield, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';
import { EmailVerificationModal } from './auth/EmailVerificationModal';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [userType, setUserType] = useState<UserType>('Client');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const { 
    signIn, 
    signUp, 
    loading, 
    error, 
    pendingEmailVerification, 
    emailVerificationSent,
    setPendingEmailVerification,
    clearError 
  } = useAuthStore();
  const t = useTranslation();

  const isSignup = mode === 'signup';

  // Sincronizar modo com localStorage
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

  // Mostrar modal de verificação se há email pendente
  useEffect(() => {
    if (pendingEmailVerification && emailVerificationSent && !showEmailVerification) {
      setShowEmailVerification(true);
    }
  }, [pendingEmailVerification, emailVerificationSent, showEmailVerification]);

  // Limpar erro quando modal fecha
  useEffect(() => {
    if (!isOpen) {
      clearError();
      resetForm();
    }
  }, [isOpen, clearError]);

  // Calcular força da senha
  useEffect(() => {
    if (!isSignup) return;
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    setPasswordStrength(strength);
  }, [password, isSignup]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setUserType('Client');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPasswordStrength(0);
  };

  const validateForm = () => {
    if (!email.trim()) return 'Email é obrigatório';
    if (!password.trim()) return 'Senha é obrigatória';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email inválido';
    
    if (isSignup) {
      if (!name.trim()) return 'Nome é obrigatório';
      if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';
      if (password !== confirmPassword) return 'Senhas não coincidem';
      if (passwordStrength < 2) return 'Senha muito fraca. Use letras, números e símbolos';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      return;
    }

    try {
      if (isSignup) {
        await signUp(email.trim(), password, name.trim(), userType);
        // Após signup bem-sucedido, mostrar modal de verificação
        if (pendingEmailVerification) {
          setShowEmailVerification(true);
        }
      } else {
        await signIn(email.trim(), password);
        // Se login bem-sucedido e não há verificação pendente, fechar modal
        if (!pendingEmailVerification) {
          onClose();
          resetForm();
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const handleModeSwitch = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    clearError();
    resetForm();
  };

  const handleCloseEmailVerification = () => {
    setShowEmailVerification(false);
    setPendingEmailVerification(null);
  };

  const handleEmailVerificationSuccess = () => {
    setShowEmailVerification(false);
    setPendingEmailVerification(null);
    onClose();
    resetForm();
  };

  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const strengthLabels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 relative"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header com ícone */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              {isSignup ? (
                <User className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <Lock className="w-6 h-6 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {isSignup ? 'Criar conta' : 'Entrar'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSignup ? 'Junte-se à comunidade NutriChef' : 'Acesse sua conta'}
              </p>
            </div>
          </div>

          {/* Tabs de modo */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => handleModeSwitch('signin')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200",
                !isSignup
                  ? "bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              )}
              disabled={loading}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('signup')}
              className={cn(
                "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200",
                isSignup
                  ? "bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              )}
              disabled={loading}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome (apenas no signup) */}
            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.profile.name}
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Seu nome completo"
                    required={isSignup}
                    disabled={loading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tipo de usuário (apenas no signup) */}
            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.profile.accountType}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType('Client')}
                      className={cn(
                        'px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium',
                        userType === 'Client'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-green-200 dark:hover:border-green-700 text-gray-700 dark:text-gray-300'
                      )}
                      disabled={loading}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <User className="w-5 h-5" />
                        {t.profile.client}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType('Nutritionist')}
                      className={cn(
                        'px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium',
                        userType === 'Nutritionist'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-green-200 dark:hover:border-green-700 text-gray-700 dark:text-gray-300'
                      )}
                      disabled={loading}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Shield className="w-5 h-5" />
                        {t.profile.nutricionist}
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.profile.password}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  placeholder={isSignup ? "Crie uma senha segura" : "Sua senha"}
                  required
                  disabled={loading}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {/* Indicador de força da senha (apenas no signup) */}
              {isSignup && password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2"
                >
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
                </motion.div>
              )}
            </div>

            {/* Confirmar senha (apenas no signup) */}
            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Confirme sua senha"
                      required={isSignup}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {confirmPassword && password !== confirmPassword && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      As senhas não coincidem
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Link esqueci minha senha (apenas no signin) */}
            {!isSignup && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium transition-colors"
                  disabled={loading}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {/* Aviso de email pendente (apenas no signin) */}
            {!isSignup && pendingEmailVerification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                      Email não confirmado. Verifique sua caixa de entrada.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowEmailVerification(true)}
                      className="text-sm text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200 font-medium underline"
                      disabled={loading}
                    >
                      Reenviar email de confirmação
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Erro geral */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dicas de segurança (apenas no signup) */}
            {isSignup && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Dicas para uma senha segura:
                    </h3>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Pelo menos 6 caracteres</li>
                      <li>• Combine letras maiúsculas e minúsculas</li>
                      <li>• Inclua números e símbolos</li>
                      <li>• Evite informações pessoais</li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Botão de submit */}
            <motion.button
              type="submit"
              disabled={loading || (isSignup && (passwordStrength < 2 || password !== confirmPassword))}
              className={cn(
                'w-full py-3 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center gap-2',
                loading || (isSignup && (passwordStrength < 2 || password !== confirmPassword))
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 hover:scale-105'
              )}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader2 className="w-4 h-4" />
              </motion.div>}
              {loading 
                ? (isSignup ? 'Criando conta...' : 'Entrando...') 
                : (isSignup ? 'Criar conta' : 'Entrar')
              }
            </motion.button>
          </form>

          {/* Link para trocar modo */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400"
          >
            {isSignup ? 'Já tem uma conta?' : 'Não tem uma conta?'}
            <button
              type="button"
              onClick={() => handleModeSwitch(isSignup ? 'signin' : 'signup')}
              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium ml-1 transition-colors"
              disabled={loading}
            >
              {isSignup ? 'Entrar' : 'Criar conta'}
            </button>
          </motion.p>
        </motion.div>
      </div>

      {/* Modais auxiliares */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />

      <EmailVerificationModal
        isOpen={showEmailVerification}
        onClose={handleCloseEmailVerification}
        email={pendingEmailVerification || email}
        onSuccess={handleEmailVerificationSuccess}
      />
    </>
  );
}

const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
const strengthLabels = ['Muito fraca', 'Fraca', 'Regular', 'Boa', 'Forte'];