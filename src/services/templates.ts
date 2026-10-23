// Modelos de plano alimentar (supabase/migrations/20261023130000_meal_plan_templates.sql).
import { supabase } from '../lib/supabase';
import type { MealPlanItem } from './care';
import type { Food } from './foods';

/** Item guardado no modelo: o mesmo do plano, sem id e sem o alimento carregado. */
export type TemplateItem = Omit<MealPlanItem, 'id' | 'food'>;

export interface PlanTemplate {
  id: string;
  title: string;
  notes: string;
  items: TemplateItem[];
  updated_at: string;
}

const COLUMNS = 'id, title, notes, items, updated_at';

export async function listTemplates(ownerId: string): Promise<PlanTemplate[]> {
  const { data, error } = await supabase
    .from('meal_plan_templates')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlanTemplate[];
}

const toTemplateItems = (items: MealPlanItem[]): TemplateItem[] =>
  items.map((i) => ({
    day: i.day,
    meal: i.meal,
    recipe_id: i.food_id ? null : i.recipe_id,
    servings: i.servings,
    food_id: i.food_id,
    grams: i.grams,
    measure_label: i.measure_label,
    option_group: i.option_group,
    note: i.note,
  }));

export async function createTemplate(ownerId: string, input: { title: string; notes: string; items: MealPlanItem[] }): Promise<PlanTemplate> {
  const { data, error } = await supabase
    .from('meal_plan_templates')
    .insert({
      owner_id: ownerId,
      title: input.title.trim().slice(0, 120),
      notes: input.notes.slice(0, 2000),
      items: toTemplateItems(input.items),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as PlanTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_templates').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Itens do modelo prontos para o editor: liga cada alimento ao catálogo carregado.
 * Alimentos que não existem mais (ou não são visíveis) ficam de fora.
 */
export function templateToItems(template: PlanTemplate, foodsById: Map<string, Food>): MealPlanItem[] {
  return template.items.flatMap((i): MealPlanItem[] => {
    if (!i.food_id) return [{ ...i, food: null }];
    const food = foodsById.get(i.food_id);
    return food ? [{ ...i, food }] : [];
  });
}
