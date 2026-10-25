// Marcações de adesão ao plano (supabase/migrations/20261026120000_meal_plan_checks.sql).
import { supabase, toJson } from '../lib/supabase';
import { dateRange, summarizeAdherence, type AdherenceSummary, type CheckStatus, type MealCheck } from '../lib/adherence';
import { toISODate } from '../store/nutrition-tracking';
import { listPlanVersions, listPlanViews, versionOn } from './plans';

const COLUMNS = 'id, plan_id, check_date, meal_id, meal_name, meal, status, chosen, note';

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

/** Um item do plano como vai para o diário quando a pessoa marca "Comi" (sempre pelo id do item). */
export interface CheckDiaryEntry {
  item_id: string;
  title: string;
  servings: number;
  per_serving: Record<string, number>;
}

/**
 * Grava a marcação de um bloco e o diário juntos (record_meal_check, numa transação). O banco
 * confere que o bloco é da versão do dia e que "Comi" tem os itens fixos e uma opção por grupo.
 * "Comi" substitui o que essa marcação já tinha lançado, outros status tiram, e `operationId`
 * faz a mesma tentativa repetida (clique duplo, internet caindo) não gravar duas vezes.
 */
export async function saveCheckWithDiary(input: {
  planId: string;
  date: string;
  mealId: string;
  status: CheckStatus;
  note?: string;
  entries: CheckDiaryEntry[];
  operationId: string;
}): Promise<MealCheck> {
  const { data, error } = await supabase.rpc('record_meal_check', {
    p_plan: input.planId,
    p_date: input.date,
    p_meal: input.mealId,
    p_status: input.status,
    p_items: toJson(input.status === 'ate' ? input.entries : []),
    p_note: (input.note ?? '').trim().slice(0, 300),
    p_operation: input.operationId,
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: row.id, plan_id: row.plan_id, check_date: row.check_date, meal_id: row.meal_id, meal_name: row.meal_name,
    meal: row.meal, status: row.status, chosen: row.chosen, note: row.note,
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

/**
 * Adesão do paciente ao plano feito por `authorId` (últimos 7 dias e os 7 anteriores): o plano em
 * uso, se for desse autor, ou o mais recente dele. Cada dia conta o que a versão daquele dia previa.
 */
export async function loadAdherence(clientId: string, authorId: string): Promise<AdherenceResult | null> {
  const [views, checks] = await Promise.all([listPlanViews(clientId), listChecks(clientId, daysAgo(13))]);
  const mine = views.filter((v) => v.createdBy === authorId && (v.current || v.next));
  const plan = mine.find((v) => v.active) ?? mine[0];
  if (!plan) return null;
  const versions = await listPlanVersions(plan.id);
  const schedule = { planOn: (date: string) => versionOn(versions, date) };
  const relevant = checks.filter((c) => c.plan_id === plan.id);
  return {
    current: summarizeAdherence(schedule, relevant, dateRange(daysAgo(6), daysAgo(0))),
    previous: summarizeAdherence(schedule, relevant, dateRange(daysAgo(13), daysAgo(7))),
  };
}
