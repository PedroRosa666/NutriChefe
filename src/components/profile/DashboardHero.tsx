import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

export interface QuickAction {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Número pequeno no canto (ex.: mensagens não lidas). */
  badge?: number;
}

/** Primeiro nome para a saudação, sem títulos como "Dra." ou "Dr.". */
export function firstNameOf(name: string | undefined | null, fallback: string): string {
  const words = (name ?? '').split(/\s+/).filter(Boolean);
  const first = words.find((w) => !/^(dr|dra|prof|profa|sr|sra)\.?$/i.test(w));
  return first ?? fallback;
}

/** Saudação do período do dia, pelo relógio do aparelho. */
export function useGreeting(): string {
  const u = useTranslation().profileUi;
  const hour = new Date().getHours();
  return hour < 12 ? u.morning : hour < 18 ? u.afternoon : u.evening;
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
  stats?: { label: string; value: string; hint?: string }[];
  actions: QuickAction[];
}) {
  const u = useTranslation().profileUi;
  return (
    <section className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-emerald-50">{subtitle}</p>
          </div>
          {aside}
        </div>
        {stats && stats.length > 0 && (
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/15 px-2.5 py-2 backdrop-blur-sm">
                <p className="line-clamp-2 text-[11px] font-medium leading-tight text-emerald-50/90">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold leading-tight">{s.value}</p>
                {s.hint && <p className="line-clamp-2 text-[11px] leading-tight text-emerald-50/80">{s.hint}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <nav aria-label={u.quickActions} className="grid grid-cols-4 gap-2">
        {actions.map(({ to, label, icon: Icon, badge }) => (
          <Link
            key={to + label}
            to={to}
            className="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white px-1 py-3 text-center shadow-sm transition-colors hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/40"
          >
            <span className="inline-flex rounded-xl bg-emerald-50 p-2 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-slate-700 dark:text-slate-200 sm:text-xs">{label}</span>
            {!!badge && (
              <span className="absolute right-2 top-2 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </section>
  );
}
