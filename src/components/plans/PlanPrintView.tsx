import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettingsStore } from '../../store/settings';
import { MEAL_SLOTS, type MealPlan, type MealPlanItem } from '../../services/care';
import { groupEqualDays, itemNutrition, itemsTotals, mealBlocks } from '../../lib/plan-items';
import type { Recipe } from '../../types/recipe';
import { fmtNum } from '../../lib/format';

interface PlanPrintViewProps {
  plan: MealPlan;
  recipesById: Map<string, Recipe>;
  patientName: string;
  /** Chamado quando a janela de impressão fecha. */
  onDone: () => void;
}

/**
 * Versão do plano para imprimir ou salvar em PDF (pela janela de impressão do navegador).
 * Fica escondida na tela; durante a impressão só ela aparece (ver .plan-print-root em index.css).
 */
export function PlanPrintView({ plan, recipesById, patientName, onDone }: PlanPrintViewProps) {
  const t = useTranslation();
  const p = t.plan;
  const locale = useSettingsStore((s) => (s.language === 'pt' ? 'pt-BR' : 'en'));
  const num = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 });

  useEffect(() => {
    const html = document.documentElement;
    const previousTitle = document.title;
    // O título vira o nome sugerido do arquivo PDF.
    document.title = `${plan.title} - ${patientName}`.trim();
    html.classList.add('printing-plan');
    const finish = () => {
      html.classList.remove('printing-plan');
      document.title = previousTitle;
      onDone();
    };
    window.addEventListener('afterprint', finish, { once: true });
    // Espera o conteúdo ser desenhado antes de abrir a janela de impressão.
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
      html.classList.remove('printing-plan');
      document.title = previousTitle;
    };
  }, [plan.title, patientName, onDone]);

  const dayLabel = (days: number[]) => {
    const name = (d: number) => p.daysLong[d];
    if (days.length === 1) return name(days[0]);
    if (days.length === 2) return p.printAnd.replace('{a}', name(days[0])).replace('{b}', name(days[1]));
    return p.printRange.replace('{from}', name(days[0])).replace('{to}', name(days[days.length - 1]));
  };

  const itemName = (item: MealPlanItem) => {
    if (item.food_id) return item.food?.name ?? p.foodUnavailable;
    return (item.recipe_id && recipesById.get(item.recipe_id)?.title) || '';
  };
  const itemAmount = (item: MealPlanItem) =>
    item.food_id ? item.measure_label ?? `${item.grams} g` : `${fmtNum(item.servings)} ${p.servingsShort}`;

  const itemLine = (item: MealPlanItem) => {
    const kcal = itemNutrition(item, recipesById)?.calories;
    return (
      <>
        <span className="font-medium">{itemName(item)}</span>
        <span className="text-slate-600"> — {itemAmount(item)}</span>
        {kcal !== undefined && <span className="text-slate-500"> ({kcal} kcal)</span>}
        {item.note && <span className="block text-[11px] italic text-slate-500">{item.note}</span>}
      </>
    );
  };

  const groups = groupEqualDays(plan.items);
  const today = new Date().toLocaleDateString();

  return createPortal(
    <div className="plan-print-root text-[12px] leading-snug text-slate-900" style={{ background: '#fff' }}>
      <header className="mb-4 border-b-2 border-emerald-600 pb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">NutriChef</p>
        <h1 className="mt-1 text-2xl font-bold">{plan.title}</h1>
        <p className="mt-1 text-slate-600">
          {patientName && (
            <>
              <span className="font-semibold text-slate-800">{p.printPatient}:</span> {patientName}
              {' • '}
            </>
          )}
          {plan.authorName && (
            <>
              <span className="font-semibold text-slate-800">{p.printNutritionist}:</span> {plan.authorName}
              {' • '}
            </>
          )}
          {p.updated} {new Date(plan.updated_at).toLocaleDateString()}
        </p>
      </header>

      {plan.notes && (
        <section className="mb-4 break-inside-avoid rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">{p.printGuidance}</p>
          <p className="mt-1 whitespace-pre-line">{plan.notes}</p>
        </section>
      )}

      {groups.map(({ days, items }) => {
        const totals = itemsTotals(items, recipesById);
        return (
          <section key={days.join('-')} className="mb-5">
            <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-slate-300 pb-1 break-after-avoid">
              <h2 className="text-base font-bold text-emerald-800">{dayLabel(days)}</h2>
              <p className="text-[11px] text-slate-600">
                {p.printPerDay.replace('{kcal}', num(totals.calories))} • {p.printProtein} {num(totals.protein)} g • {p.printCarbs}{' '}
                {num(totals.carbs)} g • {p.printFat} {num(totals.fat)} g
              </p>
            </div>
            <div className="space-y-2">
              {MEAL_SLOTS.map((meal) => {
                const mealItems = items.filter((i) => i.meal === meal);
                if (!mealItems.length) return null;
                return (
                  <div key={meal} className="break-inside-avoid">
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{p.meals[meal]}</h3>
                    <ul className="mt-0.5 space-y-1">
                      {mealBlocks(mealItems).map((block, i) =>
                        block.kind === 'single' ? (
                          <li key={i} className="pl-3">
                            • {itemLine(block.item)}
                          </li>
                        ) : (
                          <li key={i} className="rounded border border-emerald-200 px-3 py-1.5">
                            <p className="text-[11px] font-semibold text-emerald-800">{p.chooseOne}:</p>
                            <ul className="mt-0.5 space-y-0.5">
                              {block.items.map((item, j) => (
                                <li key={j}>○ {itemLine(item)}</li>
                              ))}
                            </ul>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <footer className="mt-6 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
        {p.printFooter.replace('{date}', today)}
      </footer>
    </div>,
    document.body
  );
}
