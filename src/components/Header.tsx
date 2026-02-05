import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, User as UserIcon, Bot, Users, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/auth';
import { useSubscriptionStore } from '../store/subscription';
import { useFiltersStore } from '../store/filters';
import { AuthModal } from './AuthModal';
import { ThemeSwitch } from './common/ThemeSwitch';
import { LanguageSwitch } from './common/LanguageSwitch';
import { useTranslation } from '../hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../types/user';

interface UserDropdownProps {
  user: User | null;
  onProfileClick: () => void;
  onSignOut: () => void;
  t: any;
}

function UserDropdown({ user, onProfileClick, onSignOut, t }: UserDropdownProps) {
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
  const { user, isAuthenticated, signOut, isNutritionist } = useAuthStore();
  const { hasFeatureAccess } = useSubscriptionStore();
  const { searchQuery, setSearchQuery } = useFiltersStore();
  const t = useTranslation();

  const handleOpenAuth = (mode: 'signin' | 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  // Verificar se tem acesso à IA (nutricionista ou premium)
  const hasAIAccess = isAuthenticated && (isNutritionist() || hasFeatureAccess('ai_mentoring'));
  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <motion.h1 
                className="text-2xl font-bold text-green-600 dark:text-green-400 cursor-pointer"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                NutriChef
              </motion.h1>
            </div>
            
            <div className="hidden md:block flex-1 max-w-2xl mx-8">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.common.search}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  <button
                    onClick={() => navigate('/nutricionistas')}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    title={t.buttons.findNutritionists}
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden xl:inline">{t.buttons.findNutritionists}</span>
                  </button>
                  <button
                    onClick={onAIMentoringClick}
                    className={cn(
                      "relative flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      hasAIAccess
                        ? "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        : "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                    title={hasAIAccess ? t.labels.aiMentoring : `${t.labels.aiMentoring} (${t.labels.premium})`}
                  >
                    <Bot className="w-4 h-4" />
                    <span className="hidden xl:inline">{t.labels.aiMentoring}</span>
                    {!hasAIAccess && (
                      <span className="absolute -top-1 -right-1 text-[10px] bg-yellow-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        {t.labels.premium}
                      </span>
                    )}
                  </button>

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
                    className="px-4 py-2 rounded-lg text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t.common.signIn}
                  </motion.button>
                  <motion.button
                    onClick={() => handleOpenAuth('signup')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t.common.signUp}
                  </motion.button>
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center gap-4">
              <ThemeSwitch />
              <LanguageSwitch />
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.common.search}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
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

                    <button
                      onClick={() => {
                        onAIMentoringClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors relative",
                        hasAIAccess
                          ? "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          : "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                    >
                      <Bot className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.labels.aiMentoring}</span>
                      {!hasAIAccess && (
                        <span className="ml-auto text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full font-bold">
                          {t.labels.premium}
                        </span>
                      )}
                    </button>

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
                      className="w-full px-4 py-2 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    >
                      {t.common.signIn}
                    </button>
                    <button
                      onClick={() => {
                        handleOpenAuth('signup');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
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
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  );
}