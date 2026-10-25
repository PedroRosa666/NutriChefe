// Modelos de plano alimentar (supabase/migrations/20261023130000_meal_plan_templates.sql e
// 20261106120000_custom_meals.sql: o modelo guarda também os blocos de refeição).
import { supabase, toJson } from '../lib/supabase';
import type { MealPlanItem, MealSlot, PlanMeal } from './care';
import type { Food } from './foods';
import { copyMealsAndItems, mealsFromLegacy, mealToJson, toPlanMeal, type MealRow } from '../lib/plan-meals';

/** Item guardado no modelo: o mesmo do plano, sem id e sem o alimento carregado. */
export type TemplateItem = Omit<MealPlanItem, 'id' | 'food' | 'meal_id'> & { meal_id?: string | null };

export interface PlanTemplate {
  id: string;
  title: string;
  notes: string;
  /** Blocos do modelo (modelos antigos não têm: os itens trazem só o código da refeição). */
  meals: PlanMeal[];
  items: TemplateItem[];
  updated_at: string;
}

const COLUMNS = 'id, title, notes, meals, items, updated_at';

interface TemplateRow {
  id: string;
  title: string;
  notes: string;
  meals: MealRow[] | null;
  items: TemplateItem[];
  updated_at: string;
}

const toTemplate = (row: TemplateRow): PlanTemplate => ({ ...row, meals: (row.meals ?? []).map(toPlanMeal) });

export async function listTemplates(ownerId: string): Promise<PlanTemplate[]> {
  const { data, error } = await supabase
    .from('meal_plan_templates')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as TemplateRow[]).map(toTemplate);
}

const toTemplateItems = (items: MealPlanItem[]): TemplateItem[] =>
  items.map((i) => ({
    day: i.day,
    meal_id: i.meal_id,
    recipe_id: i.food_id ? null : i.recipe_id,
    servings: i.servings,
    food_id: i.food_id,
    grams: i.grams,
    measure_label: i.measure_label,
    option_group: i.option_group,
    note: i.note,
  }));

export async function createTemplate(
  ownerId: string,
  input: { title: string; notes: string; meals: PlanMeal[]; items: MealPlanItem[] }
): Promise<PlanTemplate> {
  const { data, error } = await supabase
    .from('meal_plan_templates')
    .insert({
      owner_id: ownerId,
      title: input.title.trim().slice(0, 120),
      notes: input.notes.slice(0, 2000),
      meals: toJson(input.meals.map(mealToJson)),
      items: toJson(toTemplateItems(input.items)),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toTemplate(data as unknown as TemplateRow);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_templates').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Blocos e itens do modelo prontos para o editor: ids novos (nada fica ligado ao modelo nem a
 * outro paciente) e cada alimento ligado ao catálogo carregado. Alimentos que não existem mais
 * (ou não são visíveis) ficam de fora.
 */
export function templateToPlan(
  template: PlanTemplate,
  foodsById: Map<string, Food>,
  mealNames: Record<MealSlot, string>
): { meals: PlanMeal[]; items: MealPlanItem[] } {
  const withFood = template.items.flatMap((i): (TemplateItem & { food: Food | null })[] => {
    if (!i.food_id) return [{ ...i, food: null }];
    const food = foodsById.get(i.food_id);
    return food ? [{ ...i, food }] : [];
  });
  if (!template.meals.length) return mealsFromLegacy(withFood, mealNames);
  const known = new Set(template.meals.map((m) => m.id));
  return copyMealsAndItems(
    template.meals,
    withFood.flatMap((i) => (i.meal_id && known.has(i.meal_id) ? [{ ...i, meal_id: i.meal_id }] : []))
  );
}
