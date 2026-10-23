import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bot, Check, Crown, FileText, Sparkles, Star, Users } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getSubscriptionPlans, startCheckout } from '../../services/subscription';
import type { SubscriptionPlan } from '../../types/subscription';
import { useToastStore } from '../../store/toast';

/** Página de venda do Premium Nutricionista (plano com o recurso `nutritionist_pro`). */
export function NutritionistPremium() {
  const t = useTranslation();
  const n = t.nutritionistPremium;
  const { showToast } = useToastStore();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubscriptionPlans()
      .then((ps) => setPlans(ps || []))
      .catch(() => showToast(t.premium.loadPlansError, 'error'));
  }, [showToast, t.premium.loadPlansError]);

  const plan = useMemo(() => plans.find((pl) => pl.features?.includes('nutritionist_pro')) ?? null, [plans]);
  const available = Boolean(plan?.stripe_price_id);

  const subscribe = async () => {
    if (!plan || !available) return;
    setLoading(true);
    try {
      await startCheckout({ planId: plan.id });
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : t.premium.checkoutErrorGeneric, 'error');
      setLoading(false);
    }
  };

  const features = [
    { icon: Sparkles, title: n.f1Title, text: n.f1Text },
    { icon: Bot, title: n.f2Title, text: n.f2Text },
    { icon: FileText, title: n.f3Title, text: n.f3Text },
    { icon: Users, title: n.f4Title, text: n.f4Text },
    { icon: BarChart3, title: n.f5Title, text: n.f5Text },
    { icon: Star, title: n.f6Title, text: n.f6Text },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-lg sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          <Crown className="h-3.5 w-3.5" />
          {n.badge}
        </span>
        <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">{n.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-50 sm:text-base">{n.subtitle}</p>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          {plan && (
            <p className="text-3xl font-extrabold">
              R$ {Number(plan.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              <span className="ml-1 text-sm font-medium text-emerald-100">/{t.premium.perMonthLabel}</span>
            </p>
          )}
          <button
            type="button"
            onClick={subscribe}
            disabled={!available || loading}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 shadow hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {available ? (loading ? t.common.loading : n.subscribe) : n.soon}
          </button>
        </div>
        <p className="mt-3 text-xs text-emerald-100">{n.freeNote}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="font-semibold text-slate-900 dark:text-white">{n.compareTitle}</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {n.compare.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
