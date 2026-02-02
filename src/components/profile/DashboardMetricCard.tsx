import React from 'react';

type Tone = 'emerald' | 'slate' | 'amber' | 'rose' | 'sky';

const toneStyles: Record<Tone, { ring: string; icon: string; value: string; pillBg: string; pillText: string }> = {
  emerald: {
    ring: 'ring-emerald-500/10 dark:ring-emerald-400/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
    pillBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    pillText: 'text-emerald-700 dark:text-emerald-200',
  },
  slate: {
    ring: 'ring-slate-500/10 dark:ring-slate-400/10',
    icon: 'text-slate-600 dark:text-slate-300',
    value: 'text-slate-900 dark:text-slate-50',
    pillBg: 'bg-slate-100 dark:bg-slate-800/60',
    pillText: 'text-slate-600 dark:text-slate-200',
  },
  amber: {
    ring: 'ring-amber-500/10 dark:ring-amber-400/10',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
    pillBg: 'bg-amber-50 dark:bg-amber-900/30',
    pillText: 'text-amber-700 dark:text-amber-200',
  },
  rose: {
    ring: 'ring-rose-500/10 dark:ring-rose-400/10',
    icon: 'text-rose-600 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-300',
    pillBg: 'bg-rose-50 dark:bg-rose-900/30',
    pillText: 'text-rose-700 dark:text-rose-200',
  },
  sky: {
    ring: 'ring-sky-500/10 dark:ring-sky-400/10',
    icon: 'text-sky-600 dark:text-sky-400',
    value: 'text-sky-700 dark:text-sky-300',
    pillBg: 'bg-sky-50 dark:bg-sky-900/30',
    pillText: 'text-sky-700 dark:text-sky-200',
  },
};

interface DashboardMetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  helperText?: string;
  tone?: Tone;
}

export function DashboardMetricCard({
  icon,
  label,
  value,
  helperText,
  tone = 'emerald',
}: DashboardMetricCardProps) {
  const styles = toneStyles[tone];

  return (
    <div className={`group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 ${styles.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${styles.pillBg}`}>
              <span className={styles.icon}>{icon}</span>
            </span>
            <span className="truncate">{label}</span>
          </div>

          <div className={`mt-2 text-3xl font-bold leading-none ${styles.value}`}>
            {value}
          </div>

          {helperText && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {helperText}
            </p>
          )}
        </div>

        <span className={`mt-1 hidden rounded-full px-2 py-1 text-[11px] font-semibold sm:inline-flex ${styles.pillBg} ${styles.pillText}`}>
          •
        </span>
      </div>
    </div>
  );
}
