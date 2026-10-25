import { describe, expect, it } from 'vitest';
import { dateForPlanDay, dateRange, summarizeAdherence, type MealCheck } from '../adherence';
import type { MealPlanItem, PlanMeal } from '../../services/care';

const ALL = [0, 1, 2, 3, 4, 5, 6];
const meal = (id: string, name: string, days = ALL): PlanMeal => ({
  id, name, category: null, days, time: null, guidance: '', dayOverrides: {}, kcalShare: null,
});
const item = (day: number, mealId: string): MealPlanItem => ({
  day, meal_id: mealId, recipe_id: 'r', servings: 1, food_id: null, grams: null, measure_label: null, option_group: null, note: '',
});
const check = (check_date: string, mealId: string, status: MealCheck['status'], note = ''): MealCheck => ({
  id: `${check_date}${mealId}`, plan_id: 'p', check_date, meal_id: mealId, meal_name: null, meal: null, status, chosen: [], note,
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
  const meals = [meal('almoco', 'Almoço'), meal('jantar', 'Jantar', [0])];
  const plan = { created_at: '2026-10-19T08:00:00Z', meals, items: [...ALL.map((d) => item(d, 'almoco')), item(0, 'jantar')] };
  const dates = dateRange('2026-10-18', '2026-10-21'); // domingo (antes do plano) a quarta

  it('conta só refeições previstas e depois de o plano existir', () => {
    const s = summarizeAdherence(plan, [check('2026-10-19', 'almoco', 'ate'), check('2026-10-19', 'jantar', 'skipped'), check('2026-10-20', 'almoco', 'other', 'pizza')], dates);
    // seg: almoço + jantar; ter e qua: almoço -> 4 previstas
    expect(s).toMatchObject({ planned: 4, ate: 1, other: 1, skipped: 1, unmarked: 1, percent: 25 });
    expect(s.grid.map((g) => g.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('agrupa por refeição (bloco) o que saiu do plano, com as anotações e o nome do bloco', () => {
    const s = summarizeAdherence(plan, [check('2026-10-20', 'almoco', 'other', 'pizza'), check('2026-10-21', 'almoco', 'skipped')], dates);
    expect(s.byMeal.find((m) => m.mealId === 'almoco')).toMatchObject({ name: 'Almoço', planned: 3, ate: 0, off: 2, notes: ['pizza'] });
  });

  it('REF 04: um dia com quatro refeições não ganha faltas por causa de outro com seis; dois "Lanche" contam separados', () => {
    const six = [meal('cafe', 'Café'), meal('l1', 'Lanche', [0]), meal('almoco', 'Almoço'), meal('l2', 'Lanche', [0]), meal('pre', 'Pré-treino', [0]), meal('jantar', 'Jantar')];
    const items = [0, 1].flatMap((d) => six.filter((m) => m.days.includes(d)).map((m) => item(d, m.id)));
    const s = summarizeAdherence({ created_at: '2026-10-19T08:00:00Z', meals: six, items }, [check('2026-10-20', 'cafe', 'ate'), check('2026-10-19', 'l1', 'ate')], dateRange('2026-10-19', '2026-10-20'));
    expect(s.grid.map((g) => g.slots.length)).toEqual([6, 3]);
    expect(s).toMatchObject({ planned: 9, ate: 2, unmarked: 7 });
    expect(s.byMeal.filter((m) => m.name === 'Lanche')).toHaveLength(2);
  });

  it('bloco sem itens no dia não é refeição prevista', () => {
    const s = summarizeAdherence({ created_at: '2026-10-19T08:00:00Z', meals: [meal('ceia', 'Ceia')], items: [item(0, 'ceia')] }, [], dateRange('2026-10-19', '2026-10-20'));
    expect(s.planned).toBe(1);
  });

  it('sem refeições previstas, sem %', () => {
    expect(summarizeAdherence({ created_at: '2026-10-19T00:00:00Z', meals: [], items: [] }, [], dates).percent).toBeNull();
  });
});
