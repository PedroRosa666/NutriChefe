import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Loader2, MessageCircle, UserPlus, Users, X, ChevronRight, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotificationSignal } from '../../store/notifications';
import {
  CareError,
  createInvite,
  deleteInvite,
  getPatientData,
  inviteLink,
  listMyPatients,
  listOpenInvites,
  type CareLink,
  type Invite,
} from '../../services/care';
import { pendingSwapCounts } from '../../services/swaps';
import { sumEntries, toISODate } from '../../store/nutrition-tracking';
import { Avatar } from './Avatar';
import { PatientDetail } from './PatientDetail';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface PatientSummary {
  lastLog: string | null;
  days7: number;
  avgKcal7: number;
  goalKcal: number | null;
}

/** Resumo dos últimos 7 dias de cada paciente, para a lista. */
async function summarize(clientId: string): Promise<PatientSummary> {
  const data = await getPatientData(clientId, 7);
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const min = toISODate(since);
  const recent = data.entries.filter((e) => e.date >= min);
  const days = new Set(recent.map((e) => e.date));
  const total = sumEntries(recent).calories;
  return {
    lastLog: data.entries[0]?.date ?? null,
    days7: days.size,
    avgKcal7: days.size ? Math.round(total / days.size) : 0,
    goalKcal: data.goals?.calories ?? null,
  };
}

export function PatientsPanel() {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();

  const [patients, setPatients] = useState<CareLink[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PatientSummary>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<CareLink | null>(null);
  const [pendingSwaps, setPendingSwaps] = useState<Map<string, number>>(new Map());
  // ?paciente=<id> abre direto o detalhe (links dos avisos).
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPatient = searchParams.get('paciente');
  const careSignal = useNotificationSignal((n) => n.kind === 'swap_requested' || n.kind === 'patient_joined' || n.kind === 'link_ended');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, open] = await Promise.all([listMyPatients(user.id), listOpenInvites(user.id)]);
      setPatients(list);
      setInvites(open);
      pendingSwapCounts(user.id)
        .then(setPendingSwaps)
        .catch((e) => console.error('Error loading swap counts:', e));
      // Resumos carregam em paralelo, sem travar a lista.
      list.forEach((p) =>
        summarize(p.person.id)
          .then((s) => setSummaries((prev) => ({ ...prev, [p.person.id]: s })))
          .catch((e) => console.error('Error summarizing patient:', e))
      );
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, careSignal]);

  useEffect(() => {
    if (!requestedPatient || loading) return;
    const match = patients.find((p) => p.person.id === requestedPatient);
    if (match) setSelected(match);
    const next = new URLSearchParams(searchParams);
    next.delete('paciente');
    setSearchParams(next, { replace: true });
  }, [requestedPatient, loading, patients, searchParams, setSearchParams]);

  const newInvite = async () => {
    setCreating(true);
    try {
      const invite = await createInvite();
      setInvites((prev) => [invite, ...prev]);
      showToast(t.care.inviteCreated, 'success');
    } catch (error) {
      const key = error instanceof CareError ? error.code : 'unknown';
      showToast(t.care.errors[key as keyof typeof t.care.errors] ?? t.care.errors.unknown, 'error');
    } finally {
      setCreating(false);
    }
  };

  const copyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      showToast(t.care.linkCopied, 'success');
    } catch {
      showToast(inviteLink(code), 'info');
    }
  };

  const whatsappUrl = (code: string) =>
    `https://wa.me/?text=${encodeURIComponent(t.care.inviteMessage.replace('{link}', inviteLink(code)).replace('{code}', code))}`;

  const cancelInvite = async (code: string) => {
    try {
      await deleteInvite(code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
    } catch (error) {
      console.error('Error deleting invite:', error);
      showToast(t.care.errors.unknown, 'error');
    }
  };

  if (selected) {
    return (
      <PatientDetail
        link={selected}
        onBack={() => setSelected(null)}
        onEnded={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Users className="h-5 w-5 text-emerald-500" />
            {t.care.patientsTitle}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">{t.care.patientsSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={newInvite}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t.care.invitePatient}
        </button>
      </div>

      {invites.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.care.openInvites}</h3>
          {invites.map((invite) => (
            <div
              key={invite.code}
              className="relative flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-800/40 dark:bg-emerald-900/10 sm:pr-12"
            >
              <div className="min-w-0 basis-full pr-8 sm:basis-auto sm:flex-1 sm:pr-0">
                <p className="font-mono text-lg font-bold tracking-[0.2em] text-emerald-800 dark:text-emerald-200">{invite.code}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.care.expiresOn} {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyInvite(invite.code)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200"
              >
                <Copy className="h-3.5 w-3.5" />
                {t.care.copyLink}
              </button>
              <a
                href={whatsappUrl(invite.code)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t.care.shareWhatsApp}
              </a>
              <button
                type="button"
                onClick={() => cancelInvite(invite.code)}
                className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 sm:top-1/2 sm:-translate-y-1/2 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                aria-label={t.care.cancelInvite}
                title={t.care.cancelInvite}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </section>
      )}

      {!patients.length ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t.care.noPatients}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {patients.map((p) => {
            const s = summaries[p.person.id];
            const daysSince = s?.lastLog ? Math.floor((Date.now() - new Date(`${s.lastLog}T12:00:00`).getTime()) / 86400000) : null;
            const inactive = s && (daysSince === null || daysSince >= 3);
            const overGoal = s && s.goalKcal && s.avgKcal7 > s.goalKcal * 1.1;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="glass-card flex items-center gap-3 rounded-2xl border p-4 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Avatar name={p.person.full_name} url={p.person.avatar_url} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{p.person.full_name}</p>
                  {s ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.care.lastLog}: {s.lastLog ? new Date(`${s.lastLog}T12:00:00`).toLocaleDateString() : t.care.never}
                      {' • '}
                      {s.days7} {t.care.daysLogged7}
                      {s.avgKcal7 > 0 && ` • ${s.avgKcal7} kcal`}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">…</p>
                  )}
                  {(pendingSwaps.get(p.person.id) ?? 0) > 0 && (
                    <p className="mr-1 mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                      <ArrowLeftRight className="h-3 w-3" />
                      {t.swaps.pendingCount.replace('{count}', String(pendingSwaps.get(p.person.id)))}
                    </p>
                  )}
                  {(inactive || overGoal) && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      {inactive ? t.care.inactiveAlert : t.care.overGoalAlert}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
