import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, Loader2, MessageCircle, UserPlus, Users, X, ChevronRight, Search, ShieldAlert, Share2, Crown } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { usePremiumStore } from '../../store/premium';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotificationSignal } from '../../store/notifications';
import {
  CareError,
  createInvite,
  deleteInvite,
  inviteLink,
  listMyPatients,
  listOpenInvites,
  patientsOverview,
  type CareLink,
  type Invite,
  type PatientOverview,
} from '../../services/care';
import { loadAdherence } from '../../services/adherence';
import { isInactive, lastActivity } from '../../lib/patient-activity';
import { MIN_PLANNED_FOR_PERCENT } from '../../lib/adherence';
import { Avatar } from './Avatar';
import { PatientDetail } from './PatientDetail';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { LoadError } from '../common/LoadError';
import { appLocale } from '../../lib/format';
import { getMyCrnStatus, type CrnStatus } from '../../services/verification';
import { matchesSearch } from '../../lib/search';
import { StatusChip } from './AttentionPanel';
import { cn } from '../../lib/utils';

interface PatientSummary {
  lastLog: string | null;
  /** Último uso do app: diário ou marcação de refeição (mesma regra do painel). */
  lastActive: string | null;
  days7: number;
  avgKcal7: number;
  goalKcal: number | null;
}

function toSummary(o: PatientOverview): PatientSummary {
  return {
    lastLog: o.lastLog,
    lastActive: lastActivity(o.lastLog, o.lastCheck),
    days7: o.days7,
    // Média por dia com registro (dias sem registro não puxam a média para baixo).
    avgKcal7: o.days7 ? Math.round(o.kcal7 / o.days7) : 0,
    goalKcal: o.goalKcal,
  };
}

/** % de adesão nos últimos 7 dias ao plano deste nutricionista (null sem plano ou com poucos dados). */
async function adherenceOf(clientId: string, nutritionistId: string): Promise<number | null> {
  const result = await loadAdherence(clientId, nutritionistId).catch(() => null);
  return result && result.current.planned >= MIN_PLANNED_FOR_PERCENT ? result.current.percent : null;
}

export function PatientsPanel() {
  const user = useAuthStore((s) => s.user);
  const { loaded: premiumLoaded, nutritionistPro, freePatientLimit } = usePremiumStore();
  const { showToast } = useToastStore();
  const t = useTranslation();

  const [patients, setPatients] = useState<CareLink[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PatientSummary>>({});
  const [adherence, setAdherence] = useState<Record<string, number | null>>({});
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
  const [filterChoice, setFilter] = useState<'attention' | 'all' | null>(searchParams.get('filtro') === 'atencao' ? 'attention' : null);
  const [crnStatus, setCrnStatus] = useState<CrnStatus | null>(null);
  const [unread, setUnread] = useState<Map<string, number>>(new Map());
  const [overviewFailed, setOverviewFailed] = useState(false);
  const careSignal = useNotificationSignal((n) => n.kind === 'swap_requested' || n.kind === 'patient_joined' || n.kind === 'link_ended' || n.kind === 'message');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [list, open] = await Promise.all([listMyPatients(user.id), listOpenInvites(user.id)]);
      setFailed(false);
      setPatients(list);
      setInvites(open);
      // Resumo, trocas pendentes e não lidas de todos os pacientes numa consulta só, sem travar a lista.
      patientsOverview()
        .then((rows) => {
          setSummaries(Object.fromEntries(rows.map((r) => [r.clientId, toSummary(r)])));
          setPendingSwaps(new Map(rows.map((r) => [r.clientId, r.pendingSwaps])));
          setUnread(new Map(rows.map((r) => [r.clientId, r.unread])));
          setOverviewFailed(false);
        })
        .catch((e) => {
          console.error('Error loading patients overview:', e);
          setOverviewFailed(true);
        });
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

  // Adesão (regras das versões do plano, no app): só quando a lista de pacientes muda, não a cada
  // mensagem recebida.
  const patientIds = patients.map((p) => p.person.id).join(',');
  useEffect(() => {
    if (!user || !patientIds) return;
    let cancelled = false;
    // Até 4 de cada vez: com 30+ pacientes, não dispara dezenas de consultas juntas.
    const queue = patientIds.split(',');
    const worker = async () => {
      for (let id = queue.shift(); id && !cancelled; id = queue.shift()) {
        const value = await adherenceOf(id, user.id);
        if (!cancelled) setAdherence((prev) => ({ ...prev, [id]: value }));
      }
    };
    for (let i = 0; i < 4; i++) worker();
    return () => {
      cancelled = true;
    };
  }, [user, patientIds]);

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

  // Ordem por necessidade: mensagens e trocas primeiro, depois quem parou de registrar e quem
  // está com adesão baixa. O filtro começa em "Precisam de atenção" quando há alguém nela
  // (?filtro=atencao vem do "Ver todos" do Painel).
  const rows = patients
    .filter((p) => matchesSearch(query, p.person.full_name))
    .map((link) => {
      const id = link.person.id;
      const s = summaries[id];
      const a = adherence[id];
      const unreadCount = unread.get(id) ?? 0;
      const swapCount = pendingSwaps.get(id) ?? 0;
      const lowAdherence = a != null && a < 50 ? a : null;
      const inactive = !!s && isInactive(s.lastActive);
      const overGoal = !!s && !!s.goalKcal && s.avgKcal7 > s.goalKcal * 1.1;
      const score = (unreadCount + swapCount) * 100 + (inactive ? 10 : 0) + (lowAdherence !== null ? 5 : 0) + (overGoal ? 1 : 0);
      return { link, s, unreadCount, swapCount, lowAdherence, inactive, overGoal, score };
    })
    .sort((x, y) => y.score - x.score || (x.link.person.full_name ?? '').localeCompare(y.link.person.full_name ?? '', appLocale()));
  const needCount = rows.filter((r) => r.score > 0).length;
  const filter = filterChoice ?? (needCount > 0 ? 'attention' : 'all');
  const shown = filter === 'attention' ? rows.filter((r) => r.score > 0) : rows;

  // Antes de tocar em "Convidar": o que impede o convite aparece já, com o caminho para resolver.
  useEffect(() => {
    if (!user) return;
    getMyCrnStatus(user.id)
      .then((r) => setCrnStatus(r.status))
      .catch((e) => console.error('Error loading CRN status:', e));
  }, [user]);
  const crnBlocked = crnStatus !== null && crnStatus !== 'approved';
  const limitReached = premiumLoaded && !nutritionistPro && patients.length >= freePatientLimit;
  const isVisitor = usePremiumStore((s) => s.isVisitor);
  // Visitante da demonstração não convida (o banco recusa: o par demo nunca se liga a conta real).
  const canInvite = !crnBlocked && !limitReached && !isVisitor;

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
      showToast((t.care.errors[key as keyof typeof t.care.errors] ?? t.care.errors.unknown).replace('{max}', String(freePatientLimit)), 'error');
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
        // Outro paciente = componente novo: dados e formulário de metas nunca vêm do anterior.
        key={selected.person.id}
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
          {/* Um convite ao Premium por tela: com o limite atingido, fica só o aviso abaixo. */}
          {premiumLoaded && !nutritionistPro && (
            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {t.care.freeLimit.replace('{n}', String(patients.length)).replace('{max}', String(freePatientLimit))}{' '}
              {!limitReached && (
                <Link to="/mentoria-ia" className="font-semibold text-emerald-700 underline dark:text-emerald-300">
                  {t.care.unlimitedWithPremium}
                </Link>
              )}
            </p>
          )}
        </div>
        {!isVisitor && (
        <button
          type="button"
          onClick={newInvite}
          disabled={creating || !canInvite}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t.care.invitePatient}
        </button>
        )}
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
          <p className="min-w-0 flex-1">{t.care.errors.patient_limit.replace('{max}', String(freePatientLimit))}</p>
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
                className="absolute right-1 top-1 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 sm:top-1/2 sm:-translate-y-1/2 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
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
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mx-auto max-w-sm text-sm text-slate-600 dark:text-slate-300">{t.care.noPatients}</p>
          {canInvite && !invites.length && (
            <button
              type="button"
              onClick={newInvite}
              disabled={creating}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {t.care.invitePatient}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {patients.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800" role="group" aria-label={t.care.filterLabel}>
                {(['attention', 'all'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'min-h-[40px] rounded-lg px-3 text-sm font-medium transition-colors',
                      filter === key ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {key === 'attention' ? t.care.filterAttention.replace('{n}', String(needCount)) : t.care.filterAll.replace('{n}', String(patients.length))}
                  </button>
                ))}
              </div>
              {/* Busca só quando a lista já é grande o bastante para precisar. */}
              {patients.length > 6 && (
                <div className="relative w-full max-w-sm sm:w-auto sm:flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    aria-label={t.care.searchPatients}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.care.searchPatients}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}
            </div>
          )}
          {!shown.length ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {query.trim() ? t.care.noSearchResults.replace('{q}', query.trim()) : t.attention.allGood}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {shown.map(({ link: p, s, unreadCount, swapCount, lowAdherence, inactive, overGoal }) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openPatient(p)}
                    className="glass-card flex h-full w-full items-center gap-3 rounded-2xl border p-4 text-left transition-shadow duration-200 hover:shadow-lg"
                  >
                    <Avatar name={p.person.full_name} url={p.person.avatar_url} className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{p.person.full_name}</p>
                      {s ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t.care.lastLog}: {s.lastLog ? new Date(`${s.lastLog}T12:00:00`).toLocaleDateString(appLocale(), { day: '2-digit', month: '2-digit' }) : t.care.never}
                          {' • '}
                          {t.care.daysLogged7.replace('{n}', String(s.days7))}
                          {s.avgKcal7 > 0 && ` • ${s.avgKcal7}${s.goalKcal ? ` / ${s.goalKcal}` : ''} kcal`}
                        </p>
                      ) : (
                        !overviewFailed && <p className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                      )}
                      {(unreadCount > 0 || swapCount > 0 || lowAdherence !== null || inactive || overGoal) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {unreadCount > 0 && (
                            <StatusChip kind="messages">
                              {(unreadCount === 1 ? t.attention.messagesOne : t.attention.messagesMany).replace('{n}', String(unreadCount))}
                            </StatusChip>
                          )}
                          {swapCount > 0 && (
                            <StatusChip kind="swaps">
                              {(swapCount === 1 ? t.attention.swapsOne : t.attention.swapsMany).replace('{n}', String(swapCount))}
                            </StatusChip>
                          )}
                          {inactive && <StatusChip kind="inactive">{t.care.inactiveAlert}</StatusChip>}
                          {/* Adesão baixa: só com refeições suficientes para a % fazer sentido. */}
                          {lowAdherence !== null && (
                            <StatusChip kind="adherence">{t.adherence.lowAlert.replace('{percent}', String(lowAdherence))}</StatusChip>
                          )}
                          {overGoal && !inactive && <StatusChip kind="kcal">{t.care.overGoalAlert}</StatusChip>}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
