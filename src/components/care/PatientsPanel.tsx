import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, Loader2, MessageCircle, UserPlus, Users, X, ChevronRight, AlertTriangle, ArrowLeftRight, ClipboardCheck, Search, ShieldAlert, Share2, Crown } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { usePremiumStore } from '../../store/premium';
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
import { listChecks, loadAdherence } from '../../services/adherence';
import { isInactive, lastActivity } from '../../lib/patient-activity';
import { unreadByPatient } from '../../services/messages';
import { sumEntries, toISODate } from '../../store/nutrition-tracking';
import { Avatar } from './Avatar';
import { PatientDetail } from './PatientDetail';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { LoadError } from '../common/LoadError';
import { appLocale } from '../../lib/format';
import { getMyCrnStatus, type CrnStatus } from '../../services/verification';

interface PatientSummary {
  lastLog: string | null;
  /** Último uso do app: diário ou marcação de refeição (mesma regra do painel). */
  lastActive: string | null;
  days7: number;
  avgKcal7: number;
  goalKcal: number | null;
  /** % de adesão nos últimos 7 dias ao plano deste nutricionista (null sem plano/dados). */
  adherence: number | null;
}

/** Resumo dos últimos 7 dias de cada paciente, para a lista. */
async function summarize(clientId: string, nutritionistId: string): Promise<PatientSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const min = toISODate(since);
  const [data, adherence, checks] = await Promise.all([
    getPatientData(clientId, 7),
    loadAdherence(clientId, nutritionistId).catch(() => null),
    listChecks(clientId, min).catch(() => []),
  ]);
  const recent = data.entries.filter((e) => e.date >= min);
  const days = new Set(recent.map((e) => e.date));
  const total = sumEntries(recent).calories;
  return {
    lastLog: data.entries[0]?.date ?? null,
    lastActive: lastActivity(data.entries[0]?.date, checks[0]?.check_date),
    days7: days.size,
    avgKcal7: days.size ? Math.round(total / days.size) : 0,
    goalKcal: data.goals?.calories ?? null,
    adherence: adherence && adherence.current.planned >= 6 ? adherence.current.percent : null,
  };
}

export function PatientsPanel() {
  const user = useAuthStore((s) => s.user);
  const { loaded: premiumLoaded, nutritionistPro, freePatientLimit } = usePremiumStore();
  const { showToast } = useToastStore();
  const t = useTranslation();

  const [patients, setPatients] = useState<CareLink[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PatientSummary>>({});
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingSwaps, setPendingSwaps] = useState<Map<string, number>>(new Map());
  // O paciente aberto fica na URL (?paciente=<id>): links dos avisos abrem direto, e o voltar
  // do celular volta para a lista em vez de sair da tela.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPatient = searchParams.get('paciente');
  const selected = requestedPatient ? patients.find((p) => p.person.id === requestedPatient) ?? null : null;
  const openChat = searchParams.get('chat') === '1';
  const [query, setQuery] = useState('');
  const [crnStatus, setCrnStatus] = useState<CrnStatus | null>(null);
  const [unread, setUnread] = useState<Map<string, number>>(new Map());
  const careSignal = useNotificationSignal((n) => n.kind === 'swap_requested' || n.kind === 'patient_joined' || n.kind === 'link_ended' || n.kind === 'message');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, open] = await Promise.all([listMyPatients(user.id), listOpenInvites(user.id)]);
      setFailed(false);
      setPatients(list);
      setInvites(open);
      pendingSwapCounts(user.id)
        .then(setPendingSwaps)
        .catch((e) => console.error('Error loading swap counts:', e));
      unreadByPatient(user.id)
        .then(setUnread)
        .catch((e) => console.error('Error loading unread messages:', e));
      // Resumos carregam em paralelo, sem travar a lista.
      list.forEach((p) =>
        summarize(p.person.id, user.id)
          .then((s) => setSummaries((prev) => ({ ...prev, [p.person.id]: s })))
          .catch((e) => console.error('Error summarizing patient:', e))
      );
    } catch (error) {
      console.error('Error loading patients:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, careSignal]);

  // Paciente que não está (mais) na lista: volta para a lista.
  useEffect(() => {
    if (!requestedPatient || loading || selected) return;
    const next = new URLSearchParams(searchParams);
    next.delete('paciente');
    next.delete('chat');
    setSearchParams(next, { replace: true });
  }, [requestedPatient, loading, selected, searchParams, setSearchParams]);

  const openPatient = (link: CareLink | null) => {
    const next = new URLSearchParams(searchParams);
    next.delete('chat');
    if (link) next.set('paciente', link.person.id);
    else next.delete('paciente');
    setSearchParams(next);
  };

  // Antes de tocar em "Convidar": o que impede o convite aparece já, com o caminho para resolver.
  useEffect(() => {
    if (!user) return;
    getMyCrnStatus(user.id)
      .then((r) => setCrnStatus(r.status))
      .catch((e) => console.error('Error loading CRN status:', e));
  }, [user]);
  const crnBlocked = crnStatus !== null && crnStatus !== 'approved';
  const limitReached = premiumLoaded && !nutritionistPro && patients.length >= freePatientLimit;
  const canInvite = !crnBlocked && !limitReached;

  const shareInvite = async (code: string) => {
    const text = t.care.inviteMessage.replace('{link}', inviteLink(code)).replace('{code}', code);
    try {
      await navigator.share({ text });
    } catch {
      // Cancelou o compartilhamento: nada a fazer.
    }
  };
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const newInvite = async () => {
    setCreating(true);
    try {
      const invite = await createInvite();
      setInvites((prev) => [invite, ...prev]);
      showToast(t.care.inviteCreated, 'success');
      // No celular, abre na hora o compartilhar do sistema (WhatsApp, SMS, e-mail...).
      if (canShare && window.matchMedia('(pointer: coarse)').matches) shareInvite(invite.code);
    } catch (error) {
      const key = error instanceof CareError ? error.code : 'unknown';
      showToast(t.care.errors[key as keyof typeof t.care.errors] ?? t.care.errors.unknown, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Atalho "Convidar paciente" do painel (?convidar=1): já cria o convite, se nada impedir.
  const autoInvited = useRef(false);
  useEffect(() => {
    if (!searchParams.has('convidar') || loading || crnStatus === null || !premiumLoaded) return;
    const next = new URLSearchParams(searchParams);
    next.delete('convidar');
    setSearchParams(next, { replace: true });
    if (canInvite && !autoInvited.current) {
      autoInvited.current = true;
      newInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, crnStatus, premiumLoaded]);

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
        openChat={openChat}
        pendingSwaps={pendingSwaps.get(selected.person.id) ?? 0}
        unread={unread.get(selected.person.id) ?? 0}
        onBack={() => {
          openPatient(null);
          load();
        }}
        onEnded={() => {
          openPatient(null);
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

  if (failed && !patients.length) {
    return (
      <LoadError
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
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
          {premiumLoaded && !nutritionistPro && (
            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {t.care.freeLimit.replace('{n}', String(patients.length)).replace('{max}', String(freePatientLimit))}{' '}
              <Link to="/mentoria-ia" className="font-semibold text-emerald-700 underline dark:text-emerald-300">
                {t.care.unlimitedWithPremium}
              </Link>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={newInvite}
          disabled={creating || !canInvite}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t.care.invitePatient}
        </button>
      </div>

      {crnBlocked && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1">{crnStatus === 'pending' ? t.care.crnPendingInvite : t.care.crnNeededInvite}</p>
          {crnStatus !== 'pending' && (
            <Link to="/perfil" className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-400">
              {t.care.verifyCrn}
            </Link>
          )}
        </div>
      )}
      {!crnBlocked && limitReached && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          <Crown className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1">{t.care.errors.patient_limit}</p>
          <Link to="/mentoria-ia" className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-400">
            {t.clientPremium.seePremium}
          </Link>
        </div>
      )}

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
                  {t.care.expiresOn} {new Date(invite.expires_at).toLocaleDateString(appLocale())}
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
              {canShare && (
                <button
                  type="button"
                  onClick={() => shareInvite(invite.code)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t.care.share}
                </button>
              )}
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
        <div className="space-y-3">
        {/* Busca só quando a lista já é grande o bastante para precisar. */}
        {patients.length > 6 && (
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.care.searchPatients}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {patients
            .filter((p) => !query.trim() || (p.person.full_name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
            .map((p) => {
            const s = summaries[p.person.id];
            const inactive = s && isInactive(s.lastActive);
            const overGoal = s && s.goalKcal && s.avgKcal7 > s.goalKcal * 1.1;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openPatient(p)}
                className="glass-card flex items-center gap-3 rounded-2xl border p-4 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Avatar name={p.person.full_name} url={p.person.avatar_url} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{p.person.full_name}</p>
                  {s ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.care.lastLog}: {s.lastLog ? new Date(`${s.lastLog}T12:00:00`).toLocaleDateString(appLocale()) : t.care.never}
                      {' • '}
                      {s.days7} {t.care.daysLogged7}
                      {s.avgKcal7 > 0 && ` • ${s.avgKcal7} kcal`}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">…</p>
                  )}
                  {(unread.get(p.person.id) ?? 0) > 0 && (
                    <p className="mr-1 mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <MessageCircle className="h-3 w-3" />
                      {t.messages.unreadCount.replace('{count}', String(unread.get(p.person.id)))}
                    </p>
                  )}
                  {(pendingSwaps.get(p.person.id) ?? 0) > 0 && (
                    <p className="mr-1 mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                      <ArrowLeftRight className="h-3 w-3" />
                      {t.swaps.pendingCount.replace('{count}', String(pendingSwaps.get(p.person.id)))}
                    </p>
                  )}
                  {/* Adesão baixa: só com refeições suficientes para a % fazer sentido. */}
                  {s && s.adherence !== null && s.adherence < 50 && (
                    <p className="mr-1 mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                      <ClipboardCheck className="h-3 w-3" />
                      {t.adherence.lowAlert.replace('{percent}', String(s.adherence))}
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
        </div>
      )}
    </div>
  );
}
