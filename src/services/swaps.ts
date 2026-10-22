// Pedidos de troca de item do plano: o paciente pede, o nutricionista aprova ou recusa
// (podendo oferecer outro alimento). Toda escrita passa pelas funções do banco
// (supabase/migrations/20261022170000_food_swap_requests.sql), que conferem as permissões.
import { supabase } from '../lib/supabase';
import type { MealPlanItem, MealSlot } from './care';
import type { PickedFood } from './foods';

export type SwapStatus = 'pending' | 'approved' | 'rejected' | 'canceled';

export interface SwapRequest {
  id: string;
  plan_id: string;
  client_id: string;
  nutritionist_id: string;
  day: number;
  meal: MealSlot;
  option_group: number | null;
  original_recipe_id: string | null;
  original_food_id: string | null;
  original_label: string;
  requested_food_id: string | null;
  requested_grams: number | null;
  requested_label: string | null;
  requestedFoodName: string | null;
  reason: string;
  status: SwapStatus;
  response_note: string;
  counter_food_id: string | null;
  counter_label: string | null;
  counterFoodName: string | null;
  applied: boolean;
  created_at: string;
  resolved_at: string | null;
}

const COLUMNS =
  'id, plan_id, client_id, nutritionist_id, day, meal, option_group, original_recipe_id, original_food_id, original_label, ' +
  'requested_food_id, requested_grams, requested_label, reason, status, response_note, counter_food_id, counter_label, ' +
  'applied, created_at, resolved_at, requested:foods!food_swap_requests_requested_food_id_fkey(name), ' +
  'counter:foods!food_swap_requests_counter_food_id_fkey(name)';

type Named = { name: string } | { name: string }[] | null;
type SwapRow = Omit<SwapRequest, 'requestedFoodName' | 'counterFoodName' | 'requested_grams'> & {
  requested_grams: number | string | null;
  requested: Named;
  counter: Named;
};

const nameOf = (v: Named) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null;

const toSwap = ({ requested, counter, ...row }: SwapRow): SwapRequest => ({
  ...row,
  requested_grams: row.requested_grams === null ? null : Number(row.requested_grams),
  requestedFoodName: nameOf(requested),
  counterFoodName: nameOf(counter),
});

/** Pedidos de um paciente (vistos pelo próprio paciente ou pelo nutricionista dele). */
export async function listSwapsForClient(clientId: string): Promise<SwapRequest[]> {
  const { data, error } = await supabase
    .from('food_swap_requests')
    .select(COLUMNS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as SwapRow[]).map(toSwap);
}

/** Quantidade de pedidos abertos por paciente, para o nutricionista logado. */
export async function pendingSwapCounts(nutritionistId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('food_swap_requests')
    .select('client_id')
    .eq('nutritionist_id', nutritionistId)
    .eq('status', 'pending');
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { client_id: string }[]) counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1);
  return counts;
}

export async function requestSwap(input: {
  planId: string;
  item: MealPlanItem;
  originalLabel: string;
  requested: PickedFood | null;
  reason: string;
}): Promise<void> {
  const { item, requested } = input;
  const { error } = await supabase.rpc('request_food_swap', {
    p_plan: input.planId,
    p_day: item.day,
    p_meal: item.meal,
    p_option_group: item.option_group,
    p_original_recipe: item.food_id ? null : item.recipe_id,
    p_original_food: item.food_id,
    p_original_label: input.originalLabel,
    p_requested_food: requested?.food.id ?? null,
    p_requested_grams: requested?.grams ?? null,
    p_requested_label: requested?.label ?? null,
    p_reason: input.reason.trim(),
  });
  if (error) throw error;
}

export async function cancelSwap(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_food_swap', { p_request: requestId });
  if (error) throw error;
}

/** Devolve true se o plano foi alterado. */
export async function resolveSwap(input: {
  requestId: string;
  approve: boolean;
  note: string;
  counter: PickedFood | null;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('resolve_food_swap', {
    p_request: input.requestId,
    p_approve: input.approve,
    p_note: input.note.trim(),
    p_counter_food: input.approve ? null : input.counter?.food.id ?? null,
    p_counter_grams: input.approve ? null : input.counter?.grams ?? null,
    p_counter_label: input.approve ? null : input.counter?.label ?? null,
  });
  if (error) throw error;
  return Boolean(data);
}

/** O pedido aberto (se houver) para um item do plano. */
export function pendingFor(swaps: SwapRequest[], planId: string, item: MealPlanItem): SwapRequest | undefined {
  return swaps.find(
    (s) =>
      s.status === 'pending' &&
      s.plan_id === planId &&
      s.day === item.day &&
      s.meal === item.meal &&
      s.option_group === item.option_group &&
      (item.food_id ? s.original_food_id === item.food_id : s.original_recipe_id === item.recipe_id)
  );
}
