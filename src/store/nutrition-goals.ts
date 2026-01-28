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
  calories: 2000.0,
  protein: 50.0,
  carbs: 250.0,
  fat: 70.0,
  fiber: 25.0
};

export const useNutritionGoalsStore = create<NutritionGoalsState>()(
  persist(
    (set) => ({
      goals: DEFAULT_GOALS,
      setGoals: (newGoals) =>
        set((state) => ({
          goals: { 
            ...state.goals, 
            ...Object.fromEntries(
              Object.entries(newGoals).map(([key, value]) => [key, Number(value)])
            )
          }
        }))
    }),
    {
      name: 'nutrition-goals'
    }
  )
);