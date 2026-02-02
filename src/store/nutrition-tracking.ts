import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  recipeId: number;
  recipeTitle: string;
  servings: number;
  // snapshot (per serving) at the moment the user logs it
  perServing: NutritionTotals;
  createdAt: string; // ISO
}

interface NutritionTrackingState {
  entries: NutritionLogEntry[];

  addRecipeToLog: (recipe: Recipe, servings?: number, date?: string) => void;
  removeEntry: (id: string) => void;
  clearDate: (date: string) => void;

  getTotalsForDate: (date: string) => NutritionTotals;
  getEntriesForDate: (date: string) => NutritionLogEntry[];
}

const zeroTotals = (): NutritionTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
});

const toISODate = (d: Date) => {
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
  return Math.round(n * 10) / 10;
};

export const useNutritionTrackingStore = create<NutritionTrackingState>()(
  persist(
    (set, get) => ({
      entries: [],

      addRecipeToLog: (recipe, servings = 1, date) => {
        const safeServings = sanitizeServings(servings);
        const day = date ?? toISODate(new Date());

        const entry: NutritionLogEntry = {
          id: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          date: day,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          servings: safeServings,
          perServing: {
            calories: Number(recipe.nutritionFacts?.calories ?? 0),
            protein: Number(recipe.nutritionFacts?.protein ?? 0),
            carbs: Number(recipe.nutritionFacts?.carbs ?? 0),
            fat: Number(recipe.nutritionFacts?.fat ?? 0),
            fiber: Number(recipe.nutritionFacts?.fiber ?? 0),
          },
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ entries: [entry, ...state.entries] }));
      },

      removeEntry: (id) => set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      clearDate: (date) => set((state) => ({ entries: state.entries.filter((e) => e.date !== date) })),

      getEntriesForDate: (date) => get().entries.filter((e) => e.date === date),

      getTotalsForDate: (date) => {
        const totals = zeroTotals();
        for (const e of get().entries) {
          if (e.date !== date) continue;
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
      },
    }),
    {
      name: 'nutrition-tracking',
      version: 1,
    },
  ),
);
