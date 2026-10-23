import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Crown, FileText, HeartPulse, Loader2, Save, Sparkles, Target, UserMinus, Utensils, CalendarRange, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { endLink, getPatientData, setPatientGoals, type CareLink, type PatientData } from '../../services/care';
import { sumEntries, toISODate } from '../../store/nutrition-tracking';
import { DEFAULT_GOALS, GOAL_KEYS, type NutritionGoals } from '../../store/nutrition-goals';
import { ageFromBirthDate, bmi, suggestGoals } from '../../lib/nutrition-calculator';
import { WeightChart } from '../profile/WeightChart';
import { WeeklyCaloriesChart } from '../nutrition/WeeklyCaloriesChart';
import { PlansSection } from '../plans/PlansSection';
import { SwapRequestsList } from '../swaps/SwapRequestsList';
import { AdherencePanel } from './AdherencePanel';
import { ChatThread } from './ChatThread';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { LoadError } from '../common/LoadError';
import { Avatar } from './Avatar';
import { fmtNum, appLocale } from '../../lib/format';
import { confirmDialog } from '../../store/confirm';
import { AppointmentsSection } from './Appointments';
import { PatientReportView } from './PatientReportView';
import { usePremiumStore } from '../../store/premium';
import { loadAdherence, type AdherenceResult } from '../../services/adherence';
import { getMyCrnStatus } from '../../services/verification';
import { useNavigate } from 'react-router-dom';

interface PatientDetailProps {
  link: CareLink;
  onBack: () => void;
  /** Abre já com a conversa aberta (link de um aviso de mensagem). */
  openChat?: boolean;
  onEnded: () => void;
}

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const fmt = (n: number, digits = 0) => n.toLocaleString(appLocale(), { maximumFractionDigits: digits });

export function PatientDetail({ link, onBack, onEnded, openChat = false }: PatientDetailProps) {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();
  const patientId = link.person.id;
  const [chatOpen, setChatOpen] = useState(openChat);
  const nutritionistPro = usePremiumStore((s) => s.nutritionistPro);
  const navigate = useNavigate();
  const [report, setReport] = useState<{ adherence: AdherenceResult | null; crn: string | null } | null>(null);
  const [preparingReport, setPreparingReport] = useState(false);
  const closeReport = useCallback(() => setReport(null), []);

  const openReport = async () => {
    if (!nutritionistPro) {
      navigate('/mentoria-ia');
      return;
    }
    if (!user || !data) return;
    setPreparingReport(true);
    try {
      const [adherence, crn] = await Promise.all([
        loadAdherence(patientId, user.id).catch(() => null),
        getMyCrnStatus(user.id).catch(() => null),
      ]);
      setReport({ adherence, crn: crn?.number ? `CRN-${crn.region} ${crn.number}` : null });
    } finally {
      setPreparingReport(false);
    }
  };

  const [data, setData] = useState<PatientData | null>(null);
  const [failed, setFailed] = useState(false);
  const [goalsForm, setGoalsForm] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [saving, setSaving] = useState(false);
  const [plansKey, setPlansKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const d = await getPatientData(patientId, 30);
      setData(d);
      if (d.goals) {
        const { calories, protein, carbs, fat, fiber } = d.goals;
        setGoalsForm({ calories, protein, carbs, fat, fiber });
      }
    } catch (error) {
      console.error('Error loading patient:', error);
      setFailed(true);
    }
  }, [patientId, showToast, t.care.errors.unknown]);

  useEffect(() => {
    load();
  }, [load]);

  const week = useMemo(() => {
    if (!data) return null;
    const since = new Date();
    since.setDate(since.getDate() - 6);
    const min = toISODate(since);
    const recent = data.entries.filter((e) => e.date >= min);
    const days = new Set(recent.map((e) => e.date)).size;
    const totals = sumEntries(recent);
    const avg = (n: number) => (days ? n / days : 0);
    return {
      days,
      calories: avg(totals.calories),
      protein: avg(totals.protein),
      carbs: avg(totals.carbs),
      fat: avg(totals.fat),
      fiber: avg(totals.fiber),
    };
  }, [data]);

  if (failed && !data) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          ← {t.common.back}
        </button>
        <LoadError onRetry={load} />
      </div>
    );
  }

  if (!data || !week) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const h = data.health;
  const age = ageFromBirthDate(h?.birth_date ?? null);
  const currentBmi = h?.height_cm && h?.weight_kg ? bmi(h.height_cm, h.weight_kg) : null;
  const body =
    h?.sex && age && h.height_cm && h.weight_kg && h.activity_level && h.goal
      ? { sex: h.sex, age, heightCm: h.height_cm, weightKg: h.weight_kg, activityLevel: h.activity_level, goal: h.goal }
      : null;
  const goalLabels = t.profile.nutritionGoalsnames;

  const end = async () => {
    if (!(await confirmDialog(t.care.endLinkConfirmNutritionist))) return;
    try {
      await endLink(link.id);
      showToast(t.care.linkEnded, 'info');
      onEnded();
    } catch (error) {
      console.error('Error ending link:', error);
      showToast(t.care.errors.unknown, 'error');
    }
  };

  const saveGoals = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setPatientGoals(patientId, user.id, goalsForm, data.goals?.active_goals?.length ? data.goals.active_goals : GOAL_KEYS);
      showToast(t.care.goalsSaved, 'success');
      load();
    } catch (error) {
      console.error('Error saving patient goals:', error);
      showToast(t.care.errors.unknown, 'error');
    } finally {
      setSaving(false);
    }
  };

  const info = (label: string, value: ReactNode) => (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{value || '—'}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.care.back}
      </button>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={link.person.full_name} url={link.person.avatar_url} className="h-14 w-14 text-lg" />
        {/* basis-48: sem espaço para nome e botão juntos, o botão desce para a linha de baixo. */}
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">{link.person.full_name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.care.since} {new Date(link.created_at).toLocaleDateString(appLocale())}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setChatOpen((v) => !v)}
          aria-expanded={chatOpen}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${chatOpen ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300'}`}
        >
          <MessageCircle className="h-4 w-4" />
          {t.messages.title}
        </button>
        <button
          type="button"
          onClick={openReport}
          disabled={preparingReport || !data}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {preparingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : nutritionistPro ? <FileText className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
          {t.patientReport.button}
        </button>
        <button
          type="button"
          onClick={end}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/20"
        >
          <UserMinus className="h-4 w-4" />
          {t.care.endLink}
        </button>
      </div>

      {report && data && user && (
        <PatientReportView
          patientName={link.person.full_name ?? ''}
          data={data}
          adherence={report.adherence}
          nutritionistName={user.name}
          crn={report.crn}
          contact={user.email}
          onDone={closeReport}
        />
      )}

      {chatOpen && user && <ChatThread nutritionistId={user.id} clientId={patientId} otherName={link.person.full_name ?? ''} />}

      <AppointmentsSection clientId={patientId} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={card}>
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <HeartPulse className="h-5 w-5 text-sky-500" />
            {t.care.health}
          </h3>
          {!h ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.care.noHealth}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {info(t.care.age, age ? `${age} ${t.care.years}` : null)}
                {info(t.health.sex, h.sex ? t.health[h.sex] : null)}
                {info(t.health.height, h.height_cm ? `${h.height_cm} cm` : null)}
                {info(t.health.currentWeight, h.weight_kg ? `${h.weight_kg} kg` : null)}
                {info(t.health.targetWeight, h.target_weight_kg ? `${h.target_weight_kg} kg` : null)}
                {info(t.health.bmi, currentBmi)}
                {info(t.health.goal, h.goal ? t.health.goals[h.goal] : null)}
                {info(t.health.activityLevel, h.activity_level ? t.health.activity[h.activity_level] : null)}
              </div>
              {info(t.care.allergies, h.allergies?.length ? h.allergies.join(', ') : t.care.none)}
              {info(
                t.care.preferences,
                h.dietary_preferences?.length
                  ? h.dietary_preferences.map((p) => t.health.diets[p as keyof typeof t.health.diets] ?? p).join(', ')
                  : t.care.none
              )}
              {h.notes && info(t.health.notes, h.notes)}
            </div>
          )}
        </section>

        <section className={card}>
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t.health.weightHistory}</h3>
          <WeightChart logs={data.weights} target={h?.target_weight_kg ?? null} />
        </section>
      </div>

      <section className={card}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Utensils className="h-5 w-5 text-amber-500" />
            {t.care.intake7}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {week.days} {t.care.daysLogged7}
          </p>
        </div>
        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t.care.avgPerDay}</p>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {GOAL_KEYS.map((key) => {
            const goal = data.goals?.[key] ?? 0;
            const value = week[key];
            const pct = goal ? Math.round((value / goal) * 100) : null;
            return (
              <div key={key} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">{goalLabels[key]}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {fmt(value, key === 'calories' ? 0 : 1)}
                  <span className="ml-1 text-xs font-medium text-slate-500">{key === 'calories' ? 'kcal' : 'g'}</span>
                </p>
                {pct !== null && (
                  <p className={`text-xs font-semibold ${pct > 110 ? 'text-rose-500' : pct >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {pct}% {t.report.vsGoal}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <WeeklyCaloriesChart entries={data.entries} goal={data.goals?.calories ?? DEFAULT_GOALS.calories} />

        <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-900 dark:text-white">{t.care.recentEntries}</h4>
        {!data.entries.length ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.care.noEntries}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.entries.slice(0, 12).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-slate-800 dark:text-slate-100">
                  <span className="mr-2 text-xs text-slate-400">{new Date(`${e.date}T12:00:00`).toLocaleDateString(appLocale(), { day: '2-digit', month: '2-digit' })}</span>
                  {e.recipeTitle}
                  {e.servings !== 1 && <span className="text-slate-400"> ×{fmtNum(e.servings)}</span>}
                </span>
                <span className="flex-shrink-0 font-medium text-slate-600 dark:text-slate-300">
                  {fmt(e.perServing.calories * e.servings)} kcal
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Target className="h-5 w-5 text-emerald-500" />
            {t.care.goalsTitle}
          </h3>
          <button
            type="button"
            onClick={() => (body ? setGoalsForm(suggestGoals(body)) : showToast(t.care.needProfile, 'warning'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.care.calculate}
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t.care.goalsHint}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {GOAL_KEYS.map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {goalLabels[key]} ({key === 'calories' ? 'kcal' : 'g'})
              </span>
              <input
                type="number"
                min={0}
                value={goalsForm[key]}
                onChange={(e) => setGoalsForm((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={saveGoals}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t.care.saveGoals}
          </button>
        </div>
      </section>

      <AdherencePanel clientId={patientId} reloadKey={plansKey} />

      {/* Pedidos de troca: a resposta pode mudar o plano, que então recarrega. */}
      <SwapRequestsList
        clientId={patientId}
        role="nutritionist"
        allergies={h?.allergies ?? []}
        onPlanChanged={() => setPlansKey((k) => k + 1)}
      />

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <CalendarRange className="h-5 w-5 text-emerald-500" />
          {t.care.plansTitle}
        </h3>
        <PlansSection
          clientId={patientId}
          mode="nutritionist"
          dailyCalories={data.goals?.calories ?? goalsForm.calories}
          allergies={h?.allergies ?? []}
          preferences={h?.dietary_preferences ?? []}
          reloadKey={plansKey}
          patientName={link.person.full_name ?? ''}
        />
      </section>
    </div>
  );
}
