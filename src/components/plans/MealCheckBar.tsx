import { useState } from 'react';
import { Check, CircleSlash, Loader2, Shuffle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { mealBlocks } from '../../lib/plan-items';
import type { CheckStatus, MealCheck } from '../../lib/adherence';
import type { MealPlanItem } from '../../services/care';
import { cn } from '../../lib/utils';

interface MealCheckBarProps {
  /** Itens da refeição no dia (fixos e grupos "escolha 1"). */
  items: MealPlanItem[];
  check?: MealCheck;
  busy: boolean;
  itemName: (item: MealPlanItem) => string;
  /** `eaten`: o que entrou no diário (itens fixos + a opção escolhida de cada grupo). */
  onSave: (status: CheckStatus, eaten: MealPlanItem[], note: string) => void;
  onClear: () => void;
}

const STYLE: Record<CheckStatus, string> = {
  ate: 'border-emerald-500 bg-emerald-600 text-white',
  other: 'border-amber-400 bg-amber-500 text-white',
  skipped: 'border-rose-400 bg-rose-500 text-white',
};

/** "Como foi?" de uma refeição: comeu o do plano, comeu outra coisa ou pulou. */
export function MealCheckBar({ items, check, busy, itemName, onSave, onClear }: MealCheckBarProps) {
  const t = useTranslation();
  const a = t.adherence;
  const blocks = mealBlocks(items);
  const groups = blocks.filter((b) => b.kind === 'choice');
  const fixed = blocks.flatMap((b) => (b.kind === 'single' ? [b.item] : []));
  const [panel, setPanel] = useState<'choose' | 'note' | null>(null);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [note, setNote] = useState('');

  const ate = () => {
    // Com opções "escolha 1": primeiro a pessoa diz qual comeu.
    if (groups.length) {
      setPanel('choose');
      return;
    }
    onSave('ate', fixed, '');
  };

  const confirmAte = () => {
    const chosen = groups.map((g) => (g.kind === 'choice' ? g.items[picks[g.group] ?? 0] : null)).filter((i): i is MealPlanItem => Boolean(i));
    onSave('ate', [...fixed, ...chosen], '');
    setPanel(null);
  };

  const chip = (status: CheckStatus, label: string, Icon: typeof Check, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={check?.status === status}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-1.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 sm:flex-none sm:gap-1.5 sm:px-2.5',
        check?.status === status
          ? STYLE[status]
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{a.howWasIt}</p>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        {check && !busy && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            {a.clear}
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {chip('ate', a.ate, Check, ate)}
        {chip('other', a.other, Shuffle, () => {
          setNote(check?.status === 'other' ? check.note : '');
          setPanel('note');
        })}
        {chip('skipped', a.skipped, CircleSlash, () => {
          setPanel(null);
          onSave('skipped', [], '');
        })}
      </div>

      {check?.status === 'other' && check.note && panel !== 'note' && (
        <p className="text-xs italic text-slate-500 dark:text-slate-400">“{check.note}”</p>
      )}

      {panel === 'choose' && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">{a.whichOption}</p>
          {groups.map((g, gi) =>
            g.kind === 'choice' ? (
              <fieldset key={g.group} className="space-y-1">
                {groups.length > 1 && <legend className="text-xs text-slate-500 dark:text-slate-400">{a.optionGroup.replace('{n}', String(gi + 1))}</legend>}
                {g.items.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                    <input
                      type="radio"
                      name={`g${g.group}`}
                      checked={(picks[g.group] ?? 0) === i}
                      onChange={() => setPicks((p) => ({ ...p, [g.group]: i }))}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="min-w-0 truncate">{itemName(item)}</span>
                  </label>
                ))}
              </fieldset>
            ) : null
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPanel(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:text-slate-300">
              {t.common.cancel}
            </button>
            <button type="button" onClick={confirmAte} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              {a.confirmAte}
            </button>
          </div>
        </div>
      )}

      {panel === 'note' && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave('other', [], note);
            setPanel(null);
          }}
        >
          <input aria-label={a.otherPlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={a.otherPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPanel(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {t.common.cancel}
            </button>
            <button type="submit" className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
              {a.saveOther}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
