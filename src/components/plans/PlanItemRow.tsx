import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Carrot } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { itemNutrition } from '../../lib/plan-items';
import type { MealPlanItem } from '../../services/care';
import type { Recipe } from '../../types/recipe';

interface PlanItemRowProps {
  item: MealPlanItem;
  recipesById: Map<string, Recipe>;
  /** Imagem menor e sem link (editor). */
  compact?: boolean;
  /** Botões à direita (porções, remover, registrar...). */
  actions?: ReactNode;
}

/** Linha de um item do plano: receita (com foto e link) ou alimento do catálogo. */
export function PlanItemRow({ item, recipesById, compact, actions }: PlanItemRowProps) {
  const t = useTranslation();
  const kcal = itemNutrition(item, recipesById)?.calories;
  const size = compact ? 'h-9 w-9' : 'h-12 w-12';

  if (item.food_id) {
    return (
      <div className="flex items-center gap-3">
        <div className={`${size} flex flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300`}>
          <Carrot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.food?.name ?? t.plan.foodUnavailable}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.measure_label ?? `${item.grams} g`}
            {kcal !== undefined && ` • ${kcal} kcal`}
          </p>
        </div>
        {actions}
      </div>
    );
  }

  const recipe = item.recipe_id ? recipesById.get(item.recipe_id) : undefined;
  if (!recipe) return null;
  const content = (
    <>
      <img src={recipe.image} alt="" className={`${size} flex-shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-slate-800`} loading="lazy" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{recipe.title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item.servings} {t.plan.servingsShort} • {kcal} kcal
        </p>
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-3">
      {compact ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      ) : (
        <Link to={`/receita/${recipe.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-90">
          {content}
        </Link>
      )}
      {actions}
    </div>
  );
}
