// Blocos de refeição do plano (supabase/migrations/20261106120000_custom_meals.sql): regras puras
// usadas pelo editor, pela tela do paciente, pelo diário, pela adesão, pelo PDF e pelo gerador.
import { MEAL_SLOTS, type MealDayOverride, type MealPlanItem, type MealSlot, type PlanMeal } from '../services/care';

/** Os mesmos limites do banco: passou, o salvamento é recusado inteiro (nada é cortado calado). */
export const MEAL_LIMITS = {
  mealsPerDay: 12,
  mealsPerPlan: 40,
  itemsPerMeal: 30,
  name: 60,
  guidance: 1000,
} as const;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const newMealId = () => crypto.randomUUID();

/** As quatro refeições de sempre: o começo de um plano novo. */
export function defaultMeals(names: Record<MealSlot, string>): PlanMeal[] {
  return MEAL_SLOTS.map((category) => ({
    id: newMealId(),
    name: names[category],
    category,
    days: [...ALL_DAYS],
    time: null,
    guidance: '',
    dayOverrides: {},
    kcalShare: null,
  }));
}

/** Blocos que aparecem num dia, na ordem do plano. */
export const mealsOnDay = (meals: PlanMeal[], day: number) => meals.filter((m) => m.days.includes(day));

/** Horário do bloco num dia (o do dia, se houver, senão o geral). */
export const mealTimeOn = (meal: PlanMeal, day: number): string | null => meal.dayOverrides[String(day)]?.time ?? meal.time;

export const mealGuidanceOn = (meal: PlanMeal, day: number): string => meal.dayOverrides[String(day)]?.guidance ?? meal.guidance;

/** Itens de um bloco num dia. */
export const mealItems = (items: MealPlanItem[], mealId: string, day: number) => items.filter((i) => i.meal_id === mealId && i.day === day);

/** Ordena itens por dia, pela ordem dos blocos e mantém a ordem relativa de cada bloco. */
export function sortItemsByMeals(items: MealPlanItem[], meals: PlanMeal[]): MealPlanItem[] {
  const order = new Map(meals.map((m, i) => [m.id, i]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.day - b.item.day || (order.get(a.item.meal_id) ?? 99) - (order.get(b.item.meal_id) ?? 99) || a.index - b.index)
    .map(({ item }) => item);
}

const isSlot = (v: unknown): v is MealSlot => typeof v === 'string' && (MEAL_SLOTS as string[]).includes(v);

function toOverrides(raw: unknown): Record<string, MealDayOverride> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, MealDayOverride> = {};
  for (const [day, value] of Object.entries(raw as Record<string, { time?: unknown; guidance?: unknown }>)) {
    if (!/^[0-6]$/.test(day) || !value || typeof value !== 'object') continue;
    const o: MealDayOverride = {};
    if (typeof value.time === 'string' && value.time) o.time = value.time;
    if (typeof value.guidance === 'string' && value.guidance) o.guidance = value.guidance;
    if (o.time || o.guidance) out[day] = o;
  }
  return out;
}

/** Bloco como vem do banco (linha de meal_plan_meals ou retrato da versão). */
export interface MealRow {
  id: string;
  name: string;
  category?: string | null;
  days?: number[] | null;
  time_of_day?: string | null;
  time?: string | null;
  guidance?: string | null;
  day_overrides?: unknown;
  kcal_share?: number | string | null;
}

export const toPlanMeal = (row: MealRow): PlanMeal => ({
  id: row.id,
  name: row.name,
  category: isSlot(row.category) ? row.category : null,
  days: (row.days ?? []).map(Number).sort((a, b) => a - b),
  time: row.time_of_day ?? row.time ?? null,
  guidance: row.guidance ?? '',
  dayOverrides: toOverrides(row.day_overrides),
  kcalShare: row.kcal_share === null || row.kcal_share === undefined ? null : Number(row.kcal_share),
});

/** Bloco no formato que o banco grava (save_plan_draft e modelos). */
export const mealToJson = (m: PlanMeal) => ({
  id: m.id,
  name: m.name.trim().slice(0, MEAL_LIMITS.name),
  category: m.category,
  days: m.days,
  time: m.time || null,
  guidance: m.guidance.slice(0, MEAL_LIMITS.guidance),
  day_overrides: m.dayOverrides,
  kcal_share: m.kcalShare,
});

/**
 * Cópia independente de blocos e itens (aplicar um modelo, duplicar): ids novos para cada bloco,
 * e os itens vão sem id (o banco cria). Nada fica ligado à origem.
 */
export function copyMealsAndItems(meals: PlanMeal[], items: MealPlanItem[]): { meals: PlanMeal[]; items: MealPlanItem[] } {
  const ids = new Map(meals.map((m) => [m.id, newMealId()]));
  return {
    meals: meals.map((m) => ({ ...m, id: ids.get(m.id)!, days: [...m.days], dayOverrides: { ...m.dayOverrides } })),
    items: items.flatMap((i) => {
      const meal_id = ids.get(i.meal_id);
      if (!meal_id) return [];
      return [{ ...i, id: undefined, meal_id }];
    }),
  };
}

/**
 * Itens antigos (só com o código da refeição, sem bloco): cria os blocos das categorias usadas e
 * liga cada item ao seu. Usado por modelos e respostas gravados antes dos blocos.
 */
export function mealsFromLegacy(
  items: (Omit<MealPlanItem, 'meal_id'> & { meal_id?: string | null })[],
  names: Record<MealSlot, string>
): { meals: PlanMeal[]; items: MealPlanItem[] } {
  const used = MEAL_SLOTS.filter((slot) => items.some((i) => i.meal === slot));
  const meals = defaultMeals(names).filter((m) => used.includes(m.category!));
  const byCategory = new Map(meals.map((m) => [m.category, m.id]));
  return {
    meals,
    items: items.flatMap((i) => {
      const meal_id = i.meal ? byCategory.get(i.meal) : undefined;
      return meal_id ? [{ ...i, meal_id }] : [];
    }),
  };
}

// Parte do dia de cada categoria quando ninguém definiu (sugestão): blocos livres contam como lanche.
const CATEGORY_WEIGHT: Record<MealSlot, number> = { breakfast: 25, lunch: 35, snack: 10, dinner: 30 };

export interface DayShares {
  /** % das calorias do dia por bloco (soma 100). */
  shares: Map<string, number>;
  /** true: distribuição sugerida (faltou definir em algum bloco ou a soma não fecha 100%). */
  suggested: boolean;
}

/** Soma das % definidas pelo profissional num dia (null se nenhum bloco do dia tem %). */
export function definedShareSum(meals: PlanMeal[], day: number): number | null {
  const list = mealsOnDay(meals, day).filter((m) => m.kcalShare !== null);
  return list.length ? Math.round(list.reduce((sum, m) => sum + (m.kcalShare ?? 0), 0) * 10) / 10 : null;
}

/**
 * Como dividir as calorias do dia entre os blocos: as % do profissional quando todos os blocos do
 * dia têm e a soma fecha 100%; senão uma sugestão pela categoria. Mais um bloco nunca aumenta o
 * total do dia, só redistribui.
 */
export function dayShares(meals: PlanMeal[], day: number): DayShares {
  const list = mealsOnDay(meals, day);
  const shares = new Map<string, number>();
  if (!list.length) return { shares, suggested: false };
  const sum = definedShareSum(meals, day);
  if (list.every((m) => m.kcalShare !== null) && sum !== null && Math.abs(sum - 100) < 0.5) {
    for (const m of list) shares.set(m.id, m.kcalShare!);
    return { shares, suggested: false };
  }
  const weights = list.map((m) => CATEGORY_WEIGHT[m.category ?? 'snack']);
  const total = weights.reduce((a, b) => a + b, 0);
  list.forEach((m, i) => shares.set(m.id, Math.round((weights[i] / total) * 1000) / 10));
  return { shares, suggested: true };
}
