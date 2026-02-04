import React, { useMemo } from 'react';
import {
  Beef,
  Droplets,
  Flame,
  Leaf,
  Settings,
  Wheat,
} from 'lucide-react';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';

export function ActiveGoalsSelector() {
  const { activeGoals, toggleGoal } = useNutritionGoalsStore();
  const { user } = useAuthStore();
  const t = useTranslation();

  const goalLabels = t.profile.nutritionGoalsnames;

  const goals: Array<{
    key: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    color: string;
  }> = useMemo(
    () => [
      {
        key: 'calories',
        icon: Flame,
        accent: 'text-amber-300',
        color: 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30',
      },
      {
        key: 'protein',
        icon: Beef,
        accent: 'text-rose-300',
        color: 'bg-rose-500/20 border-rose-500/50 hover:bg-rose-500/30',
      },
      {
        key: 'carbs',
        icon: Wheat,
        accent: 'text-sky-300',
        color: 'bg-sky-500/20 border-sky-500/50 hover:bg-sky-500/30',
      },
      {
        key: 'fat',
        icon: Droplets,
        accent: 'text-emerald-300',
        color: 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30',
      },
      {
        key: 'fiber',
        icon: Leaf,
        accent: 'text-lime-300',
        color: 'bg-lime-500/20 border-lime-500/50 hover:bg-lime-500/30',
      },
    ],
    [],
  );

  const handleToggle = async (goalKey: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber') => {
    if (user?.id) {
      await toggleGoal(user.id, goalKey);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Metas para Acompanhar
        </h3>
      </div>

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Selecione quais metas nutricionais você deseja acompanhar diariamente
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {goals.map(({ key, icon: Icon, accent, color }) => {
          const isActive = activeGoals.includes(key);
          const label = goalLabels[key as keyof typeof goalLabels];

          return (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${
                isActive
                  ? `${color} border-current`
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`h-6 w-6 ${accent}`} />
              <span className="text-xs font-medium text-slate-900 dark:text-slate-200">
                {label}
              </span>

              {isActive && (
                <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
