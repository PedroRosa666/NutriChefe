// Premium do cliente (20261030120000_client_premium.sql): números das conquistas e vitrine das
// receitas exclusivas para quem ainda não assina.
import { fromJson, supabase } from '../lib/supabase';
import type { Progress } from '../lib/achievements';

export async function getMyProgress(): Promise<Progress> {
  const { data, error } = await supabase.rpc('my_progress');
  if (error) throw error;
  // Resposta incompleta (ou de uma versão antiga da função) não pode derrubar a tela: zeros no que faltar.
  const p = fromJson<Partial<Progress> & { weight_change?: unknown; week?: Partial<Progress['week']> }>(data) ?? {};
  const n = (v: unknown) => Number(v) || 0;
  const week: Partial<Progress['week']> = p.week ?? {};
  return {
    diary_days: n(p.diary_days),
    streak: n(p.streak),
    best_streak: n(p.best_streak),
    weight_logs: n(p.weight_logs),
    weight_change: p.weight_change === null || p.weight_change === undefined ? null : Number(p.weight_change),
    ate_meals: n(p.ate_meals),
    reviews: n(p.reviews),
    favorites: n(p.favorites),
    week: {
      start: String(week.start ?? ''),
      diary_days: n(week.diary_days),
      ate_meals: n(week.ate_meals),
      weigh_ins: n(week.weigh_ins),
      protein_days: week.protein_days === null || week.protein_days === undefined ? null : n(week.protein_days),
      calorie_days: week.calorie_days === null || week.calorie_days === undefined ? null : n(week.calorie_days),
    },
  };
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
