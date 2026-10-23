// Acompanhamento nutricionista <-> paciente, planos alimentares e lista de compras.
// As permissões ficam no banco (RLS + funções em 20261021150000_patients_plans_shopping.sql):
// o nutricionista só enxerga dados de quem aceitou um convite e enquanto o vínculo estiver ativo.
import { supabase } from '../lib/supabase';
import { fromRow, toISODate, type NutritionLogEntry, type NutritionLogRow } from '../store/nutrition-tracking';
import type { HealthProfile, WeightLog } from '../store/health-profile';
import type { GoalKey, NutritionGoals } from '../store/nutrition-goals';
import type { ShoppingItem } from '../lib/ingredients';
import { toFood, type Food, type FoodRow } from './foods';

export interface PersonSummary {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface CareLink {
  id: string;
  status: 'active' | 'ended';
  created_at: string;
  person: PersonSummary;
}

export interface Invite {
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Item do plano: uma receita (recipe_id + servings) OU um alimento do catálogo (food_id + grams). */
export interface MealPlanItem {
  id?: string;
  day: number; // 0 = segunda
  meal: MealSlot;
  recipe_id: string | null;
  servings: number;
  food_id: string | null;
  /** Alimento já carregado junto com o plano (para nome e nutrientes). */
  food?: Food | null;
  grams: number | null;
  /** Texto da quantidade do alimento, ex.: "2 × 1 fatia (50 g)". */
  measure_label: string | null;
  /** Itens da mesma refeição com o mesmo número são opções equivalentes ("escolha 1"). */
  option_group: number | null;
  note: string;
}

export interface MealPlan {
  id: string;
  client_id: string;
  created_by: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  authorName: string | null;
  items: MealPlanItem[];
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

const errorCode = (error: { message?: string } | null) => {
  const msg = error?.message ?? '';
  for (const code of ['invalid_invite', 'only_clients', 'only_nutritionists', 'too_many_invites', 'crn_not_verified', 'not_authenticated']) {
    if (msg.includes(code)) return code;
  }
  return 'unknown';
};

export class CareError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// ---------------------------------------------------------------- vínculos

export async function listMyNutritionists(clientId: string): Promise<CareLink[]> {
  const { data, error } = await supabase
    .from('nutritionist_clients')
    .select('id, status, created_at, person:profiles!nutritionist_clients_nutritionist_id_fkey(id, full_name, avatar_url)')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, person: one(row.person) as PersonSummary })) as CareLink[];
}

export async function listMyPatients(nutritionistId: string): Promise<CareLink[]> {
  const { data, error } = await supabase
    .from('nutritionist_clients')
    .select('id, status, created_at, person:profiles!nutritionist_clients_client_id_fkey(id, full_name, avatar_url)')
    .eq('nutritionist_id', nutritionistId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, person: one(row.person) as PersonSummary })) as CareLink[];
}

export async function endLink(linkId: string) {
  const { error } = await supabase
    .from('nutritionist_clients')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', linkId);
  if (error) throw error;
}

export async function redeemInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_nutritionist_invite', { p_code: code.trim().toUpperCase() });
  if (error) throw new CareError(errorCode(error));
  return data as string;
}

export async function listOpenInvites(nutritionistId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('nutritionist_invites')
    .select('code, created_at, expires_at, used_at')
    .eq('nutritionist_id', nutritionistId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createInvite(): Promise<Invite> {
  const { data, error } = await supabase.rpc('create_nutritionist_invite');
  if (error) throw new CareError(errorCode(error));
  return one(data) as Invite;
}

export async function deleteInvite(code: string) {
  const { error } = await supabase.from('nutritionist_invites').delete().eq('code', code);
  if (error) throw error;
}

export const inviteLink = (code: string) => `${window.location.origin}/perfil?convite=${encodeURIComponent(code)}`;

// ---------------------------------------------------------------- dados do paciente

export interface PatientData {
  health: Partial<HealthProfile> | null;
  weights: WeightLog[];
  entries: NutritionLogEntry[];
  goals: (NutritionGoals & { active_goals: GoalKey[]; set_by: string | null }) | null;
}

export async function getPatientData(clientId: string, days = 30): Promise<PatientData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const [health, weights, entries, goals] = await Promise.all([
    supabase.from('client_health_profiles').select('*').eq('user_id', clientId).maybeSingle(),
    supabase
      .from('weight_logs')
      .select('id, logged_on, weight_kg')
      .eq('user_id', clientId)
      .order('logged_on', { ascending: true })
      .limit(180),
    supabase
      .from('nutrition_log_entries')
      .select('id, entry_date, recipe_id, recipe_title, servings, per_serving, created_at')
      .eq('user_id', clientId)
      .gte('entry_date', toISODate(since))
      .order('created_at', { ascending: false }),
    supabase
      .from('nutrition_goals')
      .select('calories, protein, carbs, fat, fiber, active_goals, set_by')
      .eq('user_id', clientId)
      .maybeSingle(),
  ]);

  for (const res of [health, weights, entries, goals]) {
    if (res.error) throw res.error;
  }

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const h = health.data;
  return {
    health: h
      ? {
          ...h,
          height_cm: num(h.height_cm),
          weight_kg: num(h.weight_kg),
          target_weight_kg: num(h.target_weight_kg),
        }
      : null,
    weights: (weights.data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) })),
    entries: ((entries.data ?? []) as NutritionLogRow[]).map(fromRow),
    goals: goals.data
      ? {
          calories: Number(goals.data.calories),
          protein: Number(goals.data.protein),
          carbs: Number(goals.data.carbs),
          fat: Number(goals.data.fat),
          fiber: Number(goals.data.fiber),
          active_goals: goals.data.active_goals ?? [],
          set_by: goals.data.set_by ?? null,
        }
      : null,
  };
}

/** Nutricionista define as metas do paciente. */
export async function setPatientGoals(clientId: string, nutritionistId: string, goals: NutritionGoals, activeGoals: GoalKey[]) {
  const { error } = await supabase
    .from('nutrition_goals')
    .upsert(
      {
        user_id: clientId,
        ...goals,
        active_goals: activeGoals,
        set_by: nutritionistId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

// ---------------------------------------------------------------- planos

const PLAN_SELECT =
  'id, client_id, created_by, title, notes, created_at, updated_at, author:profiles!meal_plans_created_by_fkey(full_name), ' +
  'items:meal_plan_items(id, day, meal, recipe_id, servings, food_id, grams, measure_label, option_group, note, ' +
  'food:foods(id, taco_id, owner_id, name, category, kcal, protein, carbs, fat, fiber, sodium, nutrients, measures))';

interface PlanRow {
  id: string;
  client_id: string;
  created_by: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  author: { full_name: string | null } | { full_name: string | null }[] | null;
  items:
    | {
        id: string;
        day: number;
        meal: MealSlot;
        recipe_id: string | null;
        servings: number | string;
        food_id: string | null;
        grams: number | string | null;
        measure_label: string | null;
        option_group: number | null;
        note: string;
        food: FoodRow | FoodRow[] | null;
      }[]
    | null;
}

const toPlan = (row: PlanRow): MealPlan => ({
  id: row.id,
  client_id: row.client_id,
  created_by: row.created_by,
  title: row.title,
  notes: row.notes,
  created_at: row.created_at,
  updated_at: row.updated_at,
  authorName: one(row.author)?.full_name ?? null,
  items: (row.items ?? [])
    .map((i) => {
      const food = one(i.food);
      return {
        ...i,
        servings: Number(i.servings) || 1,
        grams: i.grams === null ? null : Number(i.grams),
        option_group: i.option_group ?? null,
        food: food ? toFood(food) : null,
      };
    })
    .sort((a, b) => a.day - b.day || MEAL_SLOTS.indexOf(a.meal) - MEAL_SLOTS.indexOf(b.meal)),
});

export async function listPlans(clientId: string): Promise<MealPlan[]> {
  const { data, error } = await supabase
    .from('meal_plans')
    .select(PLAN_SELECT)
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PlanRow[]).map(toPlan);
}

async function writeItems(planId: string, items: MealPlanItem[]) {
  const { error: delError } = await supabase.from('meal_plan_items').delete().eq('plan_id', planId);
  if (delError) throw delError;
  if (!items.length) return;
  const { error } = await supabase.from('meal_plan_items').insert(
    items.map((i) => ({
      plan_id: planId,
      day: i.day,
      meal: i.meal,
      recipe_id: i.food_id ? null : i.recipe_id,
      servings: i.food_id ? 1 : i.servings,
      food_id: i.food_id,
      grams: i.food_id ? i.grams : null,
      measure_label: i.food_id ? (i.measure_label ?? '').slice(0, 120) || null : null,
      option_group: i.option_group,
      note: i.note.slice(0, 300),
    }))
  );
  if (error) throw error;
}

export async function savePlan(input: {
  id?: string;
  clientId: string;
  authorId: string;
  title: string;
  notes: string;
  items: MealPlanItem[];
}): Promise<MealPlan> {
  const fields = {
    title: input.title.trim().slice(0, 120) || 'Plano alimentar',
    notes: input.notes.slice(0, 2000),
    updated_at: new Date().toISOString(),
  };

  let planId = input.id;
  if (planId) {
    const { error } = await supabase.from('meal_plans').update(fields).eq('id', planId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('meal_plans')
      .insert({ ...fields, client_id: input.clientId, created_by: input.authorId })
      .select('id')
      .single();
    if (error) throw error;
    planId = data.id as string;
  }

  await writeItems(planId, input.items);

  const { data, error } = await supabase.from('meal_plans').select(PLAN_SELECT).eq('id', planId).single();
  if (error) throw error;
  return toPlan(data as unknown as PlanRow);
}

export async function deletePlan(planId: string) {
  const { error } = await supabase.from('meal_plans').delete().eq('id', planId);
  if (error) throw error;
}

/** Dia do plano (0 = segunda) para uma data. */
export const planDayOf = (date: Date) => (date.getDay() + 6) % 7;

// ---------------------------------------------------------------- lista de compras

export async function getShoppingList(userId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase.from('shopping_lists').select('items').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.items) ? (data.items as ShoppingItem[]) : [];
}

export async function saveShoppingList(userId: string, items: ShoppingItem[]) {
  const { error } = await supabase
    .from('shopping_lists')
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ---------------------------------------------------------------- estatísticas

export interface RecipeStats {
  recipe_id: string;
  favorites: number;
  diary_logs: number;
  in_plans: number;
}

export async function getRecipeAuthorStats(): Promise<RecipeStats[]> {
  const { data, error } = await supabase.rpc('recipe_author_stats');
  if (error) throw error;
  return ((data ?? []) as RecipeStats[]).map((r) => ({
    recipe_id: r.recipe_id,
    favorites: Number(r.favorites) || 0,
    diary_logs: Number(r.diary_logs) || 0,
    in_plans: Number(r.in_plans) || 0,
  }));
}
