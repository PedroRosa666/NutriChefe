// Marcações de adesão ao plano (supabase/migrations/20261026120000_meal_plan_checks.sql).
import { supabase, toJson } from '../lib/supabase';
import { dateRange, summarizeAdherence, type AdherenceSummary, type CheckStatus, type MealCheck } from '../lib/adherence';
import { toISODate } from '../store/nutrition-tracking';
import { listPlans, type MealPlan, type MealSlot } from './care';

const COLUMNS = 'id, plan_id, check_date, meal, status, chosen, note';

/** Marcações do paciente a partir de `since` (AAAA-MM-DD). */
export async function listChecks(clientId: string, since: string): Promise<MealCheck[]> {
  const { data, error } = await supabase
    .from('meal_plan_checks')
    .select(COLUMNS)
    .eq('client_id', clientId)
    .gte('check_date', since)
    .order('check_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MealCheck[];
}

/** Um item do plano como vai para o diário quando a pessoa marca "Comi". */
export interface CheckDiaryEntry {
  recipe_id: string | null;
  title: string;
  servings: number;
  per_serving: Record<string, number>;
}

/**
 * Grava a marcação e o diário juntos (save_meal_check, numa transação): "Comi" substitui o
 * que essa marcação já tinha lançado, outros status tiram, e uma falha não deixa meio feito.
 */
export async function saveCheckWithDiary(input: {
  planId: string;
  date: string;
  meal: MealSlot;
  status: CheckStatus;
  chosen?: string[];
  note?: string;
  entries: CheckDiaryEntry[];
}): Promise<MealCheck> {
  const { data, error } = await supabase.rpc('save_meal_check', {
    p_plan: input.planId,
    p_date: input.date,
    p_meal: input.meal,
    p_status: input.status,
    p_chosen: (input.chosen ?? []).slice(0, 20).map((c) => c.slice(0, 200)),
    p_note: (input.note ?? '').trim().slice(0, 300),
    p_entries: toJson(input.status === 'ate' ? input.entries.slice(0, 30) : []),
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: row.id, plan_id: row.plan_id, check_date: row.check_date, meal: row.meal,
    status: row.status, chosen: row.chosen, note: row.note,
  } as unknown as MealCheck;
}

export async function deleteCheck(id: string): Promise<void> {
  const { error } = await supabase.from('meal_plan_checks').delete().eq('id', id);
  if (error) throw error;
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

export interface AdherenceResult {
  current: AdherenceSummary;
  previous: AdherenceSummary;
}

/** Adesão do paciente ao plano mais recente feito pelo nutricionista logado (últimos 7 dias). */
export async function loadAdherence(clientId: string, nutritionistId: string): Promise<AdherenceResult | null> {
  const [plans, checks] = await Promise.all([listPlans(clientId), listChecks(clientId, daysAgo(13))]);
  const plan: MealPlan | undefined = plans.find((p) => p.created_by === nutritionistId);
  if (!plan) return null;
  const mine = new Set(plans.filter((p) => p.created_by === nutritionistId).map((p) => p.id));
  const relevant = checks.filter((c) => mine.has(c.plan_id));
  return {
    current: summarizeAdherence(plan, relevant, dateRange(daysAgo(6), daysAgo(0))),
    previous: summarizeAdherence(plan, relevant, dateRange(daysAgo(13), daysAgo(7))),
  };
}
