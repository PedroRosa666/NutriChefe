import type { ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, CalendarRange, Home, ShoppingCart, User, Users } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';
import { SMOOTH } from '../../lib/motion';
import { cn } from '../../lib/utils';

interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}

/** Barra fixa embaixo no celular (só logado): atalhos para o que se usa todo dia. */
export function MobileNav() {
  const user = useAuthStore((s) => s.user);
  const { pathname, search } = useLocation();
  const t = useTranslation();
  if (!user) return null;

  const tab = new URLSearchParams(search).get('tab');
  const onProfile = pathname === '/perfil';
  const isHome = pathname === '/' || pathname.startsWith('/receita/');

  const items: NavItem[] =
    user.type === 'Nutritionist'
      ? [
          { key: 'home', to: '/', label: t.nav.home, icon: Home, active: isHome },
          { key: 'patients', to: '/perfil?tab=patients', label: t.nav.patients, icon: Users, active: onProfile && tab === 'patients' },
          { key: 'ai', to: '/mentoria-ia', label: t.nav.ai, icon: Bot, active: pathname === '/mentoria-ia' },
          { key: 'profile', to: '/perfil', label: t.nav.profile, icon: User, active: onProfile && tab !== 'patients' },
        ]
      : [
          { key: 'home', to: '/', label: t.nav.home, icon: Home, active: isHome },
          { key: 'plan', to: '/perfil?tab=plan', label: t.nav.plan, icon: CalendarRange, active: onProfile && tab === 'plan' },
          { key: 'shopping', to: '/perfil?tab=shopping', label: t.nav.shopping, icon: ShoppingCart, active: onProfile && tab === 'shopping' },
          { key: 'ai', to: '/mentoria-ia', label: t.nav.ai, icon: Bot, active: pathname === '/mentoria-ia' },
          { key: 'profile', to: '/perfil', label: t.nav.profile, icon: User, active: onProfile && !['plan', 'shopping'].includes(tab ?? '') },
        ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-[rgb(var(--nc-top)/0.85)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md backdrop-saturate-150 md:hidden dark:border-white/10"
      aria-label="Menu"
    >
      <ul className="flex">
        {items.map(({ key, to, label, icon: Icon, active }) => (
          <li key={key} className="flex-1">
            <Link
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {active && <motion.span layoutId="mobile-nav-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500" transition={SMOOTH} />}
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
