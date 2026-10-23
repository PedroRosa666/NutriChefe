import { useCallback, useEffect, useState } from 'react';
import { Ban, Crown, Search, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useToastStore } from '../../store/toast';
import { confirmDialog } from '../../store/confirm';
import { LoadingSpinner } from '../common/LoadingSpinner';
import {
  adminUsers,
  grantPremium,
  listPlans,
  revokePremium,
  setCrnStatus,
  suspendUser,
  type AdminPlan,
  type AdminUser,
} from '../../services/admin';
import { adminErrorText } from './errors';
import { appLocale } from '../../lib/format';

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function UserCard({ u, plans, onChanged }: { u: AdminUser; plans: AdminPlan[]; onChanged: () => void }) {
  const t = useTranslation();
  const a = t.adminPanel;
  const showToast = useToastStore((s) => s.showToast);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const suspended = u.banned_until && new Date(u.banned_until) > new Date();
  const paidPlans = plans.filter((p) => p.price > 0);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(ok, 'success');
      onChanged();
    } catch (error) {
      showToast(adminErrorText(error, a), 'error');
    } finally {
      setBusy(false);
    }
  };

  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(appLocale()) : '—');

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">{u.full_name || '—'}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {u.user_type === 'Nutritionist' ? a.nutritionist : a.client}
          </span>
          {u.is_demo && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">demo</span>}
          {u.sub_status === 'active' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              <Crown className="h-3 w-3" />
              {u.plan_name}
              {u.courtesy && ` (${a.courtesy})`}
            </span>
          )}
          {suspended && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">{a.suspended}</span>}
        </div>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{u.email}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {a.joined} {date(u.created_at)} · {a.lastLogin} {date(u.last_sign_in_at)}
          {u.user_type === 'Nutritionist' && ` · CRN: ${a.crnStatus[u.crn_status as keyof typeof a.crnStatus] ?? u.crn_status}`}
        </p>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex flex-wrap items-end gap-2">
            <select className={inputClass} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label={a.plan}>
              <option value="">{a.choosePlan}</option>
              {paidPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={a.duration}>
              {[7, 30, 90, 365, 0].map((d) => (
                <option key={d} value={d}>
                  {d ? a.days.replace('{n}', String(d)) : a.noEnd}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !plan}
              onClick={() => run(() => grantPremium(u.id, plan, days ? new Date(Date.now() + days * 86400000).toISOString() : null), a.granted)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <Crown className="h-4 w-4" />
              {a.grant}
            </button>
            {u.courtesy && u.sub_status === 'active' && (
              <button type="button" disabled={busy} onClick={() => run(() => revokePremium(u.id), a.revoked)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200">
                {a.revoke}
              </button>
            )}
          </div>

          {u.user_type === 'Nutritionist' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {(['approved', 'pending', 'rejected', 'none'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || u.crn_status === s}
                  onClick={() => run(() => setCrnStatus(u.id, s), a.saved)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs disabled:bg-emerald-600 disabled:text-white dark:border-slate-600 dark:text-slate-200"
                >
                  {a.crnStatus[s]}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!suspended && !(await confirmDialog(a.suspendConfirm.replace('{name}', u.full_name || u.email || '')))) return;
              run(() => suspendUser(u.id, !suspended), suspended ? a.unsuspended : a.suspendedDone);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${suspended ? 'border border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20'}`}
          >
            <Ban className="h-4 w-4" />
            {suspended ? a.unsuspend : a.suspend}
          </button>
        </div>
      )}
    </li>
  );
}

export function AdminUsers() {
  const t = useTranslation();
  const a = t.adminPanel;
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);

  const load = useCallback((q: string) => {
    adminUsers(q).then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    listPlans().then(setPlans).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className={`${inputClass} w-full pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={a.searchUsers} />
      </label>
      {users === null ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-500">{a.noResults}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <UserCard key={u.id} u={u} plans={plans} onChanged={() => load(query)} />
          ))}
        </ul>
      )}
    </div>
  );
}
