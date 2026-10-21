import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';
import type { Recipe } from '../types/recipe';

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
  createdAt: string; // ISO
}

export interface NutritionLogRow {
  id: string;
  entry_date: string;
  recipe_id: string | null;
  recipe_title: string;
  servings: number | string;
  per_serving: Partial<NutritionTotals> | null;
  created_at: string;
}

interface NutritionTrackingState {
  entries: NutritionLogEntry[];
  loading: boolean;

  fetchEntries: (userId: string) => Promise<void>;
  addRecipeToLog: (recipe: Recipe, servings?: number, date?: string) => Promise<void>;
  /** Alimento avulso (lista de alimentos comuns ou valores digitados). */
  addFoodToLog: (title: string, perServing: NutritionTotals, servings?: number, date?: string) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  clearDate: (date: string) => Promise<void>;
  reset: () => void;

  getTotalsForDate: (date: string) => NutritionTotals;
  getEntriesForDate: (date: string) => NutritionLogEntry[];
}

// Janela carregada do banco: suficiente para gráficos semanais/mensais e sequência de dias.
const HISTORY_DAYS = 90;

export const zeroTotals = (): NutritionTotals => ({
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

const toTotals = (v: Partial<NutritionTotals> | null | undefined): NutritionTotals => ({
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
  createdAt: row.created_at,
});

const requireUserId = () => {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Faça login para usar o diário alimentar.');
  return userId;
};

async function insertEntry(
  recipeId: string | null,
  title: string,
  perServing: NutritionTotals,
  servings: number,
  date?: string
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
      per_serving: perServing,
    })
    .select('id, entry_date, recipe_id, recipe_title, servings, per_serving, created_at')
    .single();

  if (error) throw error;
  return fromRow(data);
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

/** Dias seguidos (até hoje ou ontem) com pelo menos um registro. */
export function getStreak(entries: NutritionLogEntry[]): number {
  const days = new Set(entries.map((e) => e.date));
  const cursor = new Date();
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
      .select('id, entry_date, recipe_id, recipe_title, servings, per_serving, created_at')
      .eq('user_id', userId)
      .gte('entry_date', toISODate(since))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching nutrition log:', error);
      set({ loading: false });
      return;
    }
    set({ entries: (data ?? []).map(fromRow), loading: false });
  },

  addRecipeToLog: async (recipe, servings = 1, date) => {
    const entry = await insertEntry(recipe.id, recipe.title, toTotals(recipe.nutritionFacts), servings, date);
    set((state) => ({ entries: [entry, ...state.entries] }));
  },

  addFoodToLog: async (title, perServing, servings = 1, date) => {
    const entry = await insertEntry(null, title.slice(0, 200), toTotals(perServing), servings, date);
    set((state) => ({ entries: [entry, ...state.entries] }));
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
