import { create } from 'zustand';
import { supabase, toJson } from '../lib/supabase';
import { useAuthStore } from './auth';
import type { Recipe } from '../types/recipe';
import { feedback } from '../lib/i18n/current';

/** Refeições do diário: as mesmas do plano alimentar. */
export type DiaryMeal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const DIARY_MEALS: DiaryMeal[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/**
 * Onde entra um registro do diário: uma das refeições de sempre, um bloco do plano em uso (id e
 * nome como estão no plano) ou nenhuma (null: "Fora do plano"/"Outros").
 */
export type DiaryMealTarget = DiaryMeal | { id: string; name: string; category: DiaryMeal | null } | null;

/** Colunas gravadas para um destino. */
function mealColumns(target: DiaryMealTarget): { meal: DiaryMeal | null; meal_id: string | null; meal_name: string | null } {
  if (target === null) return { meal: null, meal_id: null, meal_name: null };
  if (typeof target === 'string') return { meal: target, meal_id: null, meal_name: null };
  return { meal: target.category, meal_id: target.id, meal_name: target.name.slice(0, 60) };
}

/** Refeição provável pelo horário (o padrão ao registrar; a pessoa pode trocar). */
export function mealForTime(date = new Date()): DiaryMeal {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60 + 30) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 18 * 60 + 30) return 'snack';
  return 'dinner';
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface NutritionLogEntry {
  id: string;
  date: string; // YYYY-MM-DD (local)
  recipeId: string | null;
  recipeTitle: string;
  servings: number;
  // snapshot (per serving) at the moment the user logs it
  perServing: NutritionTotals;
  /** Refeição; registros antigos não têm (aparecem em "Outros"). */
  meal: DiaryMeal | null;
  /** Bloco do plano (e o nome dele quando foi registrado), se o registro foi numa refeição do plano. */
  mealId: string | null;
  mealName: string | null;
  /** Veio do "Comi" do plano: acompanha a marcação (desmarcar tira). */
  planCheckId: string | null;
  createdAt: string; // ISO
}

export interface NutritionLogRow {
  id: string;
  entry_date: string;
  recipe_id: string | null;
  recipe_title: string;
  servings: number | string;
  per_serving: Partial<NutritionTotals> | null;
  meal?: string | null;
  meal_id?: string | null;
  meal_name?: string | null;
  plan_check_id?: string | null;
  created_at: string;
}

interface NutritionTrackingState {
  entries: NutritionLogEntry[];
  loading: boolean;

  fetchEntries: (userId: string) => Promise<void>;
  addRecipeToLog: (recipe: Recipe, servings?: number, date?: string, meal?: DiaryMealTarget) => Promise<void>;
  /** Alimento avulso (lista de alimentos comuns ou valores digitados). */
  addFoodToLog: (
    title: string,
    perServing: NutritionTotals,
    servings?: number,
    date?: string,
    extra?: Record<string, number>,
    meal?: DiaryMealTarget
  ) => Promise<void>;
  /**
   * Corrige um registro: porções e refeição. Um registro que veio do "Comi" deixa de acompanhar a
   * marcação (senão marcar de novo o sobrescreveria).
   */
  updateEntry: (id: string, patch: { servings?: number; meal?: DiaryMealTarget }) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  clearDate: (date: string) => Promise<void>;
  reset: () => void;

  getTotalsForDate: (date: string) => NutritionTotals;
  getEntriesForDate: (date: string) => NutritionLogEntry[];
}

// Janela carregada do banco: suficiente para gráficos semanais/mensais e sequência de dias.
/** Dias de diário carregados (o seletor de data não vai além disso). */
export const HISTORY_DAYS = 90;

const zeroTotals = (): NutritionTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
});

export const toISODate = (d: Date) => {
  // local date -> YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeServings = (value: number | undefined) => {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n) || n <= 0) return 1;
  // keep one decimal for UX
  return Math.min(50, Math.round(n * 10) / 10);
};

export const toTotals = (v: Partial<NutritionTotals> | null | undefined): NutritionTotals => ({
  calories: Number(v?.calories) || 0,
  protein: Number(v?.protein) || 0,
  carbs: Number(v?.carbs) || 0,
  fat: Number(v?.fat) || 0,
  fiber: Number(v?.fiber) || 0,
});

export const fromRow = (row: NutritionLogRow): NutritionLogEntry => ({
  id: row.id,
  date: row.entry_date,
  recipeId: row.recipe_id,
  recipeTitle: row.recipe_title,
  servings: Number(row.servings) || 1,
  perServing: toTotals(row.per_serving),
  meal: DIARY_MEALS.includes(row.meal as DiaryMeal) ? (row.meal as DiaryMeal) : null,
  mealId: row.meal_id ?? null,
  mealName: row.meal_name ?? null,
  planCheckId: row.plan_check_id ?? null,
  createdAt: row.created_at,
});

const ENTRY_COLUMNS = 'id, entry_date, recipe_id, recipe_title, servings, per_serving, meal, meal_id, meal_name, plan_check_id, created_at';

const requireUserId = () => {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error(feedback().loginRequired.diary);
  return userId;
};

async function insertEntry(
  recipeId: string | null,
  title: string,
  // Além dos 5 valores, alimentos do catálogo gravam os nutrientes completos (minerais, vitaminas...).
  perServing: NutritionTotals | (NutritionTotals & Record<string, number>),
  servings: number,
  date?: string,
  meal?: DiaryMealTarget
) {
  const userId = requireUserId();
  const { data, error } = await supabase
    .from('nutrition_log_entries')
    .insert({
      user_id: userId,
      entry_date: date ?? toISODate(new Date()),
      recipe_id: recipeId,
      recipe_title: title,
      servings: sanitizeServings(servings),
      per_serving: toJson(perServing),
      // Sem refeição informada: a do horário (registro de hoje) ou nenhuma (outro dia).
      ...mealColumns(meal !== undefined ? meal : !date || date === toISODate(new Date()) ? mealForTime() : null),
    })
    .select(ENTRY_COLUMNS)
    .single();

  if (error) throw error;
  return fromRow(data as unknown as NutritionLogRow);
}

export function sumEntries(entries: NutritionLogEntry[]): NutritionTotals {
  const totals = zeroTotals();
  for (const e of entries) {
    totals.calories += e.perServing.calories * e.servings;
    totals.protein += e.perServing.protein * e.servings;
    totals.carbs += e.perServing.carbs * e.servings;
    totals.fat += e.perServing.fat * e.servings;
    totals.fiber += e.perServing.fiber * e.servings;
  }
  // normalize to one decimal
  return {
    calories: Math.round(totals.calories * 10) / 10,
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
  };
}

export const useNutritionTrackingStore = create<NutritionTrackingState>()((set, get) => ({
  entries: [],
  loading: false,

  fetchEntries: async (userId) => {
    set({ loading: true });
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);
    const { data, error } = await supabase
      .from('nutrition_log_entries')
      .select(ENTRY_COLUMNS)
      .eq('user_id', userId)
      .gte('entry_date', toISODate(since))
      .order('created_at', { ascending: false });

    // Resposta de outra conta (troca de usuário no meio do caminho): descarta.
    if (useAuthStore.getState().user?.id !== userId) return;

    if (error) {
      console.error('Error fetching nutrition log:', error);
      set({ loading: false });
      return;
    }
    set({ entries: ((data ?? []) as unknown as NutritionLogRow[]).map(fromRow), loading: false });
  },

  addRecipeToLog: async (recipe, servings = 1, date, meal) => {
    const entry = await insertEntry(recipe.id, recipe.title, toTotals(recipe.nutritionFacts), servings, date, meal);
    set((state) => ({ entries: [entry, ...state.entries] }));
  },

  addFoodToLog: async (title, perServing, servings = 1, date, extra = {}, meal) => {
    const entry = await insertEntry(null, title.slice(0, 200), { ...extra, ...toTotals(perServing) }, servings, date, meal);
    set((state) => ({ entries: [entry, ...state.entries] }));
  },

  updateEntry: async (id, patch) => {
    const previous = get().entries;
    const changes: { servings?: number; meal?: DiaryMeal | null; meal_id?: string | null; meal_name?: string | null; plan_check_id?: null } = {};
    if (patch.servings !== undefined) changes.servings = sanitizeServings(patch.servings);
    if (patch.meal !== undefined) Object.assign(changes, mealColumns(patch.meal));
    // Editado à mão: desliga da marcação do plano (fica como registro avulso).
    if (previous.find((e) => e.id === id)?.planCheckId) changes.plan_check_id = null;
    const local: Partial<NutritionLogEntry> = {
      ...(changes.servings !== undefined && { servings: changes.servings }),
      ...(patch.meal !== undefined && { meal: changes.meal ?? null, mealId: changes.meal_id ?? null, mealName: changes.meal_name ?? null }),
      ...('plan_check_id' in changes && { planCheckId: null }),
    };
    set({ entries: previous.map((e) => (e.id === id ? { ...e, ...local } : e)) });
    const { error } = await supabase.from('nutrition_log_entries').update(changes).eq('id', id);
    if (error) {
      set({ entries: previous });
      throw error;
    }
  },

  removeEntry: async (id) => {
    const previous = get().entries;
    set({ entries: previous.filter((e) => e.id !== id) });
    const { error } = await supabase.from('nutrition_log_entries').delete().eq('id', id);
    if (error) {
      set({ entries: previous });
      throw error;
    }
  },

  clearDate: async (date) => {
    const userId = requireUserId();
    const previous = get().entries;
    set({ entries: previous.filter((e) => e.date !== date) });
    const { error } = await supabase
      .from('nutrition_log_entries')
      .delete()
      .eq('user_id', userId)
      .eq('entry_date', date);
    if (error) {
      set({ entries: previous });
      throw error;
    }
  },

  reset: () => set({ entries: [], loading: false }),

  getEntriesForDate: (date) => get().entries.filter((e) => e.date === date),

  getTotalsForDate: (date) => sumEntries(get().entries.filter((e) => e.date === date)),
}));

// Limpa o diário que antes ficava salvo no navegador (não era separado por usuário).
try {
  localStorage.removeItem('nutrition-tracking');
} catch {
  /* storage indisponível */
}
