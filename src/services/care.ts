// Acompanhamento nutricionista <-> paciente, planos alimentares e lista de compras.
// As permissões ficam no banco (RLS + funções em 20261021150000_patients_plans_shopping.sql):
// o nutricionista só enxerga dados de quem aceitou um convite e enquanto o vínculo estiver ativo.
import { fromJson, supabase, toJson } from '../lib/supabase';
import { fromRow, toISODate, type NutritionLogEntry, type NutritionLogRow } from '../store/nutrition-tracking';
import type { HealthProfile, WeightLog } from '../store/health-profile';
import type { GoalKey, NutritionGoals } from '../store/nutrition-goals';
import type { ShoppingItem } from '../lib/ingredients';
import type { Food } from './foods';

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

/** Categorias das refeições de sempre: classificam um bloco (sugestões, diário sem plano), nunca o nomeiam. */
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Horário e orientação diferentes num dia da semana. */
export interface MealDayOverride {
  time?: string;
  guidance?: string;
}

/**
 * Bloco de refeição do plano (café, pré-treino, ceia...). O id é fixo: marcações, diário e trocas
 * apontam para ele, então renomear ou reordenar não muda nada do que já foi registrado.
 */
export interface PlanMeal {
  id: string;
  /** Nome escrito pelo profissional (mostrado como está, sem tradução). */
  name: string;
  category: MealSlot | null;
  /** Dias da semana em que aparece (0 = segunda). */
  days: number[];
  /** Horário 'HH:MM' (opcional; não muda a ordem). */
  time: string | null;
  guidance: string;
  /** Por dia da semana ('0'..'6'). */
  dayOverrides: Record<string, MealDayOverride>;
  /** % das calorias do dia, para o gerador (opcional). */
  kcalShare: number | null;
}

/** Item do plano: uma receita (recipe_id + servings) OU um alimento do catálogo (food_id + grams). */
export interface MealPlanItem {
  id?: string;
  day: number; // 0 = segunda
  /** Bloco de refeição (PlanMeal.id). */
  meal_id: string;
  /** Categoria do bloco, quando tem (só leitura: vem do banco). */
  meal?: MealSlot | null;
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
  /** Blocos de refeição, na ordem do plano. */
  meals: PlanMeal[];
  items: MealPlanItem[];
  /** Revisão do rascunho (conferida ao salvar: outra aba salvou antes -> version_conflict). */
  revision?: number;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

const errorCode = (error: { message?: string } | null) => {
  const msg = error?.message ?? '';
  for (const code of ['invalid_invite', 'only_clients', 'only_nutritionists', 'too_many_invites', 'crn_not_verified', 'patient_limit', 'not_authenticated']) {
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

/** Resumo de um paciente para a lista do nutricionista (patients_overview, uma consulta para todos). */
export interface PatientOverview {
  clientId: string;
  lastLog: string | null;
  lastCheck: string | null;
  days7: number;
  kcal7: number;
  goalKcal: number | null;
  pendingSwaps: number;
  unread: number;
}

export async function patientsOverview(): Promise<PatientOverview[]> {
  const { data, error } = await supabase.rpc('patients_overview');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    clientId: r.client_id,
    lastLog: r.last_log,
    lastCheck: r.last_check,
    days7: Number(r.days7) || 0,
    kcal7: Number(r.kcal7) || 0,
    goalKcal: r.goal_kcal === null ? null : Number(r.goal_kcal),
    pendingSwaps: Number(r.pending_swaps) || 0,
    unread: Number(r.unread_messages) || 0,
  }));
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
      // Os 180 mais recentes (a tela usa em ordem crescente: invertido abaixo).
      .order('logged_on', { ascending: false })
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
          ...(h as Partial<HealthProfile>),
          height_cm: num(h.height_cm),
          weight_kg: num(h.weight_kg),
          target_weight_kg: num(h.target_weight_kg),
        }
      : null,
    weights: (weights.data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) })).reverse(),
    entries: ((entries.data ?? []) as NutritionLogRow[]).map(fromRow),
    goals: goals.data
      ? {
          calories: Number(goals.data.calories),
          protein: Number(goals.data.protein),
          carbs: Number(goals.data.carbs),
          fat: Number(goals.data.fat),
          fiber: Number(goals.data.fiber),
          active_goals: (goals.data.active_goals ?? []) as GoalKey[],
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
// Ler, salvar e publicar planos: services/plans.ts.

/** Dia do plano (0 = segunda) para uma data. */
export const planDayOf = (date: Date) => (date.getDay() + 6) % 7;

// ---------------------------------------------------------------- lista de compras

export async function getShoppingList(userId: string): Promise<ShoppingItem[]> {
  const { data, error } = await supabase.from('shopping_lists').select('items').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.items) ? fromJson<ShoppingItem[]>(data.items) : [];
}

export async function saveShoppingList(userId: string, items: ShoppingItem[]) {
  const { error } = await supabase
    .from('shopping_lists')
    .upsert({ user_id: userId, items: toJson(items), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
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
