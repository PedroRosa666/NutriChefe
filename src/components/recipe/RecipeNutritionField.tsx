import { useId } from 'react';
import { countText } from '../../lib/format';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import {
  NUTRIENT_KEYS,
  isValidYield,
  parseAmount,
  perServing,
  readNutritionDraft,
  type IngredientCalc,
  type NutritionBasis,
  type NutritionDraft,
} from '../../lib/recipe-nutrition';

const UNITS: Record<string, string> = { calories: 'kcal', protein: 'g', carbs: 'g', fat: 'g', fiber: 'g' };

interface RecipeNutritionFieldProps {
  draft: NutritionDraft;
  onChange: (draft: NutritionDraft) => void;
  /** Receita antiga ainda sem revisão: mostra a opção "como estavam". */
  legacy?: boolean;
  inputClass: string;
  labelClass: string;
  /** Prévia do cálculo pelos ingredientes (useIngredientCalc). */
  calc: IngredientCalc;
  /** Valores à mão que precisam de revisão (ingredientes ou rendimento mudaram). */
  needsReview?: boolean;
}

/** Rendimento, porção e valores nutricionais com a base declarada (por porção ou receita inteira). */
export function RecipeNutritionField({ draft, onChange, legacy, inputClass, labelClass, calc, needsReview }: RecipeNutritionFieldProps) {
  const t = useTranslation();
  const f = t.recipeForm;
  const fid = useId();
  const set = <K extends keyof NutritionDraft>(key: K, value: NutritionDraft[K]) => onChange({ ...draft, [key]: value });

  const yieldValue = parseAmount(draft.yieldServings);
  const yieldInvalid = !isValidYield(yieldValue);
  const read = readNutritionDraft(draft);
  // Prévia de uma porção quando os valores são da receita inteira (a mesma conta do banco).
  const preview =
    read.ok && draft.basis === 'whole_recipe'
      ? NUTRIENT_KEYS.flatMap((k) => {
          const v = perServing(read.value.nutritionDeclared, 'whole_recipe', read.value.yieldServings)[k];
          return v === undefined ? [] : [`${t.profile.nutritionGoalsnames[k]} ${v.toLocaleString('pt-BR')} ${UNITS[k]}`];
        })
      : [];

  const format = (values: Partial<Record<(typeof NUTRIENT_KEYS)[number], number>>) =>
    NUTRIENT_KEYS.flatMap((k) =>
      values[k] === undefined ? [] : [`${t.profile.nutritionGoalsnames[k]} ${values[k]!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${UNITS[k]}`]
    ).join(' · ');
  const calcPerServing = yieldValue && Number.isFinite(yieldValue) && yieldValue > 0 ? perServing(calc.total, 'whole_recipe', yieldValue) : null;

  const bases: NutritionBasis[] = legacy ? ['legacy_unit', 'per_serving', 'whole_recipe'] : ['per_serving', 'whole_recipe'];
  const basisLabel: Record<NutritionBasis, string> = {
    per_serving: f.basisPerServing,
    whole_recipe: f.basisWhole,
    legacy_unit: f.basisLegacy,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor={`${fid}-y`} className={labelClass}>{f.yieldServings}</label>
          <input
            id={`${fid}-y`}
            inputMode="decimal"
            value={draft.yieldServings}
            onChange={(e) => set('yieldServings', e.target.value)}
            placeholder={f.yieldPlaceholder}
            aria-invalid={yieldInvalid}
            className={cn(inputClass, yieldInvalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/50')}
          />
          {yieldInvalid && <p className="text-xs text-red-600 dark:text-red-400">{f.invalidYield}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${fid}-l`} className={labelClass}>{f.servingLabel}</label>
          <input
            id={`${fid}-l`}
            value={draft.servingLabel}
            maxLength={80}
            onChange={(e) => set('servingLabel', e.target.value)}
            placeholder={f.servingLabelPlaceholder}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${fid}-sw`} className={labelClass}>
            {f.servingWeight} <span className="font-normal text-slate-400">({f.optional})</span>
          </label>
          <input id={`${fid}-sw`} inputMode="decimal" value={draft.servingWeightG} onChange={(e) => set('servingWeightG', e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${fid}-fw`} className={labelClass}>
            {f.finalWeight} <span className="font-normal text-slate-400">({f.optional})</span>
          </label>
          <input id={`${fid}-fw`} inputMode="decimal" value={draft.finalWeightG} onChange={(e) => set('finalWeightG', e.target.value)} className={inputClass} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>{f.sourceTitle}</legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {(['manual', 'ingredients'] as const).map((source) => (
            <label
              key={source}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                draft.source === source
                  ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              )}
            >
              <input type="radio" name={`${fid}-source`} className="sr-only" checked={draft.source === source} onChange={() => set('source', source)} />
              {source === 'manual' ? f.sourceManual : f.sourceIngredients}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.source === 'ingredients' ? (
        <div className="space-y-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs text-slate-600 dark:text-slate-300">{f.calcHint}</p>
          {yieldValue === null && <p className="text-xs text-red-600 dark:text-red-400">{f.calcNeedsYield}</p>}
          <p
            className={cn(
              'font-medium',
              calc.status === 'complete' ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'
            )}
          >
            {calc.status === 'complete'
              ? f.calcComplete.replace('{n}', String(calc.counted))
              : calc.status === 'partial'
                ? countText(f.calcPartial, calc.issues.length)
                : f.calcUnknown}
          </p>
          {calc.counted > 0 && (
            <>
              <p className="text-slate-700 dark:text-slate-200">{f.calcWhole.replace('{values}', format(calc.total))}</p>
              {calcPerServing && <p className="font-semibold text-slate-900 dark:text-white">{f.calcPerServing.replace('{values}', format(calcPerServing))}</p>}
            </>
          )}
        </div>
      ) : (
        <>
          {needsReview && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{f.needsReview}</p>}
          <fieldset className="space-y-2">
            <legend className={labelClass}>{f.basisTitle}</legend>
            <div className="flex flex-wrap gap-2 pt-1">
              {bases.map((basis) => (
                <label
                  key={basis}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                    draft.basis === basis
                      ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  )}
                >
                  <input type="radio" name={`${fid}-basis`} className="sr-only" checked={draft.basis === basis} onChange={() => set('basis', basis)} />
                  {basisLabel[basis]}
                </label>
              ))}
            </div>
            {draft.basis === 'legacy_unit' && <p className="text-xs text-amber-700 dark:text-amber-300">{f.basisLegacyHint}</p>}
            {draft.basis === 'whole_recipe' && yieldValue === null && (
              <p className="text-xs text-red-600 dark:text-red-400">{f.wholeNeedsYield}</p>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {NUTRIENT_KEYS.map((key) => (
              <div key={key} className="space-y-1.5">
                <label htmlFor={`${fid}-n-${key}`} className="block text-xs font-medium text-slate-600 dark:text-slate-200 sm:text-sm">
                  {t.profile.nutritionGoalsnames[key]}
                </label>
                <div className="relative">
                  <input
                    id={`${fid}-n-${key}`}
                    inputMode="decimal"
                    value={draft.values[key]}
                    onChange={(e) => set('values', { ...draft.values, [key]: e.target.value })}
                    placeholder="—"
                    className={cn(inputClass, 'pr-10')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 dark:text-slate-500">{UNITS[key]}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{f.unknownHint}</p>
          {preview.length > 0 && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
              {f.perServingPreview.replace('{values}', preview.join(' · '))}
            </p>
          )}
        </>
      )}
    </div>
  );
}

