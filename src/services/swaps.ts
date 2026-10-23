// Pedidos de troca de item do plano: o paciente pede, o nutricionista aprova ou recusa
// (podendo oferecer outro alimento). Toda escrita passa pelas funções do banco
// (supabase/migrations/20261022170000_food_swap_requests.sql), que conferem as permissões.
import { sqlArg, supabase } from '../lib/supabase';
import type { MealPlanItem, MealSlot } from './care';
import type { PickedFood } from './foods';
import { fmtNum } from '../lib/format';

/** O que se pede ou oferece no lugar do item: um alimento com quantidade OU uma receita com porções. */
export type SwapChoice = { kind: 'food'; picked: PickedFood } | { kind: 'recipe'; recipeId: string; title: string; servings: number };

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
  requested_recipe_id: string | null;
  requested_servings: number | null;
  requestedRecipeTitle: string | null;
  reason: string;
  status: SwapStatus;
  response_note: string;
  counter_food_id: string | null;
  counter_label: string | null;
  counterFoodName: string | null;
  counter_recipe_id: string | null;
  counter_servings: number | null;
  counterRecipeTitle: string | null;
  applied: boolean;
  created_at: string;
  resolved_at: string | null;
}

const COLUMNS =
  'id, plan_id, client_id, nutritionist_id, day, meal, option_group, original_recipe_id, original_food_id, original_label, ' +
  'requested_food_id, requested_grams, requested_label, requested_recipe_id, requested_servings, reason, status, response_note, ' +
  'counter_food_id, counter_label, counter_recipe_id, counter_servings, applied, created_at, resolved_at, ' +
  'requested:foods!food_swap_requests_requested_food_id_fkey(name), counter:foods!food_swap_requests_counter_food_id_fkey(name), ' +
  'requestedRecipe:recipes!food_swap_requests_requested_recipe_id_fkey(title), counterRecipe:recipes!food_swap_requests_counter_recipe_id_fkey(title)';

type Named = { name: string } | { name: string }[] | null;
type Titled = { title: string } | { title: string }[] | null;
type NumLike = number | string | null;
type SwapRow = Omit<
  SwapRequest,
  'requestedFoodName' | 'counterFoodName' | 'requestedRecipeTitle' | 'counterRecipeTitle' | 'requested_grams' | 'requested_servings' | 'counter_servings'
> & {
  requested_grams: NumLike;
  requested_servings: NumLike;
  counter_servings: NumLike;
  requested: Named;
  counter: Named;
  requestedRecipe: Titled;
  counterRecipe: Titled;
};

const nameOf = (v: Named) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null;
const titleOf = (v: Titled) => (Array.isArray(v) ? v[0]?.title : v?.title) ?? null;
const num = (v: NumLike) => (v === null ? null : Number(v));

const toSwap = ({ requested, counter, requestedRecipe, counterRecipe, ...row }: SwapRow): SwapRequest => ({
  ...row,
  requested_grams: num(row.requested_grams),
  requested_servings: num(row.requested_servings),
  counter_servings: num(row.counter_servings),
  requestedFoodName: nameOf(requested),
  counterFoodName: nameOf(counter),
  requestedRecipeTitle: titleOf(requestedRecipe),
  counterRecipeTitle: titleOf(counterRecipe),
});

/** "Nome — quantidade" do que foi pedido ou oferecido (null se nada). */
export function swapChoiceLabel(r: SwapRequest, side: 'requested' | 'counter', servingsShort: string): string | null {
  const food = side === 'requested' ? r.requestedFoodName : r.counterFoodName;
  if (food) return `${food} — ${side === 'requested' ? r.requested_label : r.counter_label}`;
  const recipe = side === 'requested' ? r.requestedRecipeTitle : r.counterRecipeTitle;
  const servings = side === 'requested' ? r.requested_servings : r.counter_servings;
  return recipe ? `${recipe} — ${fmtNum(servings ?? 1)} ${servingsShort}` : null;
}

/** O pedido tem algo concreto para aplicar (alimento ou receita)? */
export const hasRequestedChoice = (r: SwapRequest) => Boolean(r.requested_food_id || r.requested_recipe_id);

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
  requested: SwapChoice | null;
  reason: string;
}): Promise<void> {
  const { item, requested } = input;
  const food = requested?.kind === 'food' ? requested.picked : null;
  const recipe = requested?.kind === 'recipe' ? requested : null;
  const { error } = await supabase.rpc('request_food_swap', {
    p_plan: input.planId,
    p_day: item.day,
    p_meal: item.meal,
    p_option_group: sqlArg(item.option_group),
    p_original_recipe: sqlArg(item.food_id ? null : item.recipe_id),
    p_original_food: sqlArg(item.food_id),
    p_original_label: input.originalLabel,
    p_requested_food: sqlArg(food?.food.id ?? null),
    p_requested_grams: sqlArg(food?.grams ?? null),
    p_requested_label: sqlArg(food?.label ?? null),
    p_requested_recipe: sqlArg(recipe?.recipeId ?? null),
    p_requested_servings: sqlArg(recipe?.servings ?? null),
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
  counter: SwapChoice | null;
}): Promise<boolean> {
  const counter = input.approve ? null : input.counter;
  const food = counter?.kind === 'food' ? counter.picked : null;
  const recipe = counter?.kind === 'recipe' ? counter : null;
  const { data, error } = await supabase.rpc('resolve_food_swap', {
    p_request: input.requestId,
    p_approve: input.approve,
    p_note: input.note.trim(),
    p_counter_food: sqlArg(food?.food.id ?? null),
    p_counter_grams: sqlArg(food?.grams ?? null),
    p_counter_label: sqlArg(food?.label ?? null),
    p_counter_recipe: sqlArg(recipe?.recipeId ?? null),
    p_counter_servings: sqlArg(recipe?.servings ?? null),
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

/** Texto curto da escolha: "Nome — quantidade". */
export function swapChoiceText(choice: SwapChoice, servingsShort: string): string {
  return choice.kind === 'food'
    ? `${choice.picked.food.name} — ${choice.picked.label}`
    : `${choice.title} — ${fmtNum(choice.servings)} ${servingsShort}`;
}
