import { describe, expect, it } from 'vitest';
import { dateForPlanDay, dateRange, summarizeAdherence, type MealCheck } from '../adherence';
import type { MealPlanItem } from '../../services/care';

const item = (day: number, meal: MealPlanItem['meal']): MealPlanItem => ({
  day, meal, recipe_id: 'r', servings: 1, food_id: null, grams: null, measure_label: null, option_group: null, note: '',
});
const check = (check_date: string, meal: MealCheck['meal'], status: MealCheck['status'], note = ''): MealCheck => ({
  id: `${check_date}${meal}`, plan_id: 'p', check_date, meal, status, chosen: [], note,
});

describe('dateForPlanDay', () => {
  // 2026-10-22 é uma quinta (dia 3 do plano).
  const thursday = new Date('2026-10-22T10:00:00');
  it('hoje e dias anteriores da semana; nunca no futuro', () => {
    expect(dateForPlanDay(3, thursday)).toBe('2026-10-22');
    expect(dateForPlanDay(0, thursday)).toBe('2026-10-19');
    // Sexta ainda não chegou: é a sexta passada.
    expect(dateForPlanDay(4, thursday)).toBe('2026-10-16');
  });
});

describe('summarizeAdherence', () => {
  // Plano: almoço todo dia; jantar só na segunda (19/10).
  const plan = { created_at: '2026-10-19T08:00:00Z', items: [...[0, 1, 2, 3, 4, 5, 6].map((d) => item(d, 'lunch')), item(0, 'dinner')] };
  const dates = dateRange('2026-10-18', '2026-10-21'); // domingo (antes do plano) a quarta

  it('conta só refeições previstas e depois de o plano existir', () => {
    const s = summarizeAdherence(plan, [check('2026-10-19', 'lunch', 'ate'), check('2026-10-19', 'dinner', 'skipped'), check('2026-10-20', 'lunch', 'other', 'pizza')], dates);
    // seg: almoço + jantar; ter e qua: almoço -> 4 previstas
    expect(s).toMatchObject({ planned: 4, ate: 1, other: 1, skipped: 1, unmarked: 1, percent: 25 });
    expect(s.grid.map((g) => g.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('agrupa por refeição o que saiu do plano, com as anotações', () => {
    const s = summarizeAdherence(plan, [check('2026-10-20', 'lunch', 'other', 'pizza'), check('2026-10-21', 'lunch', 'skipped')], dates);
    expect(s.byMeal.find((m) => m.meal === 'lunch')).toMatchObject({ planned: 3, ate: 0, off: 2, notes: ['pizza'] });
  });

  it('sem refeições previstas, sem %', () => {
    expect(summarizeAdherence({ created_at: '2026-10-19T00:00:00Z', items: [] }, [], dates).percent).toBeNull();
  });
});
