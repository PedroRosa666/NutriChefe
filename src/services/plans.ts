// Planos alimentares: rascunho, versões publicadas e plano em uso
// (supabase/migrations/20261105120000_plan_versions.sql).
//
// - O rascunho (meal_plans + meal_plan_items) é de quem fez o plano. Salvar confere a revisão que
//   a tela abriu: se outra aba ou aparelho salvou antes, vem "version_conflict" e nada é gravado.
// - Publicar cria uma versão imutável, com o retrato das receitas e alimentos daquele momento.
//   O paciente vê sempre a versão vigente; o diário e as marcações usam esse retrato.
import { fromJson, sqlArg, supabase, toJson } from '../lib/supabase';
import type { Recipe } from '../types/recipe';
import type { MealPlan, MealPlanItem, MealSlot, PlanMeal } from './care';
import { toFood, type FoodRow } from './foods';
import { mealToJson, sortItemsByMeals, toPlanMeal, type MealRow } from '../lib/plan-meals';

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

// ---------------------------------------------------------------- rascunho

const PLAN_SELECT =
  'id, client_id, created_by, title, notes, created_at, updated_at, revision, author:profiles!meal_plans_created_by_fkey(full_name), ' +
  'meals:meal_plan_meals(id, name, position, category, days, time_of_day, guidance, day_overrides, kcal_share), ' +
  'items:meal_plan_items(id, day, meal_id, meal, recipe_id, servings, food_id, grams, measure_label, option_group, note, position, ' +
  'food:foods(id, taco_id, owner_id, name, category, kcal, protein, carbs, fat, fiber, sodium, nutrients, measures))';

interface ItemRow {
  id: string;
  day: number;
  meal_id: string;
  meal: MealSlot | null;
  recipe_id: string | null;
  servings: number | string;
  food_id: string | null;
  grams: number | string | null;
  measure_label: string | null;
  option_group: number | null;
  note: string;
  position?: number;
  food: FoodRow | FoodRow[] | null;
}

interface PlanRow {
  id: string;
  client_id: string;
  created_by: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  revision?: number;
  author: { full_name: string | null } | { full_name: string | null }[] | null;
  meals: (MealRow & { position: number })[] | null;
  items: ItemRow[] | null;
}

const toItem = (i: ItemRow): MealPlanItem => {
  const food = one(i.food);
  return {
    id: i.id,
    day: i.day,
    meal_id: i.meal_id,
    meal: i.meal ?? null,
    recipe_id: i.recipe_id,
    servings: Number(i.servings) || 1,
    food_id: i.food_id,
    food: food ? toFood(food) : null,
    grams: i.grams === null || i.grams === undefined ? null : Number(i.grams),
    measure_label: i.measure_label,
    option_group: i.option_group ?? null,
    note: i.note ?? '',
  };
};

const toPlan = (row: PlanRow): MealPlan => {
  const meals = (row.meals ?? []).slice().sort((a, b) => a.position - b.position).map(toPlanMeal);
  return {
    id: row.id,
    client_id: row.client_id,
    created_by: row.created_by,
    title: row.title,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    authorName: one(row.author)?.full_name ?? null,
    revision: row.revision,
    meals,
    // Ordem do rascunho: dia, ordem dos blocos e a posição gravada (a ordem em que o profissional montou).
    items: sortItemsByMeals(
      (row.items ?? [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(toItem),
      meals
    ),
  };
};

/** Rascunho atual (só quem fez o plano edita): abre o editor. */
export async function getPlanDraft(planId: string): Promise<MealPlan> {
  const { data, error } = await supabase.from('meal_plans').select(PLAN_SELECT).eq('id', planId).single();
  if (error) throw error;
  return toPlan(data as unknown as PlanRow);
}

export interface SavePlanResult {
  planId: string;
  revision: number;
  version: { versionId: string; number: number; validFrom: string; isNew: boolean } | null;
}

const toVersionRef = (v: unknown): SavePlanResult['version'] => {
  const r = v as { version_id?: string; number?: number; valid_from?: string; new?: boolean } | null;
  return r?.version_id ? { versionId: r.version_id, number: Number(r.number), validFrom: String(r.valid_from), isNew: r.new === true } : null;
};

/**
 * Salva o rascunho numa transação (e publica junto com `publish`). `operationId` identifica a
 * tentativa: repetir com o mesmo id (clique duplo, internet caindo) não grava duas vezes.
 */
export async function savePlanDraft(input: {
  id?: string;
  clientId: string;
  title: string;
  notes: string;
  meals: PlanMeal[];
  items: MealPlanItem[];
  expectedRevision?: number;
  publish: boolean;
  operationId: string;
}): Promise<SavePlanResult> {
  const items = input.items.map((i) => ({
    id: i.id,
    day: i.day,
    meal_id: i.meal_id,
    recipe_id: i.food_id ? null : i.recipe_id,
    servings: i.food_id ? 1 : i.servings,
    food_id: i.food_id,
    grams: i.food_id ? i.grams : null,
    measure_label: i.food_id ? i.measure_label ?? null : null,
    option_group: i.option_group,
    note: i.note,
  }));
  const { data, error } = await supabase.rpc('save_plan_draft', {
    p_plan: sqlArg(input.id),
    p_client: input.clientId,
    p_title: input.title,
    p_notes: input.notes,
    p_items: toJson(items),
    p_expected_revision: sqlArg(input.expectedRevision),
    p_publish: input.publish,
    p_operation: input.operationId,
    p_meals: toJson(input.meals.map(mealToJson)),
  });
  if (error) throw error;
  const r = fromJson<{ plan_id: string; revision: number; version: unknown }>(data);
  return { planId: r.plan_id, revision: Number(r.revision), version: toVersionRef(r.version) };
}

/** Publica o rascunho atual. */
export async function publishPlan(planId: string, expectedRevision: number | undefined, operationId: string) {
  const { data, error } = await supabase.rpc('publish_plan', {
    p_plan: planId,
    p_expected_revision: sqlArg(expectedRevision),
    p_operation: operationId,
  });
  if (error) throw error;
  return toVersionRef(data);
}

export async function deletePlan(planId: string) {
  const { error } = await supabase.from('meal_plans').delete().eq('id', planId);
  if (error) throw error;
}

/** O paciente escolhe qual plano está em uso (Meu dia, "Comi", lembretes). */
export async function selectActivePlan(planId: string) {
  const { error } = await supabase.rpc('select_active_plan', { p_plan: planId });
  if (error) throw error;
}

// ---------------------------------------------------------------- versões

interface RecipeSnapshot {
  title: string;
  image: string | null;
  category: string | null;
  prep_time: number | null;
  difficulty: string | null;
  nutrition_facts: Partial<Recipe['nutritionFacts']> | null;
  ingredients: string[] | null;
}

/** Receita como estava na publicação: o suficiente para mostrar, somar e montar a lista de compras. */
function snapshotRecipe(id: string, s: RecipeSnapshot): Recipe {
  const n = s.nutrition_facts ?? {};
  return {
    id,
    title: s.title,
    description: '',
    image: s.image ?? '',
    prepTime: Number(s.prep_time) || 0,
    difficulty: (s.difficulty as Recipe['difficulty']) ?? 'easy',
    rating: 0,
    reviewCount: 0,
    category: s.category ?? '',
    ingredients: s.ingredients ?? [],
    instructions: [],
    nutritionFacts: {
      calories: Number(n.calories) || 0,
      protein: Number(n.protein) || 0,
      carbs: Number(n.carbs) || 0,
      fat: Number(n.fat) || 0,
      fiber: Number(n.fiber) || 0,
    },
    reviews: [],
    authorId: '',
    createdAt: '',
    updatedAt: '',
  };
}

export interface PlanVersion {
  id: string;
  number: number;
  validFrom: string;
  publishedAt: string;
  /** Versão 1 criada na migração com o conteúdo daquele dia (antes não havia versões). */
  legacy: boolean;
  title: string;
  notes: string;
  meals: PlanMeal[];
  items: MealPlanItem[];
  /** Receitas do retrato, pelo id. */
  recipes: Map<string, Recipe>;
}

interface VersionRow {
  id: string;
  number: number;
  valid_from: string;
  published_at: string;
  legacy: boolean;
  content: { title?: string; notes?: string; meals?: MealRow[]; items?: ItemRow[]; recipes?: Record<string, RecipeSnapshot> };
}

const toVersion = (row: VersionRow): PlanVersion => {
  const meals = (row.content.meals ?? []).map(toPlanMeal);
  return {
    id: row.id,
    number: Number(row.number),
    validFrom: row.valid_from,
    publishedAt: row.published_at,
    legacy: row.legacy === true,
    title: row.content.title ?? '',
    notes: row.content.notes ?? '',
    meals,
    // Só itens de blocos que a versão tem naquele dia (o retrato já vem assim).
    items: (row.content.items ?? []).map(toItem).filter((i) => meals.some((m) => m.id === i.meal_id && m.days.includes(i.day))),
    recipes: new Map(Object.entries(row.content.recipes ?? {}).map(([id, s]) => [id, snapshotRecipe(id, s)])),
  };
};

/** Plano como aparece na tela: a versão vigente, a próxima (se já publicada) e o estado do rascunho. */
export interface PlanView {
  id: string;
  clientId: string;
  createdBy: string;
  authorName: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  /** Há alterações no rascunho que o paciente ainda não vê. */
  hasUnpublished: boolean;
  /** Plano em uso pelo paciente. */
  active: boolean;
  current: PlanVersion | null;
  next: { id: string; number: number; validFrom: string } | null;
}

interface ViewRow {
  id: string;
  client_id: string;
  created_by: string;
  title: string;
  created_at: string;
  updated_at: string;
  revision: number;
  published_revision: number;
  author_name: string | null;
  active: boolean;
  current: VersionRow | null;
  next: { id: string; number: number; valid_from: string } | null;
}

/** Planos do paciente que quem está logado pode ver (o próprio paciente ou o nutricionista dele). */
export async function listPlanViews(clientId: string): Promise<PlanView[]> {
  const { data, error } = await supabase.rpc('plan_views', { p_client: clientId });
  if (error) throw error;
  return (fromJson<ViewRow[]>(data) ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    createdBy: r.created_by,
    authorName: r.author_name,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    revision: Number(r.revision),
    hasUnpublished: Number(r.revision) > Number(r.published_revision),
    active: r.active === true,
    current: r.current ? toVersion(r.current) : null,
    next: r.next ? { id: r.next.id, number: Number(r.next.number), validFrom: r.next.valid_from } : null,
  }));
}

/** Todas as versões de um plano (a adesão usa a que valia em cada dia). */
export async function listPlanVersions(planId: string): Promise<PlanVersion[]> {
  const { data, error } = await supabase
    .from('meal_plan_versions')
    .select('id, number, valid_from, published_at, legacy, content')
    .eq('plan_id', planId)
    .order('number', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as VersionRow[]).map(toVersion);
}

/** Versão que vale numa data: a de maior número entre as que já começaram. */
export function versionOn(versions: PlanVersion[], date: string): PlanVersion | null {
  let best: PlanVersion | null = null;
  for (const v of versions) {
    if (v.validFrom > date) continue;
    if (!best || v.validFrom > best.validFrom || (v.validFrom === best.validFrom && v.number > best.number)) best = v;
  }
  return best;
}

/**
 * O plano para mostrar: a versão vigente (ou, se a primeira ainda vai começar, nada). O formato é o
 * mesmo do rascunho, para PDF, compras, "Comi" e as telas usarem um tipo só.
 */
export function versionAsPlan(view: PlanView, version: PlanVersion): MealPlan {
  return {
    id: view.id,
    client_id: view.clientId,
    created_by: view.createdBy,
    title: version.title || view.title,
    notes: version.notes,
    created_at: view.createdAt,
    updated_at: version.publishedAt,
    authorName: view.authorName,
    meals: version.meals,
    items: sortItemsByMeals(version.items, version.meals),
    revision: view.revision,
  };
}

/** Receitas para somar e mostrar: as do retrato da versão têm prioridade sobre o catálogo atual. */
export function withSnapshotRecipes(catalog: Map<string, Recipe>, version: PlanVersion | null): Map<string, Recipe> {
  if (!version || !version.recipes.size) return catalog;
  const merged = new Map(catalog);
  for (const [id, recipe] of version.recipes) {
    const live = catalog.get(id);
    // Do catálogo, só o que não é prescrição (imagem atual, nota); nome e nutrientes ficam os do retrato.
    merged.set(id, live ? { ...live, title: recipe.title, nutritionFacts: recipe.nutritionFacts, ingredients: recipe.ingredients } : recipe);
  }
  return merged;
}

/** Novo id para uma operação (repetir a mesma chamada com ele não grava duas vezes). */
export const newOperationId = () => crypto.randomUUID();
