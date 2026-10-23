import { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, Bot, Crown, UserCheck, UserPlus, Users } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { adminStats, type AdminStats } from '../../services/admin';

function Tile({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function AdminOverview({ onOpen }: { onOpen: (tab: string) => void }) {
  const t = useTranslation();
  const a = t.adminPanel;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    adminStats().then(setStats).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm text-rose-600">{a.loadError}</p>;
  if (!stats) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  const ai = Object.values(stats.ai_today ?? {}).reduce((s, n) => s + n, 0);
  const paid = stats.plans.reduce((s, p) => s + p.paid, 0);
  const courtesy = stats.plans.reduce((s, p) => s + p.courtesy, 0);

  return (
    <div className="space-y-4">
      {(stats.crn_pending > 0 || stats.errors_24h > 0) && (
        <div className="flex flex-wrap gap-2">
          {stats.crn_pending > 0 && (
            <button type="button" onClick={() => onOpen('crn')} className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              <BadgeCheck className="h-4 w-4" />
              {a.crnPendingChip.replace('{n}', String(stats.crn_pending))}
            </button>
          )}
          {stats.errors_24h > 0 && (
            <button type="button" onClick={() => onOpen('errors')} className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-sm font-semibold text-rose-900 dark:bg-rose-900/40 dark:text-rose-100">
              <AlertTriangle className="h-4 w-4" />
              {a.errorsChip.replace('{n}', String(stats.errors_24h))}
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label={a.users} value={stats.users} hint={a.usersHint.replace('{c}', String(stats.clients)).replace('{n}', String(stats.nutritionists))} />
        <Tile icon={UserPlus} label={a.newUsers} value={stats.new_7d} hint={a.newUsersHint.replace('{n}', String(stats.new_30d))} />
        <Tile icon={UserCheck} label={a.activeLinks} value={stats.active_links} />
        <Tile icon={Crown} label={a.subscribers} value={paid} hint={courtesy ? a.courtesyHint.replace('{n}', String(courtesy)) : undefined} />
        <Tile icon={Crown} label={a.mrr} value={`R$ ${Number(stats.mrr).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} hint={a.mrrHint} />
        <Tile icon={Bot} label={a.aiToday} value={ai} hint={Object.entries(stats.ai_today ?? {}).map(([k, n]) => `${a.aiKinds[k as keyof typeof a.aiKinds] ?? k}: ${n}`).join(' · ')} />
        <Tile icon={AlertTriangle} label={a.errors24h} value={stats.errors_24h} />
        <Tile icon={BadgeCheck} label={a.crnPending} value={stats.crn_pending} />
      </div>
      {stats.plans.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">{a.byPlan}</h3>
          <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-200">
            {stats.plans.map((p) => (
              <li key={p.name}>
                {p.name}: <strong>{p.paid}</strong> {a.paid}
                {p.courtesy > 0 && <> · {p.courtesy} {a.courtesy}</>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
