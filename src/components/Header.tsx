import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, User as UserIcon, Bot, Users, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Translations } from '../hooks/useTranslation';
import { useAuthStore } from '../store/auth';
import { useFiltersStore } from '../store/filters';
import { AuthModal } from './AuthModal';
import { AppearanceSettings, ThemeSwitch } from './common/ThemeSwitch';
import { LanguageSwitch } from './common/LanguageSwitch';
import { NotificationBell } from './common/NotificationBell';
import { useTranslation } from '../hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../types/user';
import { useCanUseAI, usePremiumStore } from '../store/premium';
import { useAppNav } from '../hooks/useAppNav';

interface UserDropdownProps {
  user: User | null;
  onProfileClick: () => void;
  onSignOut: () => void;
  t: Translations;
}

export function UserDropdown({ user, onProfileClick, onSignOut, t }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserInitials = () => {
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-sm">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name || 'User'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-bold text-xs">
              {getUserInitials()}
            </span>
          )}
        </div>
        <span className="hidden lg:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
          {user?.name}
        </span>
        <ChevronDown className={cn(
          "hidden lg:block w-4 h-4 text-gray-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>

            <button
              onClick={() => {
                onProfileClick();
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <UserIcon className="w-4 h-4" />
              <span>{t.common.profile}</span>
            </button>

            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

            <button
              onClick={() => {
                onSignOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.common.signOut}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface HeaderProps {
  onProfileClick: () => void;
  onAIMentoringClick: () => void;
}

export function Header({ onProfileClick, onAIMentoringClick }: HeaderProps) {
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuthStore();
  const canUseAI = useCanUseAI();
  const isAdmin = usePremiumStore((s) => s.isAdmin);
  const { searchQuery, setSearchQuery } = useFiltersStore();
  const t = useTranslation();

  const handleOpenAuth = (mode: 'signin' | 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  // /login (e /login?modo=cadastro) abre o modal; depois do login volta para ?next= (ex.: link de convite).
  const location = useLocation();
  const onLoginRoute = location.pathname === '/login';
  useEffect(() => {
    if (!onLoginRoute) return;
    if (isAuthenticated) {
      const next = new URLSearchParams(location.search).get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
      return;
    }
    setAuthModalMode(new URLSearchParams(location.search).get('modo') === 'cadastro' ? 'signup' : 'signin');
    setIsAuthModalOpen(true);
  }, [onLoginRoute, isAuthenticated, location.search, navigate]);

  // Verificar se tem acesso à IA (nutricionista ou premium)
  const hasAIAccess = isAuthenticated && canUseAI;
  const isNutritionistUser = user?.type === 'Nutritionist';
  // Atalho para o Meu dia (paciente) ou o Painel (nutricionista), que ficam fora da home.
  const homeItem = useAppNav().find((i) => i.key === 'home');
  return (
    <>
      {/* Mesmo tom do topo do degradê, translúcido: sem corte entre cabeçalho e página. */}
      <header className="sticky top-0 z-50 bg-[rgb(var(--nc-top)/0.72)] backdrop-blur-md backdrop-saturate-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <motion.h1
                onClick={() => {
                  // A marca leva ao topo da home (receitas), de onde estiver.
                  if (location.pathname !== '/') navigate('/');
                  else window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                NutriChef
              </motion.h1>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-white dark:text-slate-900"
                >
                  Admin
                </Link>
              )}
            </div>
            
            <div className="hidden md:block flex-1 max-w-2xl mx-8">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.common.search}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-2">
              <ThemeSwitch />
              <LanguageSwitch />

              {isAuthenticated ? (
                <motion.div
                  className="flex items-center space-x-2 ml-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {homeItem && (
                    <Link
                      to={homeItem.to}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                    >
                      <homeItem.icon className="w-4 h-4" />
                      <span>{homeItem.label}</span>
                    </Link>
                  )}
                  {!isNutritionistUser && (
                    <button
                      onClick={() => navigate('/nutricionistas')}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      title={t.buttons.findNutritionists}
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden xl:inline">{t.buttons.findNutritionists}</span>
                    </button>
                  )}
                  {/* A IA aparece para quem já tem; o convite ao Premium fica no Início. */}
                  {hasAIAccess && (
                    <button
                      onClick={onAIMentoringClick}
                      className="relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      title={t.labels.aiMentoring}
                    >
                      <Bot className="w-4 h-4" />
                      <span className="hidden xl:inline">{t.labels.aiMentoring}</span>
                    </button>
                  )}

                  <NotificationBell />

                  <div className="h-8 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

                  <UserDropdown
                    user={user}
                    onProfileClick={onProfileClick}
                    onSignOut={signOut}
                    t={t}
                  />
                </motion.div>
              ) : (
                <div className="flex items-center space-x-2 ml-2">
                  <motion.button
                    onClick={() => handleOpenAuth('signin')}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t.common.signIn}
                  </motion.button>
                  <motion.button
                    onClick={() => handleOpenAuth('signup')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t.common.signUp}
                  </motion.button>
                </div>
              )}
            </div>

            {/* No celular, tema e idioma ficam dentro do menu: no topo, só o sino e o menu. */}
            <div className="md:hidden flex items-center gap-1">
              <NotificationBell />
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Menu"
                aria-expanded={isMobileMenuOpen}
              >
                <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="px-4 py-3 space-y-3">
                <AppearanceSettings />
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.common.search}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>

                {isAuthenticated ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="h-10 w-10 rounded-lg overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
                        {user?.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name || 'User'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-bold text-sm">
                            {user?.name
                              ?.split(' ')
                              .map(n => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {user?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>

                    {!isNutritionistUser && (
                      <button
                        onClick={() => {
                          navigate('/nutricionistas');
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.buttons.findNutritionists}</span>
                      </button>
                    )}

                    {hasAIAccess && (
                      <button
                        onClick={() => {
                          onAIMentoringClick();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors relative text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <Bot className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.labels.aiMentoring}</span>
                      </button>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                    <button
                      onClick={() => {
                        onProfileClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.common.profile}</span>
                    </button>

                    <button
                      onClick={() => {
                        signOut();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.common.signOut}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        handleOpenAuth('signin');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      {t.common.signIn}
                    </button>
                    <button
                      onClick={() => {
                        handleOpenAuth('signup');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      {t.common.signUp}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          const signedIn = useAuthStore.getState().isAuthenticated;
          if (onLoginRoute && !signedIn) navigate('/', { replace: true });
        }}
        initialMode={authModalMode}
      />
    </>
  );
}