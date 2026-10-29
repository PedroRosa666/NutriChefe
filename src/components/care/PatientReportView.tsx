import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettingsStore } from '../../store/settings';
import { sumEntries, toISODate } from '../../store/nutrition-tracking';
import type { PatientData } from '../../services/care';
import type { AdherenceResult } from '../../services/adherence';

interface PatientReportViewProps {
  patientName: string;
  data: PatientData;
  adherence: AdherenceResult | null;
  nutritionistName: string;
  crn: string | null;
  contact: string | null;
  onDone: () => void;
  /** Período em dias (padrão 30). */
  days?: number;
  /** Meta de peso do perfil de saúde, se houver. */
  targetWeight?: number | null;
  /** Título no lugar de "Relatório de acompanhamento" (relatório do próprio cliente). */
  title?: string;
}

/** Gráfico simples de peso (SVG, imprime bem em preto e branco). */
function WeightChart({ points }: { points: { date: string; kg: number }[] }) {
  if (points.length < 2) return null;
  const w = 640;
  const h = 140;
  const pad = 24;
  const min = Math.min(...points.map((p) => p.kg)) - 0.5;
  const max = Math.max(...points.map((p) => p.kg)) + 0.5;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (kg: number) => h - pad - ((kg - min) * (h - 2 * pad)) / (max - min || 1);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
      <path d={path} fill="none" stroke="#059669" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.kg)} r={3} fill="#059669" />
      ))}
      <text x={pad} y={14} fontSize={10} fill="#475569">{max.toFixed(1)} kg</text>
      <text x={pad} y={h - 6} fontSize={10} fill="#475569">{min.toFixed(1)} kg</text>
    </svg>
  );
}

/**
 * Relatório do paciente para imprimir ou salvar em PDF (Premium Nutricionista): peso, adesão ao plano
 * e médias do diário nos últimos 30 dias, com nome e CRN do nutricionista. Usa a mesma regra de
 * impressão do plano (.plan-print-root em index.css).
 */
export function PatientReportView({ patientName, data, adherence, nutritionistName, crn, contact, onDone, days = 30, targetWeight = null, title }: PatientReportViewProps) {
  const t = useTranslation();
  const r = t.patientReport;
  const locale = useSettingsStore((s) => (s.language === 'pt' ? 'pt-BR' : 'en'));
  const num = (v: number, digits = 1) => v.toLocaleString(locale, { maximumFractionDigits: digits });
  const date = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(locale);

  useEffect(() => {
    const html = document.documentElement;
    const previousTitle = document.title;
    document.title = `${r.fileName} - ${patientName}`.trim();
    html.classList.add('printing-plan');
    const finish = () => {
      html.classList.remove('printing-plan');
      document.title = previousTitle;
      onDone();
    };
    window.addEventListener('afterprint', finish, { once: true });
    const timer = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
      html.classList.remove('printing-plan');
      document.title = previousTitle;
    };
  }, [patientName, onDone, r.fileName]);

  const since = toISODate(new Date(Date.now() - days * 86400000));
  const weights = data.weights.filter((w) => w.logged_on >= since).map((w) => ({ date: w.logged_on, kg: w.weight_kg }));
  const firstW = weights[0]?.kg;
  const lastW = weights[weights.length - 1]?.kg;

  // Médias do diário só nos dias com registro.
  const byDay = new Map<string, typeof data.entries>();
  for (const e of data.entries.filter((x) => x.date >= since)) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const c = t.clientPremium;
  const latestWeight = data.weights.at(-1)?.weight_kg;
  const targetLine =
    targetWeight && latestWeight
      ? Math.abs(latestWeight - targetWeight) < 0.1
        ? c.targetReached.replace('{target}', num(targetWeight))
        : c.targetWeight.replace('{target}', num(targetWeight)).replace('{left}', num(Math.abs(latestWeight - targetWeight)))
      : null;
  const loggedDays = byDay.size;
  const totals = [...byDay.values()].map(sumEntries);
  const avg = (k: 'calories' | 'protein' | 'carbs' | 'fat') =>
    loggedDays ? totals.reduce((s, x) => s + x[k], 0) / loggedDays : 0;
  const goals = data.goals;

  const rows: { label: string; value: number; goal?: number; unit: string }[] = [
    { label: r.calories, value: avg('calories'), goal: goals?.calories, unit: 'kcal' },
    { label: r.protein, value: avg('protein'), goal: goals?.protein, unit: 'g' },
    { label: r.carbs, value: avg('carbs'), goal: goals?.carbs, unit: 'g' },
    { label: r.fat, value: avg('fat'), goal: goals?.fat, unit: 'g' },
  ];

  return createPortal(
    <div className="plan-print-root text-[12px] leading-snug text-slate-900" style={{ background: '#fff' }}>
      <header className="flex items-start justify-between border-b-2 border-emerald-600 pb-3">
        <div>
          <p className="text-lg font-bold">{nutritionistName}</p>
          {crn && <p className="text-slate-600">{crn}</p>}
          {contact && <p className="text-slate-600">{contact}</p>}
        </div>
        <div className="text-right">
          <p className="text-base font-semibold">{title ?? r.title}</p>
          <p className="text-slate-600">{patientName}</p>
          <p className="text-slate-500">
            {r.period.replace('{from}', date(since)).replace('{to}', date(new Date().toISOString()))}
          </p>
        </div>
      </header>

      <section className="mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">{r.weight}</h2>
        {weights.length ? (
          <>
            <p className="mt-1">
              {r.weightSummary
                .replace('{first}', num(firstW!))
                .replace('{last}', num(lastW!))
                .replace('{delta}', `${lastW! - firstW! > 0 ? '+' : ''}${num(lastW! - firstW!)}`)
                .replace('{n}', String(weights.length))}
            </p>
            <WeightChart points={weights} />
          </>
        ) : (
          <p className="mt-1 text-slate-500">{r.noWeights}</p>
        )}
        {targetLine && <p className="mt-1 font-medium">{targetLine}</p>}
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">{r.adherence}</h2>
        {adherence?.current.percent !== null && adherence?.current.percent !== undefined ? (
          <p className="mt-1">
            {r.adherenceSummary
              .replace('{pct}', String(adherence.current.percent))
              .replace('{ate}', String(adherence.current.ate))
              .replace('{planned}', String(adherence.current.planned))}
            {adherence.previous.percent !== null && ` ${r.adherencePrev.replace('{pct}', String(adherence.previous.percent))}`}
          </p>
        ) : (
          <p className="mt-1 text-slate-500">{r.noAdherence}</p>
        )}
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">{r.diary.replace('{n}', String(days))}</h2>
        {loggedDays ? (
          <>
            <p className="mt-1">{r.diarySummary.replace('{n}', String(loggedDays))}</p>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-1">{r.nutrient}</th>
                  <th className="py-1">{r.average}</th>
                  <th className="py-1">{r.goal}</th>
                  <th className="py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100">
                    <td className="py-1">{row.label}</td>
                    <td className="py-1">{num(row.value, 0)} {row.unit}</td>
                    <td className="py-1">{row.goal ? `${num(row.goal, 0)} ${row.unit}` : '—'}</td>
                    <td className="py-1">{row.goal ? `${Math.round((row.value / row.goal) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="mt-1 text-slate-500">{r.noDiary}</p>
        )}
      </section>

      <footer className="mt-6 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
        {r.footer.replace('{date}', new Date().toLocaleDateString(locale))}
      </footer>
    </div>,
    document.body
  );
}
