// Marcações de adesão ao plano (supabase/migrations/20261026120000_meal_plan_checks.sql).
import { supabase } from '../lib/supabase';
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

/** Grava (ou troca) a marcação de uma refeição num dia. */
export async function saveCheck(input: {
  clientId: string;
  planId: string;
  date: string;
  meal: MealSlot;
  status: CheckStatus;
  chosen?: string[];
  note?: string;
}): Promise<MealCheck> {
  const { data, error } = await supabase
    .from('meal_plan_checks')
    .upsert(
      {
        client_id: input.clientId,
        plan_id: input.planId,
        check_date: input.date,
        meal: input.meal,
        status: input.status,
        chosen: (input.chosen ?? []).slice(0, 20).map((c) => c.slice(0, 200)),
        note: (input.note ?? '').trim().slice(0, 300),
      },
      { onConflict: 'client_id,check_date,meal' }
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as MealCheck;
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
