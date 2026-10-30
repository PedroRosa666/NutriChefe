import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
const COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

export interface QuickAction {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Número pequeno no canto (ex.: mensagens não lidas). */
  badge?: number;
}

/** Anel de progresso (ex.: calorias do dia frente à meta). */
export function ProgressRing({ value, max, children }: { value: number; max: number; children: ReactNode }) {
  const size = 104;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.1;
  return (
    <div className="relative h-[104px] w-[104px] flex-shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/25" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn('transition-[stroke-dashoffset] duration-700', over ? 'stroke-amber-300' : 'stroke-white')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Topo da Visão geral: saudação, resumo do dia e atalhos para o que mais se usa. */
export function DashboardHero({
  title,
  subtitle,
  aside,
  stats,
  actions,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
  /** Com `to`, o número leva à tela onde se age sobre ele. */
  stats?: { label: string; value: string; hint?: string; to?: string }[];
  actions: QuickAction[];
}) {
  const u = useTranslation().profileUi;
  // Um atalho só vira botão dentro do topo: um cartão sozinho na largura toda fica esticado em tela grande.
  const single = actions.length === 1 ? actions[0] : null;
  const SingleIcon = single?.icon;
  return (
    <section className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-700 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-6">
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-[12rem] flex-1">
            <h2 className="text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-emerald-50">{subtitle}</p>
          </div>
          {aside}
          {single && SingleIcon && (
            <Link
              to={single.to}
              className="inline-flex min-h-[40px] flex-shrink-0 items-center gap-2 self-start rounded-xl bg-white px-3.5 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <SingleIcon className="h-4 w-4" aria-hidden="true" />
              {single.label}
            </Link>
          )}
        </div>
        {stats && stats.length > 0 && (
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {stats.map((s) => {
              const body = (
                <>
                  <p className="line-clamp-2 text-xs font-medium leading-tight text-white/90">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold leading-tight">{s.value}</p>
                  {s.hint && <p className="line-clamp-2 text-xs leading-tight text-emerald-50">{s.hint}</p>}
                </>
              );
              const tile = 'rounded-xl bg-emerald-950/25 px-2.5 py-2';
              return s.to ? (
                <Link key={s.label} to={s.to} className={cn(tile, 'transition-colors hover:bg-emerald-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white')}>
                  {body}
                </Link>
              ) : (
                <div key={s.label} className={tile}>
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* No celular, uma coluna por atalho (com 3 não sobra meia linha vazia). Em tela larga, viram
          uma fileira de botões do tamanho do texto em vez de cartões esticados. */}
      {actions.length > 1 && (
      <nav aria-label={u.quickActions} className={cn('grid gap-2 lg:flex lg:flex-wrap', COLS[actions.length] ?? 'grid-cols-4')}>
        {actions.map(({ to, label, icon: Icon, badge }) => (
          <Link
            key={to + label}
            to={to}
            className="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white px-1 py-3 text-center shadow-sm transition-colors hover:border-emerald-300 lg:flex-row lg:gap-2.5 lg:py-2 lg:pl-2 lg:pr-4 lg:text-left dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/40"
          >
            <span className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-slate-700 dark:text-slate-200 sm:text-xs">{label}</span>
            {!!badge && (
              <span className="absolute right-2 top-2 min-w-[18px] lg:static lg:ml-0.5 rounded-full bg-rose-600 px-1 text-center text-[11px] font-bold leading-[18px] text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      )}
    </section>
  );
}
