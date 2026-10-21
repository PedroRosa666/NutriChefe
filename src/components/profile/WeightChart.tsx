import type { WeightLog } from '../../store/health-profile';
import { useTranslation } from '../../hooks/useTranslation';

interface WeightChartProps {
  logs: WeightLog[];
  target?: number | null;
}

const W = 320;
const H = 120;
const PAD = 8;

/** Linha simples da evolução do peso (últimos registros), com a meta tracejada. */
export function WeightChart({ logs, target }: WeightChartProps) {
  const t = useTranslation();
  const points = logs.slice(-30);

  if (points.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {t.health.weightEmpty}
      </p>
    );
  }

  const values = points.map((p) => p.weight_kg);
  const all = target ? [...values, target] : values;
  const min = Math.min(...all) - 1;
  const max = Math.max(...all) + 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.weight_kg).toFixed(1)}`).join(' ');

  const first = values[0];
  const last = values[values.length - 1];
  const diff = Math.round((last - first) * 10) / 10;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={t.health.weightHistory}>
        {target && (
          <line x1={PAD} x2={W - PAD} y1={y(target)} y2={y(target)} stroke="currentColor"
            className="text-emerald-500" strokeDasharray="4 4" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="currentColor" className="text-sky-500" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.weight_kg)} r={2.5} className="fill-sky-500">
            <title>{`${new Date(`${p.logged_on}T00:00:00`).toLocaleDateString('pt-BR')}: ${p.weight_kg} kg`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {t.health.variation}:{' '}
        <strong className={diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-amber-600' : ''}>
          {diff > 0 ? '+' : ''}{diff} kg
        </strong>
        {target ? ` • ${t.health.targetWeight}: ${target} kg` : ''}
      </p>
    </div>
  );
}
