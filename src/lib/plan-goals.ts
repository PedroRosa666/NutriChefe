// Metas do paciente aplicadas ao plano alimentar: o que conta como "passar da meta" no dia e
// quão longe um conjunto de nutrientes está das metas (usado pelo gerador automático).
import type { GoalKey, NutritionGoals } from '../store/nutrition-goals';
import type { NutritionTotals } from '../store/nutrition-tracking';

export const PLAN_GOAL_KEYS: GoalKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

/**
 * Quanto cada nutriente pode passar da meta do dia antes de virar aviso. Calorias são o que
 * mais pesa no resultado; fibra e proteína acima da meta são menos problemáticas, então têm folga maior.
 */
export const OVER_TOLERANCE: Record<GoalKey, number> = {
  calories: 0.1,
  protein: 0.25,
  carbs: 0.15,
  fat: 0.15,
  fiber: 0.3,
};

export interface GoalExcess {
  key: GoalKey;
  total: number;
  goal: number;
}

/** Nutrientes do dia acima da meta além da folga (metas zeradas ficam de fora). */
export function goalExcesses(totals: NutritionTotals, goals: Partial<NutritionGoals>): GoalExcess[] {
  return PLAN_GOAL_KEYS.flatMap((key) => {
    const goal = goals[key] ?? 0;
    const total = totals[key];
    return goal > 0 && total > goal * (1 + OVER_TOLERANCE[key]) ? [{ key, total, goal }] : [];
  });
}

/** Metas que passam a estourar com a mudança (as que já estavam acima não se repetem). */
export function newExcesses(before: NutritionTotals, after: NutritionTotals, goals: Partial<NutritionGoals>): GoalExcess[] {
  const already = new Set(goalExcesses(before, goals).map((e) => e.key));
  return goalExcesses(after, goals).filter((e) => !already.has(e.key));
}

// Peso de cada nutriente na distância: calorias primeiro, depois os macros.
const WEIGHT: Record<GoalKey, number> = { calories: 3, protein: 1.2, carbs: 1, fat: 1, fiber: 0.6 };
// Faltar proteína pesa mais que faltar fibra; passar da meta pesa mais que faltar. Carboidrato pesa
// quase como proteína: com catálogo rico em gordura, um peso baixo deixava os dias com ~60% da meta.
const DEFICIT: Record<GoalKey, number> = { calories: 1, protein: 1.2, carbs: 1.3, fat: 0.8, fiber: 0.5 };
const EXCESS = 1.5;
// Além da folga, cada ponto percentual a mais custa bem mais: o gerador foge de estourar.
const BEYOND_TOLERANCE = 6;

/**
 * Piso: calorias, proteína e carboidrato abaixo de 80% da meta são um dia mal montado, não só
 * "um pouco abaixo". Abaixo do piso, cada ponto a menos custa mais (espelho da folga de cima).
 */
export const FLOOR = 0.2;
const FLOOR_KEYS: GoalKey[] = ['calories', 'protein', 'carbs'];
const BELOW_FLOOR = 3;

/** Nutrientes do dia abaixo do piso (metas zeradas ficam de fora). */
export function belowFloor(totals: NutritionTotals, goals: Partial<NutritionGoals>): GoalKey[] {
  return FLOOR_KEYS.filter((key) => (goals[key] ?? 0) > 0 && totals[key] < (goals[key] ?? 0) * (1 - FLOOR));
}

/**
 * Distância entre os nutrientes e um alvo, em fração da escala de cada nutriente (`scale`,
 * normalmente a meta do dia ou a parte dela que cabe à refeição). 0 = exatamente no alvo.
 */
export function goalDistance(totals: NutritionTotals, target: Partial<NutritionGoals>, scale: Partial<NutritionGoals> = target): number {
  let cost = 0;
  for (const key of PLAN_GOAL_KEYS) {
    const unit = scale[key] ?? 0;
    if (unit <= 0) continue;
    const rel = (totals[key] - (target[key] ?? 0)) / unit;
    if (rel > 0) {
      cost += WEIGHT[key] * (rel * EXCESS + Math.max(0, rel - OVER_TOLERANCE[key]) * BEYOND_TOLERANCE);
    } else {
      const below = FLOOR_KEYS.includes(key) ? Math.max(0, -rel - FLOOR) * BELOW_FLOOR : 0;
      cost += WEIGHT[key] * (-rel * DEFICIT[key] + below);
    }
  }
  return cost;
}

export const addTotals = (a: NutritionTotals, b: NutritionTotals): NutritionTotals => ({
  calories: a.calories + b.calories,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
  fiber: a.fiber + b.fiber,
});

export const subTotals = (a: NutritionTotals, b: NutritionTotals): NutritionTotals => ({
  calories: a.calories - b.calories,
  protein: a.protein - b.protein,
  carbs: a.carbs - b.carbs,
  fat: a.fat - b.fat,
  fiber: a.fiber - b.fiber,
});

export const ZERO_TOTALS: NutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
