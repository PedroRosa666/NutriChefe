import React, { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Loader2, Plus, Scale, Sparkles, X } from 'lucide-react';
import { useHealthProfileStore, type HealthProfile } from '../../store/health-profile';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ageFromBirthDate, bmi, bmiRange, suggestGoals, tdee,
  type ActivityLevel, type BodyGoal, type Sex,
} from '../../lib/nutrition-calculator';
import { cn } from '../../lib/utils';
import { WeightChart } from './WeightChart';
import { LoadError } from '../common/LoadError';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuthStore } from '../../store/auth';

const DIET_OPTIONS = ['vegetarian', 'vegan', 'glutenFree', 'lactoseFree', 'lowCarb', 'highProtein', 'mediterranean'] as const;
const ACTIVITY: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOALS: BodyGoal[] = ['lose', 'maintain', 'gain'];

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300';

const toNum = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function HealthProfileForm() {
  const { profile, weightLogs, saveHealthProfile, logWeight, loaded, loadError, fetchHealthProfile } = useHealthProfileStore();
  const userId = useAuthStore((s) => s.user?.id);
  const { saveGoals } = useNutritionGoalsStore();
  const { showToast } = useToastStore();
  const t = useTranslation();
  const h = t.health;

  const [form, setForm] = useState<HealthProfile>(profile);
  const [allergyInput, setAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  useEffect(() => setForm(profile), [profile]);

  const set = <K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const age = ageFromBirthDate(form.birth_date);
  const currentBmi = form.height_cm && form.weight_kg ? bmi(form.height_cm, form.weight_kg) : null;

  const body = useMemo(
    () =>
      form.sex && age && form.height_cm && form.weight_kg && form.activity_level && form.goal
        ? {
            sex: form.sex,
            age,
            heightCm: form.height_cm,
            weightKg: form.weight_kg,
            activityLevel: form.activity_level,
            goal: form.goal,
          }
        : null,
    [form, age]
  );
  const suggested = body ? suggestGoals(body) : null;

  const toggleDiet = (key: string) =>
    set(
      'dietary_preferences',
      form.dietary_preferences.includes(key)
        ? form.dietary_preferences.filter((d) => d !== key)
        : [...form.dietary_preferences, key]
    );

  const addAllergy = () => {
    const value = allergyInput.trim().toLowerCase();
    if (value && !form.allergies.includes(value)) set('allergies', [...form.allergies, value]);
    setAllergyInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (age !== null && (age < 10 || age > 110)) {
      showToast(h.invalidBirthDate, 'warning');
      return;
    }
    setSaving(true);
    try {
      await saveHealthProfile(form);
      showToast(h.saved, 'success');
    } catch (error) {
      console.error('Error saving health profile:', error);
      showToast(h.saveError, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applySuggested = async () => {
    if (!suggested) return;
    try {
      await saveGoals(suggested);
      showToast(h.goalsApplied, 'success');
    } catch {
      showToast(t.profile.goalsSaveError, 'error');
    }
  };

  const handleLogWeight = async () => {
    const value = toNum(newWeight);
    if (!value || value < 20 || value > 400) {
      showToast(h.invalidWeight, 'warning');
      return;
    }
    try {
      await logWeight(value);
      await saveHealthProfile({ weight_kg: value });
      setNewWeight('');
      showToast(h.weightLogged, 'success');
    } catch {
      showToast(h.saveError, 'error');
    }
  };

  if (loadError && !loaded) {
    return <LoadError onRetry={() => userId && fetchHealthProfile(userId)} />;
  }
  if (!loaded) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3"
      >
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-rose-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{h.title}</h3>
        </div>
        <p className="-mt-4 text-sm text-slate-500 dark:text-slate-400">{h.privacyNote}</p>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-4">
          <div>
            <label className={labelClass} htmlFor="hp-birth">{h.birthDate}</label>
            <input id="hp-birth" type="date" className={inputClass} value={form.birth_date ?? ''}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set('birth_date', e.target.value || null)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="hp-sex">{h.sex}</label>
            <select id="hp-sex" className={inputClass} value={form.sex ?? ''}
              onChange={(e) => set('sex', (e.target.value || null) as Sex | null)}>
              <option value="">—</option>
              <option value="female">{h.female}</option>
              <option value="male">{h.male}</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="hp-height">{h.height} (cm)</label>
            <input id="hp-height" type="number" inputMode="decimal" min={50} max={260} className={inputClass}
              value={form.height_cm ?? ''} onChange={(e) => set('height_cm', toNum(e.target.value))} />
          </div>
          <div>
            <label className={labelClass} htmlFor="hp-weight">{h.weight} (kg)</label>
            <input id="hp-weight" type="number" inputMode="decimal" step="0.1" min={20} max={400} className={inputClass}
              value={form.weight_kg ?? ''} onChange={(e) => set('weight_kg', toNum(e.target.value))} />
          </div>
          <div>
            <label className={labelClass} htmlFor="hp-target">{h.targetWeight} (kg)</label>
            <input id="hp-target" type="number" inputMode="decimal" step="0.1" min={20} max={400} className={inputClass}
              value={form.target_weight_kg ?? ''} onChange={(e) => set('target_weight_kg', toNum(e.target.value))} />
          </div>
          {/* O nome do nível de atividade é longo: no celular ocupa a linha inteira. */}
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="hp-activity">{h.activityLevel}</label>
            <select id="hp-activity" className={inputClass} value={form.activity_level ?? ''}
              onChange={(e) => set('activity_level', (e.target.value || null) as ActivityLevel | null)}>
              <option value="">—</option>
              {ACTIVITY.map((a) => <option key={a} value={a}>{h.activity[a]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <span className={labelClass}>{h.goal}</span>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((g) => (
              <button key={g} type="button" onClick={() => set('goal', g)} aria-pressed={form.goal === g}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium transition',
                  form.goal === g
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                )}>
                {h.goals[g]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>{t.profile.dietaryPreferences}</span>
          <div className="flex flex-wrap gap-2">
            {DIET_OPTIONS.map((d) => {
              const active = form.dietary_preferences.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggleDiet(d)} aria-pressed={active}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    active
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-emerald-400 dark:border-slate-700 dark:text-slate-300'
                  )}>
                  {h.diets[d]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="hp-allergy">{t.profile.allergies}</label>
          <div className="flex gap-2">
            <input id="hp-allergy" className={inputClass} value={allergyInput} placeholder={h.allergyPlaceholder}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }} />
            <button type="button" onClick={addAllergy}
              className="rounded-lg border border-slate-200 px-3 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={t.common.add}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {form.allergies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.allergies.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                  {a}
                  <button type="button" onClick={() => set('allergies', form.allergies.filter((x) => x !== a))} aria-label={`${t.common.remove} ${a}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{h.allergyHint}</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="hp-notes">{h.notes}</label>
          <textarea id="hp-notes" rows={3} className={inputClass} value={form.notes} maxLength={1000}
            placeholder={h.notesPlaceholder} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <button type="submit" disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.common.save}
        </button>
      </form>

      <div className="space-y-6 lg:col-span-2">
        {/* Indicadores calculados */}
        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{h.indicators}</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{h.bmi}</dt>
              <dd className="text-lg font-bold text-slate-900 dark:text-white">{currentBmi ?? '—'}</dd>
              {currentBmi && <dd className="text-xs text-slate-500 dark:text-slate-400">{h.bmiRanges[bmiRange(currentBmi)]}</dd>}
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{h.tdee}</dt>
              <dd className="text-lg font-bold text-slate-900 dark:text-white">{body ? `${Math.round(tdee(body))}` : '—'}</dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">kcal/{h.day}</dd>
            </div>
          </dl>

          {suggested ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" /> {h.suggestedGoals}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {suggested.calories} kcal • {t.profile.nutritionGoalsnames.protein} {suggested.protein} g •{' '}
                {t.profile.nutritionGoalsnames.carbs} {suggested.carbs} g • {t.profile.nutritionGoalsnames.fat} {suggested.fat} g •{' '}
                {t.profile.nutritionGoalsnames.fiber} {suggested.fiber} g
              </p>
              <button type="button" onClick={applySuggested}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                {h.applyGoals}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">{h.fillToCalculate}</p>
          )}
          <p className="text-xs text-slate-400">{h.disclaimer}</p>
        </section>

        {/* Peso */}
        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Scale className="h-4 w-4 text-sky-500" /> {h.weightHistory}
          </h3>
          <WeightChart logs={weightLogs} target={form.target_weight_kg} />
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" step="0.1" className={inputClass} placeholder={`${h.weight} (kg)`}
              value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
            <button type="button" onClick={handleLogWeight}
              className="whitespace-nowrap rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
              {h.logToday}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
