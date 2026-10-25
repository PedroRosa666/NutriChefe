import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Settings2, Trash2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { MEAL_SLOTS, type MealSlot, type PlanMeal } from '../../services/care';
import { ALL_DAYS, MEAL_LIMITS, mealGuidanceOn, mealTimeOn } from '../../lib/plan-meals';
import { cn } from '../../lib/utils';

interface MealBlockHeaderProps {
  meal: PlanMeal;
  /** Dia aberto no editor (horário e orientação podem ser só deste dia). */
  day: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Parte sugerida das calorias do dia (mostrada quando o bloco não tem %). */
  suggestedShare: number | null;
  onChange: (patch: Partial<PlanMeal>) => void;
  /** Liga ou desliga um dia (o editor confirma antes de tirar itens). */
  onToggleDay: (day: number) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]';
const iconButton =
  'rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-slate-800 dark:hover:text-slate-200';

/**
 * Cabeçalho de um bloco de refeição no editor: nome, horário e as ações (subir, descer, duplicar,
 * remover) por botões, sem depender de arrastar. Os ajustes abrem dias, tipo, orientação e % do dia.
 */
export function MealBlockHeader({
  meal,
  day,
  canMoveUp,
  canMoveDown,
  suggestedShare,
  onChange,
  onToggleDay,
  onMove,
  onDuplicate,
  onRemove,
}: MealBlockHeaderProps) {
  const t = useTranslation();
  const p = t.plan;
  const [open, setOpen] = useState(false);
  const key = String(day);
  const override = meal.dayOverrides[key];

  // Com ajuste só deste dia, horário e orientação mudam o do dia; senão, o de todos os dias.
  const setTime = (time: string) => {
    if (override) onChange({ dayOverrides: { ...meal.dayOverrides, [key]: { ...override, time: time || undefined } } });
    else onChange({ time: time || null });
  };
  const setGuidance = (guidance: string) => {
    if (override) onChange({ dayOverrides: { ...meal.dayOverrides, [key]: { ...override, guidance: guidance || undefined } } });
    else onChange({ guidance });
  };
  const toggleOverride = (on: boolean) => {
    const next = { ...meal.dayOverrides };
    if (on) next[key] = { time: meal.time ?? undefined, guidance: meal.guidance || undefined };
    else delete next[key];
    onChange({ dayOverrides: next });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <input
          value={meal.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={MEAL_LIMITS.name}
          aria-label={p.mealName}
          placeholder={p.newMealName}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-emerald-400 focus:outline-none dark:text-slate-100 dark:hover:border-slate-700"
        />
        <input
          type="time"
          value={mealTimeOn(meal, day) ?? ''}
          onChange={(e) => setTime(e.target.value)}
          aria-label={p.mealTime}
          className="w-[5.5rem] flex-shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:[color-scheme:dark]"
        />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={p.mealSettings} title={p.mealSettings} className={cn(iconButton, open && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200')}>
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label={p.moveUp} title={p.moveUp} className={iconButton}>
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={!canMoveDown} aria-label={p.moveDown} title={p.moveDown} className={iconButton}>
              <ArrowDown className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDuplicate} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <Copy className="h-3.5 w-3.5" />
              {p.duplicateMeal}
            </button>
            <button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
              <Trash2 className="h-3.5 w-3.5" />
              {p.removeMeal}
            </button>
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{p.mealDays}</legend>
            <div className="flex flex-wrap gap-1">
              {ALL_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="checkbox"
                  aria-checked={meal.days.includes(d)}
                  aria-label={p.daysLong[d]}
                  onClick={() => onToggleDay(d)}
                  className={cn(
                    'min-w-[2.5rem] rounded-md border px-1.5 py-1 text-xs font-semibold',
                    meal.days.includes(d)
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-slate-200 text-slate-500 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-400'
                  )}
                >
                  {p.days[d]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{p.mealCategory}</span>
              <select
                value={meal.category ?? ''}
                onChange={(e) => onChange({ category: (e.target.value || null) as MealSlot | null })}
                className={fieldClass}
              >
                {MEAL_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {p.meals[slot]}
                  </option>
                ))}
                <option value="">{p.mealCategoryNone}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{p.mealShare}</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                inputMode="decimal"
                value={meal.kcalShare ?? ''}
                placeholder={suggestedShare !== null ? p.mealSharePlaceholder.replace('{n}', String(Math.round(suggestedShare))) : ''}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(',', '.'));
                  onChange({ kcalShare: e.target.value === '' ? null : Number.isFinite(v) && v > 0 && v <= 100 ? Math.round(v * 10) / 10 : meal.kcalShare });
                }}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{p.mealGuidance}</span>
            <textarea
              value={mealGuidanceOn(meal, day)}
              onChange={(e) => setGuidance(e.target.value)}
              maxLength={MEAL_LIMITS.guidance}
              rows={2}
              placeholder={p.mealGuidancePlaceholder}
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={Boolean(override)} onChange={(e) => toggleOverride(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
            {p.mealDayOverride.replace('{day}', p.daysLong[day])}
          </label>
        </div>
      )}

      {!open && mealGuidanceOn(meal, day) && <p className="px-1.5 text-xs italic text-slate-500 dark:text-slate-400">{mealGuidanceOn(meal, day)}</p>}
    </div>
  );
}
