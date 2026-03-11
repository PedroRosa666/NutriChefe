import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Sparkles, Bot, MessageCircle, Star, Zap, ArrowRight, Shield } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getSubscriptionPlans, startCheckout } from '../../services/subscription';
import type { SubscriptionPlan } from '../../types/subscription';
import { useToastStore } from '../../store/toast';
import { supabase } from '../../lib/supabase';

const FALLBACK_STRIPE_PRICE_ID = 'price_1S8hUJRvfweGXYGcPyJ9VAR9';
const FALLBACK_DISPLAY_PRICE = 19.90;

export function PremiumUpgrade() {
  const t = useTranslation();
  const { showToast } = useToastStore();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) =>
      setUser(data.user ? { id: data.user.id } : null)
    );
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
    });
    return () => {
      // @ts-ignore
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    getSubscriptionPlans()
      .then((ps) => setPlans(ps || []))
      .catch((e) => {
        console.error(e);
        showToast(t.premium.loadPlansError);
      });
  }, [showToast, t.premium.loadPlansError]);

  const primaryPlan = useMemo(
    () => plans.find((p) => (p as any).stripe_price_id) ?? plans[0] ?? null,
    [plans]
  );

  const priceNumber =
    primaryPlan && typeof primaryPlan.price === 'number' && primaryPlan.price > 0
      ? primaryPlan.price
      : FALLBACK_DISPLAY_PRICE;

  const priceBRL = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(priceNumber);

  const billing = primaryPlan?.billing_period || 'monthly';

  const features = [
    {
      icon: <Bot className="w-5 h-5" />,
      title: t.premium.features.mentoringUnlimitedTitle,
      description: t.premium.features.mentoringUnlimitedDescription,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: t.premium.features.personalizedConsultationsTitle,
      description: t.premium.features.personalizedConsultationsDescription,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: t.premium.features.smartRecommendationsTitle,
      description: t.premium.features.smartRecommendationsDescription,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: t.premium.features.prioritySupportTitle,
      description: t.premium.features.prioritySupportDescription,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
  ];

  const benefits = [
    t.premium.benefits.accessNutritionists,
    t.premium.benefits.whatsappDirect,
    t.premium.benefits.personalizedGoals,
    t.premium.benefits.mealPlans,
    t.premium.benefits.weeklyFollowup,
    t.premium.benefits.progressReports,
    t.premium.benefits.premiumRecipes,
    t.premium.benefits.vipCommunity,
  ];

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      if (!user) {
        showToast(t.premium.loginRequired);
        window.location.href = '/login';
        return;
      }
      const priceIdToUse = (primaryPlan as any)?.stripe_price_id || FALLBACK_STRIPE_PRICE_ID;
      await startCheckout({ planId: primaryPlan?.id, priceId: priceIdToUse });
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || t.premium.checkoutErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 border border-gray-700/50 mb-6">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative px-8 py-10 text-center">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  className="absolute -top-1.5 -right-1.5"
                >
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </motion.div>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
              {t.premium.title}
            </h1>
            <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
              {t.premium.descriptionPrefix}
              <span className="font-semibold text-emerald-400">{t.premium.planName}</span>
              {t.premium.descriptionSuffix}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              O que está incluído
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {benefits.map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/60 p-6 flex flex-col">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t.premium.planName}
                </span>
              </div>
              <div className="mt-3 mb-1">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">{priceBRL}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                / {billing === 'monthly' ? t.premium.perMonthLabel : billing}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.premium.ctaLoading}
                </span>
              ) : (
                <>
                  {t.premium.ctaSubscribe}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>

            <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
              {t.premium.footerNote}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.07 }}
              className="flex items-start gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/60"
            >
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${feature.bg}`}>
                <span className={feature.color}>{feature.icon}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
