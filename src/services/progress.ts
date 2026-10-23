// Premium do cliente (20261030120000_client_premium.sql): números das conquistas e vitrine das
// receitas exclusivas para quem ainda não assina.
import { fromJson, supabase } from '../lib/supabase';
import type { Progress } from '../lib/achievements';

export async function getMyProgress(): Promise<Progress> {
  const { data, error } = await supabase.rpc('my_progress');
  if (error) throw error;
  const p = fromJson<Progress & { weight_change: unknown }>(data);
  return { ...p, weight_change: p.weight_change === null ? null : Number(p.weight_change) } as Progress;
}

export interface RecipeTeaser {
  id: string;
  title: string;
  image: string | null;
  category: string | null;
  prep_time: number | null;
  calories: number | null;
}

export async function getPremiumTeasers(): Promise<RecipeTeaser[]> {
  const { data, error } = await supabase.rpc('premium_recipe_teasers');
  if (error) throw error;
  return ((data ?? []) as RecipeTeaser[]).map((r) => ({ ...r, calories: r.calories === null ? null : Number(r.calories) }));
}
