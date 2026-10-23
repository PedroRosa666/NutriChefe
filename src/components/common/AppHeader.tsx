import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Bot, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useCanUseAI, usePremiumStore } from '../../store/premium';
import { useAppNav } from '../../hooks/useAppNav';
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
  const t = useTranslation();
  const navigate = useNavigate();
  if (!user) return null;
  const isNutritionist = user.type === 'Nutritionist';

  return (
    <header className="sticky top-0 z-40 bg-[rgb(var(--nc-top)/0.72)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 md:h-16 lg:px-8">
        <Link to="/perfil" className="text-xl font-bold text-emerald-600 md:text-2xl dark:text-emerald-400">
          NutriChef
        </Link>

        <nav aria-label="Menu" className="ml-4 hidden items-center gap-1 md:flex">
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
                <span className="min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* O paciente chega às receitas por aqui (na barra de baixo ficam as tarefas do dia). */}
          {!isNutritionist && (
            <Link to="/" className={cn(iconButton, 'md:w-auto md:gap-1.5 md:px-3 md:text-sm md:font-medium')} title={t.nav.recipes} aria-label={t.nav.recipes}>
              <BookOpen className="h-5 w-5 md:h-4 md:w-4" />
              <span className="hidden md:inline">{t.nav.recipes}</span>
            </Link>
          )}
          {canUseAI && (
            <Link to="/mentoria-ia" className={iconButton} title={t.labels.aiMentoring} aria-label={t.labels.aiMentoring}>
              <Bot className="h-5 w-5" />
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={iconButton} title="Admin" aria-label="Admin">
              <ShieldCheck className="h-5 w-5" />
            </Link>
          )}
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
