import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type GoalKey = keyof NutritionGoals;

interface NutritionGoalsState {
  goals: NutritionGoals;
  activeGoals: GoalKey[];
  /** Nutricionista que definiu as metas atuais (null quando foi o próprio cliente). */
  setBy: string | null;
  loading: boolean;
  saving: boolean;
  fetchGoals: (userId: string) => Promise<void>;
  saveGoals: (goals: NutritionGoals) => Promise<void>;
  toggleGoal: (goal: GoalKey) => Promise<void>;
  reset: () => void;
}

export const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 50,
  carbs: 250,
  fat: 70,
  fiber: 25,
};

export const GOAL_KEYS: GoalKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber'];

const isGoalKey = (v: unknown): v is GoalKey => GOAL_KEYS.includes(v as GoalKey);

// Escritas em sequência: cliques rápidos não chegam fora de ordem no banco.
let writeQueue: Promise<unknown> = Promise.resolve();

async function upsertGoals(goals: NutritionGoals, activeGoals: GoalKey[], extra: { set_by?: null } = {}) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Faça login para salvar suas metas.');
  const { error } = await supabase
    .from('nutrition_goals')
    .upsert(
      { user_id: userId, ...goals, active_goals: activeGoals, ...extra, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

export const useNutritionGoalsStore = create<NutritionGoalsState>()((set, get) => ({
  goals: DEFAULT_GOALS,
  activeGoals: GOAL_KEYS,
  setBy: null,
  loading: false,
  saving: false,

  fetchGoals: async (userId) => {
    set({ loading: true });
    interface GoalsRow extends Partial<NutritionGoals> {
      active_goals?: string[] | null;
      set_by?: string | null;
    }
    const query = (columns: string) =>
      supabase.from('nutrition_goals').select(columns).eq('user_id', userId).maybeSingle<GoalsRow>();
    let { data, error } = await query('calories, protein, carbs, fat, fiber, active_goals, set_by');
    // Banco sem a migration de pacientes (coluna set_by ainda não existe): lê sem ela.
    if (error?.code === '42703') {
      ({ data, error } = await query('calories, protein, carbs, fat, fiber, active_goals'));
    }

    if (error) {
      console.error('Error fetching nutrition goals:', error);
      set({ loading: false });
      return;
    }

    // Sem linha: usuário novo, volta aos padrões (nunca herda metas de outro login).
    set({
      goals: data
        ? {
            calories: Number(data.calories) || DEFAULT_GOALS.calories,
            protein: Number(data.protein) || DEFAULT_GOALS.protein,
            carbs: Number(data.carbs) || DEFAULT_GOALS.carbs,
            fat: Number(data.fat) || DEFAULT_GOALS.fat,
            fiber: Number(data.fiber) || DEFAULT_GOALS.fiber,
          }
        : DEFAULT_GOALS,
      activeGoals: Array.isArray(data?.active_goals) ? data.active_goals.filter(isGoalKey) : GOAL_KEYS,
      setBy: data?.set_by ?? null,
      loading: false,
    });
  },

  saveGoals: async (goals) => {
    const previous = get().goals;
    set({ goals, saving: true });
    try {
      // Metas editadas pelo próprio cliente deixam de ser "definidas pelo nutricionista".
      await (writeQueue = writeQueue.catch(() => undefined).then(() => upsertGoals(goals, get().activeGoals, { set_by: null })));
      set({ setBy: null });
    } catch (error) {
      set({ goals: previous });
      throw error;
    } finally {
      set({ saving: false });
    }
  },

  toggleGoal: async (goal) => {
    const previous = get().activeGoals;
    const next = previous.includes(goal) ? previous.filter((g) => g !== goal) : [...previous, goal];
    set({ activeGoals: next });
    try {
      await (writeQueue = writeQueue.catch(() => undefined).then(() => upsertGoals(get().goals, next)));
    } catch (error) {
      set({ activeGoals: previous });
      throw error;
    }
  },

  reset: () => set({ goals: DEFAULT_GOALS, activeGoals: GOAL_KEYS, setBy: null, loading: false, saving: false }),
}));

// Metas antigas ficavam no navegador sem separar por usuário.
try {
  localStorage.removeItem('nutrition-goals');
} catch {
  /* storage indisponível */
}
