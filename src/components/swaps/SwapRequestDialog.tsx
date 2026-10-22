import { useMemo, useState } from 'react';
import { ArrowLeftRight, Loader2, X } from 'lucide-react';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { requestSwap, swapChoiceText, type SwapChoice } from '../../services/swaps';
import type { MealPlanItem } from '../../services/care';
import { useRecipesStore } from '../../store/recipes';
import { useHealthProfileStore } from '../../store/health-profile';
import { itemNutrition } from '../../lib/plan-items';
import { SwapChoicePicker } from './SwapChoicePicker';

interface SwapRequestDialogProps {
  planId: string;
  item: MealPlanItem;
  /** Nome e quantidade do item atual, ex.: "Pão, trigo, forma, integral — 1 fatia (25 g)". */
  itemLabel: string;
  onClose: () => void;
  onSent: () => void;
}

/** Paciente pede a troca de um item do plano: escolhe o que gostaria (opcional) e explica o motivo. */
export function SwapRequestDialog({ planId, item, itemLabel, onClose, onSent }: SwapRequestDialogProps) {
  const t = useTranslation();
  const s = t.swaps;
  const { showToast } = useToastStore();
  const [requested, setRequested] = useState<SwapChoice | null>(null);
  const recipes = useRecipesStore((st) => st.recipes);
  const allergies = useHealthProfileStore((st) => st.profile.allergies);
  // Calorias do item atual: base para sugerir receitas e alimentos equivalentes.
  const currentKcal = useMemo(
    () => itemNutrition(item, new Map(recipes.map((r) => [r.id, r])))?.calories ?? null,
    [item, recipes]
  );
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!requested && !reason.trim()) {
      showToast(s.needSomething, 'warning');
      return;
    }
    setSending(true);
    try {
      await requestSwap({ planId, item, originalLabel: itemLabel, requested, reason });
      showToast(s.sent, 'success');
      onSent();
    } catch (error) {
      console.error('Error requesting swap:', error);
      const pending = error instanceof Error && error.message.includes('already_pending');
      showToast(pending ? s.alreadyPending : s.error, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <ArrowLeftRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {s.dialogTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.dialogIntro}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t.common.close}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{s.current}</p>
          <p className="font-medium text-slate-900 dark:text-white">{itemLabel}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.wantInstead}</p>
          {requested ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800/40 dark:bg-emerald-900/20">
              <p className="min-w-0 text-emerald-900 dark:text-emerald-100">
                <span className="font-semibold">{s.chosen}:</span> {swapChoiceText(requested, t.plan.servingsShort)}
              </p>
              <button type="button" onClick={() => setRequested(null)} className="flex-shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300">
                {s.changeChoice}
              </button>
            </div>
          ) : (
            <SwapChoicePicker
              targetKcal={currentKcal}
              baseFood={item.food && item.grams ? { food: item.food, grams: item.grams } : null}
              allergies={allergies}
              confirmLabel={s.chooseThis}
              onChoose={setRequested}
            />
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.reasonLabel}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={s.reasonPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {s.send}
          </button>
        </div>
      </div>
    </div>
  );
}
