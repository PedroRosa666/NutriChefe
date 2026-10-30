import { Link, useNavigate } from 'react-router-dom';
import { Bot, Search, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCanUseAI, usePremiumStore } from '../../store/premium';
import { useAppNav, useAppRole } from '../../hooks/useAppNav';
import { useTranslation } from '../../hooks/useTranslation';
import { NotificationBell } from './NotificationBell';
import { ThemeSwitch } from './ThemeSwitch';
import { UserDropdown } from '../Header';
import { cn } from '../../lib/utils';

const iconButton =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400';

/**
 * Cabeçalho das páginas logadas fora da home: marca, navegação principal (no computador),
 * sino e conta. No celular a navegação fica na barra de baixo; aqui sobram atalhos.
 */
export function AppHeader() {
  const { user, signOut } = useAuthStore();
  const items = useAppNav();
  const canUseAI = useCanUseAI();
  const isAdmin = usePremiumStore((s) => s.isAdmin);
  const role = useAppRole();
  const t = useTranslation();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 bg-[rgb(var(--nc-top)/0.97)] md:bg-[rgb(var(--nc-top)/0.72)] md:backdrop-blur-md md:backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 md:h-16 lg:px-8">
        <Link to="/" className="text-xl font-bold text-emerald-600 md:text-2xl dark:text-emerald-400">
          NutriChef
        </Link>

        <nav aria-label={t.common.mainNav} className="ml-4 hidden items-center gap-1 md:flex">
          {items.map(({ key, to, label, icon: Icon, active, badge }) => (
            <Link
              key={key}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden lg:inline">{label}</span>
              {!!badge && (
                <span className="min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[11px] font-bold leading-[18px] text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {canUseAI && (
            <Link to="/mentoria-ia" className={iconButton} title={t.labels.aiMentoring} aria-label={t.labels.aiMentoring}>
              <Bot className="h-5 w-5" />
            </Link>
          )}
          {/* Na conta só de admin o Admin já está na navegação. */}
          {isAdmin && role !== 'admin' && (
            <Link to="/admin" className={iconButton} title="Admin" aria-label="Admin">
              <ShieldCheck className="h-5 w-5" />
            </Link>
          )}
          {/* Lupa: abre a busca de receitas na home (que filtra enquanto digita). */}
          <Link to="/?buscar=1" className={iconButton} title={t.common.search} aria-label={t.common.search}>
            <Search className="h-5 w-5" />
          </Link>
          <div className="hidden md:block">
            <ThemeSwitch />
          </div>
          <NotificationBell />
          <div className="ml-1 hidden md:block">
            <UserDropdown user={user} onProfileClick={() => navigate(items[items.length - 1]?.to ?? '/perfil')} onSignOut={signOut} t={t} />
          </div>
        </div>
      </div>
    </header>
  );
}
