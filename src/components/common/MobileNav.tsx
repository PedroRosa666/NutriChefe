import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppNav } from '../../hooks/useAppNav';
import { SMOOTH } from '../../lib/motion';
import { cn } from '../../lib/utils';

/** Barra fixa embaixo no celular (só logado): atalhos para o que se usa todo dia. */
export function MobileNav() {
  const items = useAppNav();
  if (!items.length) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-[rgb(var(--nc-top)/0.85)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md backdrop-saturate-150 md:hidden dark:border-white/10"
      aria-label="Menu"
    >
      <ul className="flex">
        {items.map(({ key, to, label, icon: Icon, active, badge }) => (
          <li key={key} className="flex-1">
            <Link
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {active && <motion.span layoutId="mobile-nav-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500" transition={SMOOTH} />}
              <span className="relative">
                <Icon className="h-5 w-5" />
                {!!badge && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
