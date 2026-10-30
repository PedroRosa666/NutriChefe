import { useState, useRef, useEffect, type ComponentType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, User as UserIcon, Bot, Users, ChevronDown, ChevronRight, ShieldCheck, X } from 'lucide-react';
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

  // Menu do celular: fecha ao trocar de página, com Esc e antes de cada ação.
  useEffect(() => setIsMobileMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);
  const closeMenuAnd = (action: () => void) => {
    setIsMobileMenuOpen(false);
    action();
  };
  const menuRow = (Icon: ComponentType<{ className?: string }>, label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/5"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-400" />
    </button>
  );

  // Busca do celular (lupa no topo). Começa aberta quando já há busca, ou quando outra página
  // mandou para cá com ?buscar=1 (a lupa do cabeçalho das outras páginas).
  const [isSearchOpen, setIsSearchOpen] = useState(() => !!useFiltersStore.getState().searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wantsSearch = new URLSearchParams(location.search).has('buscar');
  useEffect(() => {
    if (!wantsSearch) return;
    setIsSearchOpen(true);
    navigate('/', { replace: true });
  }, [wantsSearch, navigate]);
  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus({ preventScroll: true });
  }, [isSearchOpen]);
  const changeSearch = (value: string) => {
    // Na primeira letra, desce até a lista: as receitas compatíveis aparecem enquanto digita.
    if (!searchQuery && value) {
      if (location.pathname !== '/') navigate('/');
      requestAnimationFrame(() => document.getElementById('lista-receitas')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    setSearchQuery(value);
  };
  return (
    <>
      {/* Menu do celular aberto: a página escurece por trás e um toque fora fecha. */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] md:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mesmo tom do topo do degradê, translúcido: sem corte entre cabeçalho e página. */}
      {/* Com a busca aberta o topo fica opaco e com sombra: as receitas rolando por baixo não aparecem
          através do campo (antes, translúcido, parecia que cartão e busca estavam encavalados). */}
      <header
        className={cn(
          'sticky top-0 z-50 backdrop-blur-md backdrop-saturate-150 transition-[background-color,box-shadow] duration-200',
          isSearchOpen
            ? 'bg-[rgb(var(--nc-top)/0.97)] shadow-lg shadow-slate-900/10 md:bg-[rgb(var(--nc-top)/0.72)] md:shadow-none dark:shadow-black/30'
            : 'bg-[rgb(var(--nc-top)/0.72)]'
        )}
      >
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
                  onChange={(e) => changeSearch(e.target.value)}
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

            {/* No celular: busca, sino e menu (tema e idioma ficam dentro do menu). */}
            <div className="md:hidden flex items-center gap-1">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSearchOpen((open) => !open);
                }}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isSearchOpen || searchQuery
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
                aria-label={t.common.search}
                aria-expanded={isSearchOpen}
              >
                <Search className="h-5 w-5" />
              </button>
              <NotificationBell />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Busca do celular: abre pela lupa, fica presa no topo e filtra as receitas enquanto digita. */}
        <AnimatePresence initial={false}>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden md:hidden"
            >
              {/* Folga em cima e embaixo: o campo não encosta na linha dos ícones (nem corta o contorno de foco). */}
              <div className="border-t border-slate-200/60 px-4 pb-3 pt-2.5 dark:border-white/10">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={(e) => changeSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setIsSearchOpen(false);
                    }}
                    placeholder={t.common.search}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-emerald-500 dark:border-white/10 dark:focus:border-emerald-400 dark:bg-[rgb(var(--nc-top))] dark:text-white dark:placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
                      aria-label={t.profileUi.clearSearch}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isMobileMenuOpen && (
            // Cartão flutuante sobre a página (antes era uma faixa da mesma cor do fundo, sem limite visível).
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ transformOrigin: 'top right' }}
              className="md:hidden absolute inset-x-3 top-full mt-1 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200/80 bg-white p-3 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-[rgb(var(--nc-top))] dark:shadow-black/50"
            >
              {isAuthenticated ? (
                <div className="space-y-3">
                  {/* Quem está logado, com atalho para o perfil */}
                  <button
                    onClick={() => closeMenuAnd(onProfileClick)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 p-3 text-left text-white shadow-sm"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/20 text-sm font-bold">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user?.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || '?'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{user?.name}</p>
                      <p className="truncate text-xs text-emerald-50/90">{user?.email}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-white/80" />
                  </button>

                  <nav className="overflow-hidden rounded-2xl border border-slate-100 dark:border-white/10">
                    {homeItem && menuRow(homeItem.icon, homeItem.label, () => closeMenuAnd(() => navigate(homeItem.to)))}
                    {!isNutritionistUser && menuRow(Users, t.buttons.findNutritionists, () => closeMenuAnd(() => navigate('/nutricionistas')))}
                    {hasAIAccess && menuRow(Bot, t.labels.aiMentoring, () => closeMenuAnd(onAIMentoringClick))}
                    {isAdmin && menuRow(ShieldCheck, 'Admin', () => closeMenuAnd(() => navigate('/admin')))}
                    {menuRow(UserIcon, t.common.profile, () => closeMenuAnd(onProfileClick))}
                  </nav>

                  <AppearanceSettings />

                  <button
                    onClick={() => closeMenuAnd(signOut)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.common.signOut}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <AppearanceSettings />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => closeMenuAnd(() => handleOpenAuth('signin'))}
                      className="rounded-2xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    >
                      {t.common.signIn}
                    </button>
                    <button
                      onClick={() => closeMenuAnd(() => handleOpenAuth('signup'))}
                      className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      {t.common.signUp}
                    </button>
                  </div>
                </div>
              )}
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