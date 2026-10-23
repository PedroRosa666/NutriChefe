import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useToastStore } from '../../store/toast';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { listPlans, setPlan, type AdminPlan } from '../../services/admin';
import { adminErrorText } from './errors';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function PlanCard({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const t = useTranslation();
  const a = t.adminPanel;
  const showToast = useToastStore((s) => s.showToast);
  const [price, setPrice] = useState(String(plan.price));
  const [priceId, setPriceId] = useState(plan.stripe_price_id ?? '');
  const [active, setActive] = useState(plan.is_active);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await setPlan(plan.id, Number(price.replace(',', '.')), priceId.trim(), active);
      showToast(a.saved, 'success');
      onSaved();
    } catch (error) {
      showToast(adminErrorText(error, a), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {a.planActive}
        </label>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{(plan.features ?? []).join(', ')}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
        <label className="text-sm text-slate-700 dark:text-slate-200">
          {a.priceShown}
          <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
        </label>
        <label className="text-sm text-slate-700 dark:text-slate-200">
          {a.stripePriceId}
          <input className={inputClass} value={priceId} onChange={(e) => setPriceId(e.target.value)} placeholder="price_..." />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{a.priceHint}</p>
      <button type="button" onClick={save} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
        <Save className="h-4 w-4" />
        {t.common.save}
      </button>
    </li>
  );
}

export function AdminPlans() {
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const load = () => listPlans().then(setPlans).catch(() => setPlans([]));
  useEffect(() => {
    load();
  }, []);
  if (!plans) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;
  return (
    <ul className="space-y-3">
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} onSaved={load} />
      ))}
    </ul>
  );
}
