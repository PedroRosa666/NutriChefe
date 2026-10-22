// Catálogo de alimentos: Tabela TACO (para todos) + alimentos próprios de cada nutricionista
// (visíveis só para ele e para os pacientes com acompanhamento ativo; regra no RLS da tabela).
import { supabase } from '../lib/supabase';
import { cleanExtraNutrients, type ExtraNutrients } from '../lib/nutrients';

export interface FoodMeasure {
  label: string;
  grams: number;
}

/** Valores sempre por 100 g. */
export interface Food {
  id: string;
  taco_id: number | null;
  owner_id: string | null;
  name: string;
  category: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number | null;
  /** Demais nutrientes por 100 g; chave ausente = não analisado. */
  nutrients: ExtraNutrients;
  measures: FoodMeasure[];
}

/** Alimento escolhido com quantidade (seletor do diário, do plano e das trocas). */
export interface PickedFood {
  food: Food;
  /** Quantidade total em gramas. */
  grams: number;
  /** Ex.: "2 × 1 fatia (50 g)" ou "150 g". */
  label: string;
}

export type FoodInput = Pick<Food, 'name' | 'category' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium' | 'nutrients' | 'measures'>;

const COLUMNS = 'id, taco_id, owner_id, name, category, kcal, protein, carbs, fat, fiber, sodium, nutrients, measures';

export interface FoodRow extends Omit<Food, 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sodium' | 'nutrients' | 'measures'> {
  kcal: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  fiber: number | string;
  sodium: number | string | null;
  nutrients: unknown;
  measures: FoodMeasure[] | null;
}

// numeric do Postgres pode chegar como texto.
export const toFood = (row: FoodRow): Food => ({
  ...row,
  kcal: Number(row.kcal) || 0,
  protein: Number(row.protein) || 0,
  carbs: Number(row.carbs) || 0,
  fat: Number(row.fat) || 0,
  fiber: Number(row.fiber) || 0,
  sodium: row.sodium === null ? null : Number(row.sodium),
  nutrients: cleanExtraNutrients(row.nutrients),
  measures: Array.isArray(row.measures) ? row.measures : [],
});

export async function listFoods(): Promise<Food[]> {
  const { data, error } = await supabase
    .from('foods')
    .select(COLUMNS)
    .order('name', { ascending: true })
    .range(0, 4999);
  if (error) throw error;
  return ((data ?? []) as FoodRow[]).map(toFood);
}

export async function createFood(ownerId: string, input: FoodInput): Promise<Food> {
  const { data, error } = await supabase
    .from('foods')
    .insert([{ ...input, owner_id: ownerId }])
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toFood(data as FoodRow);
}

export async function updateFood(id: string, input: FoodInput): Promise<Food> {
  const { data, error } = await supabase.from('foods').update(input).eq('id', id).select(COLUMNS).single();
  if (error) throw error;
  return toFood(data as FoodRow);
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', id);
  if (error) throw error;
}
