import { useAuthStore } from '../store/auth';
import { useHealthProfileStore } from '../store/health-profile';
import { useNutritionGoalsStore } from '../store/nutrition-goals';
import { toISODate, useNutritionTrackingStore } from '../store/nutrition-tracking';
import type { AIUserContext } from '../services/gemini';

const GOAL_LABELS = { lose: 'emagrecer', maintain: 'manter o peso', gain: 'ganhar massa' } as const;

/** Monta, na hora do envio, os dados do usuário que personalizam a IA. */
export function useAIUserContext(): () => AIUserContext {
  return () => {
    const user = useAuthStore.getState().user;
    const { profile } = useHealthProfileStore.getState();
    const { goals, activeGoals } = useNutritionGoalsStore.getState();
    const todayTotals = useNutritionTrackingStore.getState().getTotalsForDate(toISODate(new Date()));
    const isClient = user?.type === 'Client';

    return {
      name: user?.name?.split(' ')[0],
      goal: profile.goal ? GOAL_LABELS[profile.goal] : undefined,
      allergies: profile.allergies,
      dietaryPreferences: profile.dietary_preferences,
      dailyGoals: isClient
        ? Object.fromEntries(activeGoals.map((k) => [k, goals[k]]))
        : undefined,
      todayTotals: isClient && todayTotals.calories > 0 ? { ...todayTotals } : undefined,
    };
  };
}
