import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppNav } from '../../hooks/useAppNav';
import { SMOOTH } from '../../lib/motion';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

/** Barra fixa embaixo no celular (só logado): atalhos para o que se usa todo dia. */
export function MobileNav() {
  const items = useAppNav();
  const t = useTranslation();
  if (!items.length) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-[rgb(var(--nc-top)/0.97)] pb-[env(safe-area-inset-bottom)] md:hidden dark:border-white/10"
      aria-label={t.common.mainNav}
    >
      <ul className="flex">
        {items.map(({ key, to, label, icon: Icon, active, badge }) => (
          <li key={key} className="flex-1">
            <Link
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                // Altura fixa (--mobile-nav-h): o espaço do fim da página e as barras de salvar encostam nela sem fresta.
                'relative flex h-[var(--mobile-nav-h)] flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {active && <motion.span layoutId="mobile-nav-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500" transition={SMOOTH} />}
              <span className="relative">
                <Icon className="h-5 w-5" />
                {!!badge && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-rose-600 px-1 text-center text-[11px] font-bold leading-4 text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {/* Com a fonte do Android aumentada, o nome corta em vez de invadir o vizinho. */}
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
