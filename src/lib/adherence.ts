// Adesão ao plano: o paciente marca cada refeição (comeu / outra coisa / pulou) e o
// nutricionista vê a % de refeições seguidas. Regras puras, usadas pelas duas telas.
import type { MealPlan, MealPlanItem, MealSlot, PlanMeal } from '../services/care';
import { planDayOf } from '../services/care';
import { mealItems, mealsOnDay } from './plan-meals';
import { toISODate } from '../store/nutrition-tracking';

export type CheckStatus = 'ate' | 'other' | 'skipped';
export type SlotStatus = CheckStatus | 'none';

export interface MealCheck {
  id: string;
  plan_id: string;
  check_date: string; // AAAA-MM-DD
  /** Bloco de refeição marcado e o nome dele no dia da marcação. */
  meal_id: string;
  meal_name: string | null;
  meal: MealSlot | null;
  status: CheckStatus;
  chosen: string[];
  note: string;
}

/** Data (AAAA-MM-DD) do dia `day` do plano (0 = segunda) na semana que termina hoje: nunca no futuro. */
export function dateForPlanDay(day: number, today = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() - ((planDayOf(today) - day + 7) % 7));
  return toISODate(d);
}

/** Dias de `from` até `to` (inclusive), em AAAA-MM-DD. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (d <= end) {
    out.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export interface AdherenceSummary {
  /** Refeições previstas no plano no período. */
  planned: number;
  ate: number;
  other: number;
  skipped: number;
  /** Previstas sem marcação. */
  unmarked: number;
  /** % de refeições seguidas (comeu o do plano) sobre as previstas; null sem refeições previstas. */
  percent: number | null;
  /** Grade dia × refeição (só as refeições previstas em cada dia aparecem). */
  grid: { date: string; slots: { mealId: string; status: SlotStatus }[] }[];
  /** Por refeição (bloco): quantas vezes saiu do plano (outra coisa ou pulou) e as anotações. */
  byMeal: { mealId: string; name: string; planned: number; ate: number; off: number; notes: string[] }[];
}

/** O que estava prescrito em cada data: blocos e itens da versão daquele dia, ou null se não havia plano. */
export interface PlanSchedule {
  planOn: (date: string) => { meals: PlanMeal[]; items: MealPlanItem[] } | null;
}

/** Um plano sem versões: o mesmo cardápio desde o dia em que foi criado. */
function staticSchedule(plan: Pick<MealPlan, 'meals' | 'items' | 'created_at'>): PlanSchedule {
  // Data local de criação (em UTC, um plano criado depois das 21h cairia no dia seguinte).
  const created = new Date(plan.created_at);
  const planStart = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
  return { planOn: (date) => (date < planStart ? null : plan) };
}

/**
 * Resume a adesão de `dates` com o que estava prescrito em cada data (a versão do plano que valia
 * no dia) e as marcações. Cada dia conta só as refeições daquele dia: um dia com quatro refeições
 * não ganha faltas por causa de outro com seis. Dias sem plano não contam.
 */
export function summarizeAdherence(
  plan: PlanSchedule | Pick<MealPlan, 'meals' | 'items' | 'created_at'>,
  checks: MealCheck[],
  dates: string[]
): AdherenceSummary {
  const schedule = 'planOn' in plan ? plan : staticSchedule(plan);
  const byKey = new Map(checks.map((c) => [`${c.check_date}|${c.meal_id}`, c]));
  const meals = new Map<string, AdherenceSummary['byMeal'][number]>();
  const summary: AdherenceSummary = { planned: 0, ate: 0, other: 0, skipped: 0, unmarked: 0, percent: null, grid: [], byMeal: [] };

  for (const date of dates) {
    const prescribed = schedule.planOn(date);
    if (!prescribed) continue;
    const day = planDayOf(new Date(`${date}T12:00:00`));
    // Bloco sem itens no dia não é refeição prescrita.
    const dayMeals = mealsOnDay(prescribed.meals, day).filter((m) => mealItems(prescribed.items, m.id, day).length > 0);
    const slots = dayMeals.map((meal) => {
      const check = byKey.get(`${date}|${meal.id}`);
      const status: SlotStatus = check?.status ?? 'none';
      const row = meals.get(meal.id) ?? { mealId: meal.id, name: meal.name, planned: 0, ate: 0, off: 0, notes: [] };
      // O nome mais recente (datas em ordem): renomear não separa a mesma refeição em duas linhas.
      row.name = meal.name;
      meals.set(meal.id, row);
      row.planned++;
      summary.planned++;
      if (status === 'ate') {
        summary.ate++;
        row.ate++;
      } else if (status === 'none') {
        summary.unmarked++;
      } else {
        summary[status]++;
        row.off++;
        if (check?.note) row.notes.push(check.note);
      }
      return { mealId: meal.id, status };
    });
    if (slots.length) summary.grid.push({ date, slots });
  }

  summary.percent = summary.planned ? Math.round((summary.ate / summary.planned) * 100) : null;
  summary.byMeal = [...meals.values()];
  return summary;
}
