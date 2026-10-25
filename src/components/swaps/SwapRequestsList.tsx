import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Check, Loader2, X } from 'lucide-react';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotificationSignal } from '../../store/notifications';
import {
  cancelSwap,
  hasRequestedChoice,
  listSwapsForClient,
  resolveSwap,
  swapChoiceLabel,
  swapChoiceText,
  type SwapChoice,
  type SwapRequest,
  type SwapStatus,
} from '../../services/swaps';
import { SwapChoicePicker } from './SwapChoicePicker';
import { cn } from '../../lib/utils';
import { appLocale } from '../../lib/format';

interface SwapRequestsListProps {
  clientId: string;
  role: 'client' | 'nutritionist';
  /** Muda para recarregar (ex.: depois de o paciente enviar um pedido). */
  refreshKey?: number;
  /** Chamado quando uma resposta altera o plano, para a tela do plano recarregar. */
  onPlanChanged?: () => void;
  /** Chamado quando o paciente cancela um pedido (a tela do plano tira a marca do item). */
  onCanceled?: () => void;
  /** Alergias do paciente: receitas com esses ingredientes não aparecem para oferecer. */
  allergies?: string[];
}

const STATUS_STYLE: Record<SwapStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  canceled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/** Pedidos de troca de um paciente. Paciente acompanha e cancela; nutricionista aprova ou recusa. */
export function SwapRequestsList({ clientId, role, refreshKey = 0, onPlanChanged, onCanceled, allergies = [] }: SwapRequestsListProps) {
  const t = useTranslation();
  const s = t.swaps;
  const { showToast } = useToastStore();
  const [swaps, setSwaps] = useState<SwapRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declining, setDeclining] = useState<{ id: string; note: string; counter: SwapChoice | null } | null>(null);
  // Pedido novo (nutricionista) ou resposta (paciente) chegou por aviso: recarrega a lista.
  const signal = useNotificationSignal((n) =>
    role === 'nutritionist' ? n.kind === 'swap_requested' && n.data.client_id === clientId : n.kind === 'swap_answered'
  );

  const load = useCallback(async () => {
    try {
      setSwaps(await listSwapsForClient(clientId));
    } catch (error) {
      console.error('Error loading swaps:', error);
      setSwaps([]);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load, refreshKey, signal]);

  if (!swaps) return null;
  // O paciente só vê a seção quando há pedidos; o nutricionista vê sempre (com o estado vazio).
  if (!swaps.length && role === 'client') return null;

  const where = (r: SwapRequest) => `${t.plan.daysLong[r.day]} • ${t.plan.meals[r.meal]}`;

  const approve = async (r: SwapRequest) => {
    if (!hasRequestedChoice(r)) {
      showToast(s.approveNeedsFood, 'warning');
      return;
    }
    setBusyId(r.id);
    try {
      await resolveSwap({ requestId: r.id, approve: true, note: '', counter: null });
      showToast(s.approved, 'success');
      onPlanChanged?.();
      await load();
    } catch (error) {
      console.error('Error approving swap:', error);
      showToast(s.resolveError, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const decline = async () => {
    if (!declining) return;
    setBusyId(declining.id);
    try {
      await resolveSwap({ requestId: declining.id, approve: false, note: declining.note, counter: declining.counter });
      showToast(declining.counter ? s.declinedWithOffer : s.declined, 'success');
      if (declining.counter) onPlanChanged?.();
      setDeclining(null);
      await load();
    } catch (error) {
      console.error('Error declining swap:', error);
      showToast(s.resolveError, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (r: SwapRequest) => {
    setBusyId(r.id);
    try {
      await cancelSwap(r.id);
      showToast(s.canceled, 'info');
      onCanceled?.();
      await load();
    } catch (error) {
      console.error('Error canceling swap:', error);
      showToast(s.error, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <ArrowLeftRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        {role === 'client' ? s.myTitle : s.title}
      </h3>
      {!swaps.length && <p className="text-sm text-slate-500 dark:text-slate-400">{s.empty}</p>}
      <ul className="space-y-3">
        {swaps.map((r) => (
          <li key={r.id} className="space-y-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {where(r)} • {new Date(r.created_at).toLocaleDateString(appLocale())}
              </p>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[r.status])}>{s.status[r.status]}</span>
            </div>
            <p className="font-medium text-slate-900 dark:text-white">{r.original_label}</p>
            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{s.wants}:</span>{' '}
              {swapChoiceLabel(r, 'requested', t.plan.servingsShort) ?? <em className="text-slate-400">{s.noFood}</em>}
            </p>
            {r.reason && (
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{s.reason}:</span> {r.reason}
              </p>
            )}
            {r.response_note && (
              <p className="text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{s.answer}:</span> {r.response_note}
              </p>
            )}
            {swapChoiceLabel(r, 'counter', t.plan.servingsShort) && (
              <p className="text-emerald-700 dark:text-emerald-300">
                <span className="font-semibold">{s.offered}:</span> {swapChoiceLabel(r, 'counter', t.plan.servingsShort)}
              </p>
            )}
            {r.status !== 'pending' && r.status !== 'canceled' && (r.status === 'approved' || r.counter_food_id || r.counter_recipe_id) && !r.applied && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{s.notApplied}</p>
            )}
            {/* "Aprovada" e "já vale" são estados diferentes: a troca entra no plano com a publicação. */}
            {r.applied && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {r.effective_from
                  ? s.effectiveFrom.replace('{date}', new Date(`${r.effective_from}T12:00:00`).toLocaleDateString(appLocale(), { day: '2-digit', month: '2-digit' }))
                  : s.awaitingPublish}
              </p>
            )}

            {r.status === 'pending' && role === 'client' && (
              <button
                type="button"
                onClick={() => cancel(r)}
                disabled={busyId === r.id}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 disabled:opacity-60 dark:text-slate-400"
              >
                {s.cancel}
              </button>
            )}

            {r.status === 'pending' && role === 'nutritionist' && declining?.id !== r.id && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => approve(r)}
                  disabled={busyId === r.id || !hasRequestedChoice(r)}
                  title={hasRequestedChoice(r) ? undefined : s.approveNeedsFood}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {s.approve}
                </button>
                <button
                  type="button"
                  onClick={() => setDeclining({ id: r.id, note: '', counter: null })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  {s.decline}
                </button>
              </div>
            )}

            {declining?.id === r.id && (
              <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-900/10">
                <p className="font-semibold text-slate-900 dark:text-white">{s.declineTitle}</p>
                <textarea
                  value={declining.note}
                  onChange={(e) => setDeclining({ ...declining, note: e.target.value })}
                  maxLength={500}
                  rows={2}
                  placeholder={s.notePlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.offerOther}</p>
                {declining.counter ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                    <p className="min-w-0 text-emerald-900 dark:text-emerald-100">
                      {swapChoiceText(declining.counter, t.plan.servingsShort)}
                    </p>
                    <button type="button" onClick={() => setDeclining({ ...declining, counter: null })} className="flex-shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {s.changeChoice}
                    </button>
                  </div>
                ) : (
                  <SwapChoicePicker
                    targetKcal={null}
                    allergies={allergies}
                    confirmLabel={s.offerThis}
                    onChoose={(counter) => setDeclining({ ...declining, counter })}
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDeclining(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={decline}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busyId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {s.confirmDecline}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
