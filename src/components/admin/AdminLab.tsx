import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Bell, CalendarClock, FlaskConical, LogIn, MessageCircle, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useToastStore } from '../../store/toast';
import { confirmDialog } from '../../store/confirm';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { demoReset, demoStatus, demoToggle, enterDemo, runReminders, simulate, testPush, type DemoStatus } from '../../services/admin';
import { adminErrorText } from './errors';

function Toggle({ label, hint, on, busy, onChange }: { label: string; hint: string; on: boolean; busy: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 py-2">
      <span>
        <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
      <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" checked={on} disabled={busy} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Laboratório: contas demo ligadas ao administrador, para testar o app sem criar contas. */
export function AdminLab() {
  const t = useTranslation();
  const a = t.adminPanel;
  const showToast = useToastStore((s) => s.showToast);
  const navigate = useNavigate();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => demoStatus().then(setStatus).catch(() => setStatus({ ok: true, exists: false })), []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string, reload = true) => {
    setBusy(key);
    try {
      await fn();
      if (ok) showToast(ok, 'success');
      if (reload) await load();
    } catch (error) {
      showToast(adminErrorText(error, a), 'error');
    } finally {
      setBusy(null);
    }
  };

  const enter = (as: 'patient' | 'nutritionist') =>
    run(`enter-${as}`, async () => {
      await enterDemo(as);
      navigate('/perfil');
    }, undefined, false);

  if (!status) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900';
  const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold disabled:opacity-60';

  if (!status.exists) {
    return (
      <div className={card}>
        <FlaskConical className="h-6 w-6 text-violet-600" />
        <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{a.labTitle}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.labIntro}</p>
        <button type="button" disabled={busy !== null} onClick={() => run('reset', demoReset, a.labCreated)} className={`${btn} mt-3 bg-violet-600 text-white hover:bg-violet-700`}>
          {busy === 'reset' ? <LoadingSpinner size="sm" /> : <FlaskConical className="h-4 w-4" />}
          {a.labCreate}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <h3 className="font-semibold text-slate-900 dark:text-white">{a.labEnterTitle}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.labEnterHint}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy !== null} onClick={() => enter('patient')} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
            <LogIn className="h-4 w-4" />
            {a.labAsPatient}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => enter('nutritionist')} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>
            <LogIn className="h-4 w-4" />
            {a.labAsNutritionist}
          </button>
        </div>
      </div>

      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
        <Toggle label={a.labPatientPremium} hint={a.labPatientPremiumHint} on={Boolean(status.patientPremium)} busy={busy !== null} onChange={(v) => run('t1', () => demoToggle('patient_premium', v), a.saved)} />
        <Toggle label={a.labNutriPremium} hint={a.labNutriPremiumHint} on={Boolean(status.nutritionistPremium)} busy={busy !== null} onChange={(v) => run('t2', () => demoToggle('nutritionist_premium', v), a.saved)} />
        <Toggle label={a.labCrnPending} hint={a.labCrnPendingHint} on={Boolean(status.crnPending)} busy={busy !== null} onChange={(v) => run('t3', () => demoToggle('crn', v), a.saved)} />
        <Toggle label={a.labAtLimit} hint={a.labAtLimitHint} on={Boolean(status.atLimit)} busy={busy !== null} onChange={(v) => run('t4', () => demoToggle('limit', v), a.saved)} />
      </div>

      <div className={card}>
        <h3 className="font-semibold text-slate-900 dark:text-white">{a.labSimulators}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy !== null} onClick={() => run('push', testPush, a.labPushSent, false)} className={`${btn} border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200`}>
            <Bell className="h-4 w-4" />
            {a.labPush}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run('rem', async () => showToast(a.labRemindersSent.replace('{n}', String(await runReminders())), 'success'), undefined, false)}
            className={`${btn} border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200`}
          >
            <CalendarClock className="h-4 w-4" />
            {a.labReminders}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => run('swap', () => simulate('swap'), a.labSwapSent, false)} className={`${btn} border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200`}>
            <ArrowLeftRight className="h-4 w-4" />
            {a.labSwap}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => run('msg', () => simulate('message'), a.labMessageSent, false)} className={`${btn} border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200`}>
            <MessageCircle className="h-4 w-4" />
            {a.labMessage}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{a.labSimHint}</p>
      </div>

      <button
        type="button"
        disabled={busy !== null}
        onClick={async () => {
          if (await confirmDialog(a.labResetConfirm)) run('reset', demoReset, a.labResetDone);
        }}
        className={`${btn} border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20`}
      >
        {busy === 'reset' ? <LoadingSpinner size="sm" /> : <RotateCcw className="h-4 w-4" />}
        {a.labReset}
      </button>
    </div>
  );
}
