import React, { useMemo, useState } from 'react';
import {
  Beef,
  Droplets,
  Flame,
  Info,
  Leaf,
  Target,
  Wheat,
} from 'lucide-react';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useTranslation } from '../../hooks/useTranslation';

export function NutritionGoalsForm() {
  const { goals, setGoals } = useNutritionGoalsStore();
  const [formData, setFormData] = useState(goals);
  const t = useTranslation();
  const saveGoals = t.profile.saveGoals;
  const dailyGoals = t.profile.dailyGoals;

  // Mapeia as chaves para suas versões traduzidas
  const goalLabels = t.profile.nutritionGoalsnames;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGoals(formData);
  };

  type GoalKey = keyof typeof formData;

  const goalMeta = useMemo(() => {
    return {
      calories: {
        icon: Flame,
        unit: 'kcal',
        accent: 'text-amber-300',
        ring: 'focus-visible:ring-amber-400/40',
      },
      protein: {
        icon: Beef,
        unit: 'g',
        accent: 'text-rose-300',
        ring: 'focus-visible:ring-rose-400/40',
      },
      carbs: {
        icon: Wheat,
        unit: 'g',
        accent: 'text-sky-300',
        ring: 'focus-visible:ring-sky-400/40',
      },
      fat: {
        icon: Droplets,
        unit: 'g',
        accent: 'text-emerald-300',
        ring: 'focus-visible:ring-emerald-400/40',
      },
      fiber: {
        icon: Leaf,
        unit: 'g',
        accent: 'text-lime-300',
        ring: 'focus-visible:ring-lime-400/40',
      },
    } satisfies Record<
      GoalKey,
      {
        icon: React.ComponentType<{ className?: string }>;
        unit: string;
        accent: string;
        ring: string;
      }
    >;
  }, [formData]);

  // Função para lidar com valores decimais
  const handleInputChange = (key: GoalKey, value: string) => {
    const numericValue = Number.isFinite(Number(value)) ? parseFloat(value) : 0;
    setFormData(prev => ({
      ...prev,
      [key]: numericValue < 0 ? 0 : numericValue,
    }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur md:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <Target className="h-5 w-5 text-emerald-300" />
            </span>
            <h3 className="text-lg font-semibold text-white">{dailyGoals}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(Object.entries(formData) as Array<[GoalKey, number]>).map(([key, value]) => {
          const meta = goalMeta[key];
          const Icon = meta.icon;
          const label = goalLabels[key as keyof typeof goalLabels];

          return (
            <div
              key={key}
              className="group rounded-2xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-white/15 hover:bg-slate-950/40"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <Icon className={`h-5 w-5 ${meta.accent}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{label}</div>
                  </div>
                </div>

                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                  {meta.unit}
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={Number.isFinite(value) ? value : 0}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  inputMode="decimal"
                  className={
                    "w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-base text-white outline-none transition " +
                    "placeholder:text-white/30 hover:border-white/15 focus-visible:ring-4 focus-visible:ring-emerald-400/20 " +
                    meta.ring
                  }
                  placeholder="0.0"
                  aria-label={`${label} (${meta.unit})`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 shadow-sm transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/30 md:w-auto"
        >
          {saveGoals}
        </button>
      </div>
    </form>
  );
}