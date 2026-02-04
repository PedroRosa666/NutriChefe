import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

type GoalKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';

interface NutritionGoalsState {
  goals: NutritionGoals;
  activeGoals: GoalKey[];
  setGoals: (goals: Partial<NutritionGoals>) => void;
  fetchGoals: (userId: string) => Promise<void>;
  setActiveGoals: (userId: string, activeGoals: GoalKey[]) => Promise<void>;
  toggleGoal: (userId: string, goal: GoalKey) => Promise<void>;
  loading: boolean;
}

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000.0,
  protein: 50.0,
  carbs: 250.0,
  fat: 70.0,
  fiber: 25.0
};

const DEFAULT_ACTIVE_GOALS: GoalKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

export const useNutritionGoalsStore = create<NutritionGoalsState>()(
  persist(
    (set) => ({
      goals: DEFAULT_GOALS,
      activeGoals: DEFAULT_ACTIVE_GOALS,
      loading: false,

      fetchGoals: async (userId: string) => {
        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('nutrition_goals')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            set({
              goals: {
                calories: data.calories || DEFAULT_GOALS.calories,
                protein: data.protein || DEFAULT_GOALS.protein,
                carbs: data.carbs || DEFAULT_GOALS.carbs,
                fat: data.fat || DEFAULT_GOALS.fat,
                fiber: data.fiber || DEFAULT_GOALS.fiber,
              },
              activeGoals: data.active_goals || DEFAULT_ACTIVE_GOALS,
              loading: false
            });
          } else {
            set({ loading: false });
          }
        } catch (error) {
          console.error('Error fetching nutrition goals:', error);
          set({ loading: false });
        }
      },

      setActiveGoals: async (userId: string, activeGoals: GoalKey[]) => {
        try {
          const { error } = await supabase
            .from('nutrition_goals')
            .update({ active_goals: activeGoals })
            .eq('user_id', userId);

          if (error) throw error;

          set({ activeGoals });
        } catch (error) {
          console.error('Error updating active goals:', error);
          throw error;
        }
      },

      toggleGoal: async (userId: string, goal: GoalKey) => {
        set(state => {
          const newActiveGoals = state.activeGoals.includes(goal)
            ? state.activeGoals.filter(g => g !== goal)
            : [...state.activeGoals, goal];

          (async () => {
            try {
              const { error } = await supabase
                .from('nutrition_goals')
                .update({ active_goals: newActiveGoals })
                .eq('user_id', userId);

              if (error) throw error;
            } catch (error) {
              console.error('Error toggling goal:', error);
            }
          })();

          return { activeGoals: newActiveGoals };
        });
      },

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