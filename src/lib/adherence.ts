// Adesão ao plano: o paciente marca cada refeição (comeu / outra coisa / pulou) e o
// nutricionista vê a % de refeições seguidas. Regras puras, usadas pelas duas telas.
import type { MealPlan, MealSlot } from '../services/care';
import { MEAL_SLOTS, planDayOf } from '../services/care';
import { toISODate } from '../store/nutrition-tracking';

export type CheckStatus = 'ate' | 'other' | 'skipped';
export type SlotStatus = CheckStatus | 'none';

export interface MealCheck {
  id: string;
  plan_id: string;
  check_date: string; // AAAA-MM-DD
  meal: MealSlot;
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
  /** Grade dia × refeição (só as refeições previstas aparecem). */
  grid: { date: string; slots: { meal: MealSlot; status: SlotStatus }[] }[];
  /** Por refeição: quantas vezes saiu do plano (outra coisa ou pulou) e as anotações. */
  byMeal: { meal: MealSlot; planned: number; ate: number; off: number; notes: string[] }[];
}

/**
 * Resume a adesão de `dates` usando o cardápio de `plan` (o que estava previsto em cada dia
 * da semana) e as marcações. Dias antes de o plano existir não contam.
 */
export function summarizeAdherence(plan: Pick<MealPlan, 'items' | 'created_at'>, checks: MealCheck[], dates: string[]): AdherenceSummary {
  // Data local de criação (em UTC, um plano criado depois das 21h cairia no dia seguinte).
  const created = new Date(plan.created_at);
  const planStart = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
  const byKey = new Map(checks.map((c) => [`${c.check_date}|${c.meal}`, c]));
  const meals = new Map(MEAL_SLOTS.map((m) => [m, { meal: m, planned: 0, ate: 0, off: 0, notes: [] as string[] }]));
  const summary: AdherenceSummary = { planned: 0, ate: 0, other: 0, skipped: 0, unmarked: 0, percent: null, grid: [], byMeal: [] };

  for (const date of dates) {
    if (date < planStart) continue;
    const day = planDayOf(new Date(`${date}T12:00:00`));
    const slots = MEAL_SLOTS.filter((m) => plan.items.some((i) => i.day === day && i.meal === m)).map((meal) => {
      const check = byKey.get(`${date}|${meal}`);
      const status: SlotStatus = check?.status ?? 'none';
      const row = meals.get(meal)!;
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
      return { meal, status };
    });
    if (slots.length) summary.grid.push({ date, slots });
  }

  summary.percent = summary.planned ? Math.round((summary.ate / summary.planned) * 100) : null;
  summary.byMeal = [...meals.values()].filter((m) => m.planned > 0);
  return summary;
}
