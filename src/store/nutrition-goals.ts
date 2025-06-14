import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface NutritionGoalsState {
  goals: NutritionGoals;
  setGoals: (goals: Partial<NutritionGoals>) => void;
}

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 50,
  carbs: 250,
  fat: 70,
  fiber: 25
};

export const useNutritionGoalsStore = create<NutritionGoalsState>()(
  persist(
    (set) => ({
      goals: DEFAULT_GOALS,
      setGoals: (newGoals) =>
        set((state) => ({
          goals: { ...state.goals, ...newGoals }
        }))
    }),
    {
      name: 'nutrition-goals'
    }
  )
);