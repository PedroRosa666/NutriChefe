import React, { useEffect, useState } from 'react';
import { Beef, Droplets, Flame, Leaf, Loader2, Sparkles, Target, Wheat } from 'lucide-react';
import { useNutritionGoalsStore, GOAL_KEYS, type GoalKey, type NutritionGoals } from '../../store/nutrition-goals';
import { useHealthProfileStore } from '../../store/health-profile';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { ageFromBirthDate, suggestGoals } from '../../lib/nutrition-calculator';

const GOAL_META: Record<GoalKey, { icon: React.ComponentType<{ className?: string }>; unit: string; accent: string }> = {
  calories: { icon: Flame, unit: 'kcal', accent: 'text-amber-500' },
  protein: { icon: Beef, unit: 'g', accent: 'text-rose-500' },
  carbs: { icon: Wheat, unit: 'g', accent: 'text-sky-500' },
  fat: { icon: Droplets, unit: 'g', accent: 'text-emerald-500' },
  fiber: { icon: Leaf, unit: 'g', accent: 'text-lime-600' },
};

export function NutritionGoalsForm() {
  const { goals, saving, saveGoals } = useNutritionGoalsStore();
  const { profile: health } = useHealthProfileStore();
  const { showToast } = useToastStore();
  const t = useTranslation();
  const [formData, setFormData] = useState<NutritionGoals>(goals);

  // Metas chegam do banco depois do primeiro render.
  useEffect(() => setFormData(goals), [goals]);

  const age = ageFromBirthDate(health.birth_date);
  const canSuggest = Boolean(
    health.sex && age && health.height_cm && health.weight_kg && health.activity_level && health.goal
  );

  const handleSuggest = () => {
    if (!canSuggest) {
      showToast(t.health.fillToCalculate, 'info');
      return;
    }
    setFormData(
      suggestGoals({
        sex: health.sex!,
        age: age!,
        heightCm: health.height_cm!,
        weightKg: health.weight_kg!,
        activityLevel: health.activity_level!,
        goal: health.goal!,
      })
    );
    showToast(t.health.suggestedApplied, 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveGoals(formData);
      showToast(t.profile.goalsSaved, 'success');
    } catch (error) {
      console.error('Error saving goals:', error);
      showToast(t.profile.goalsSaveError, 'error');
    }
  };

  const handleInputChange = (key: GoalKey, value: string) => {
    const n = parseFloat(value);
    setFormData((prev) => ({ ...prev, [key]: Number.isFinite(n) && n > 0 ? n : 0 }));
  };

  const changed = GOAL_KEYS.some((k) => formData[k] !== goals[k]);

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
            <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t.profile.dailyGoals}</h3>
        </div>
        <button
          type="button"
          onClick={handleSuggest}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
          title={canSuggest ? t.health.calculateHint : t.health.fillToCalculate}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t.health.calculateGoals}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOAL_KEYS.map((key) => {
          const meta = GOAL_META[key];
          const Icon = meta.icon;
          const label = t.profile.nutritionGoalsnames[key];
          return (
            <label
              key={key}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition focus-within:border-emerald-400 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <span className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                  <Icon className={`h-4 w-4 ${meta.accent}`} />
                  {label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{meta.unit}</span>
              </span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData[key]}
                onChange={(e) => handleInputChange(key, e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                aria-label={`${label} (${meta.unit})`}
              />
            </label>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.health.disclaimer}</p>

      <button
        type="submit"
        disabled={saving || !changed}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.profile.saveGoals}
      </button>
    </form>
  );
}
