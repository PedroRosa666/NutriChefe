import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, Bot, Check, ChefHat, ChevronDown, Crown, Flame, HelpCircle, Lock,
  MessageCircle, Search, ShieldCheck, Sparkles, User, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { getSubscriptionPlans, startCheckout } from '../../services/subscription';
import type { SubscriptionPlan } from '../../types/subscription';
import { useToastStore } from '../../store/toast';
import { useAuthStore } from '../../store/auth';
import { EASE_OUT, SMOOTH } from '../../lib/motion';
import { cn } from '../../lib/utils';

const FALLBACK_STRIPE_PRICE_ID = 'price_1S8hUJRvfweGXYGcPyJ9VAR9';
const FALLBACK_DISPLAY_PRICE = 19.9;

// Seções entram suavemente quando aparecem na tela (uma vez só).
const reveal = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: SMOOTH,
};

export function PremiumUpgrade() {
  const t = useTranslation();
  const p = t.premium;
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    getSubscriptionPlans()
      .then((ps) => setPlans(ps || []))
      .catch((e) => {
        console.error(e);
        showToast(p.loadPlansError, 'error');
      });
  }, [showToast, p.loadPlansError]);

  // Plano pago com IA; evita cair no plano gratuito (o primeiro, ordenado por preço) e no do nutricionista.
  const primaryPlan = useMemo(
    () =>
      plans.filter((pl) => !pl.features?.includes('nutritionist_pro')).find((pl) => pl.stripe_price_id && pl.features?.includes('ai_mentoring')) ??
      plans.find((pl) => pl.stripe_price_id && !pl.features?.includes('nutritionist_pro')) ??
      plans.find((pl) => pl.price > 0 && !pl.features?.includes('nutritionist_pro')) ??
      null,
    [plans]
  );

  const priceNumber = primaryPlan && primaryPlan.price > 0 ? primaryPlan.price : FALLBACK_DISPLAY_PRICE;
  const [priceWhole, priceCents] = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 })
    .format(priceNumber)
    .split(',');

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      showToast(p.loginRequired, 'info');
      navigate('/login');
      return;
    }
    try {
      setLoading(true);
      await startCheckout({
        planId: primaryPlan?.id,
        priceId: primaryPlan?.stripe_price_id || FALLBACK_STRIPE_PRICE_ID,
      });
    } catch (e) {
      console.error(e);
      showToast(e instanceof Error && e.message ? e.message : p.checkoutErrorGeneric, 'error');
    } finally {
      setLoading(false);
    }
  };

  const cta = (size: 'lg' | 'md' = 'lg') => (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleSubscribe}
      disabled={loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'lg' ? 'w-full px-6 py-3.5 text-base sm:w-auto' : 'px-5 py-3 text-sm'
      )}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {p.ctaLoading}
        </>
      ) : (
        <>
          {p.ctaSubscribe}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </motion.button>
  );

  const features = [
    { icon: Search, title: p.features.ingredientTitle, text: p.features.ingredientDescription, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' },
    { icon: User, title: p.features.personalTitle, text: p.features.personalDescription, tone: 'text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10' },
    { icon: Sparkles, title: p.features.beyondTitle, text: p.features.beyondDescription, tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10' },
    { icon: MessageCircle, title: p.features.questionsTitle, text: p.features.questionsDescription, tone: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10' },
  ];

  const compare: { label: string; free: boolean }[] = [
    { label: p.compareRows.recipes, free: true },
    { label: p.compareRows.diary, free: true },
    { label: p.compareRows.health, free: true },
    { label: p.compareRows.nutritionists, free: true },
    { label: p.compareRows.ai, free: false },
    { label: p.compareRows.personal, free: false },
  ];

  const yes = <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="✓" />;
  const no = <X className="mx-auto h-4 w-4 text-gray-300 dark:text-gray-600" aria-label="—" />;

  return (
    <div className="mx-auto max-w-5xl space-y-14 pb-6">
      {/* Hero: proposta + preço à esquerda, exemplo real de uso à direita */}
      <section className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            {p.badge}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {p.title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300">{p.subtitle}</p>

          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-start text-gray-900 dark:text-white">
                <span className="mt-1.5 text-base font-semibold">R$</span>
                <span className="text-5xl font-bold tracking-tight">{priceWhole}</span>
                <span className="mt-1.5 text-lg font-semibold">,{priceCents}</span>
                <span className="ml-1 self-end pb-1.5 text-sm text-gray-500 dark:text-gray-400">/{p.perMonthLabel}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{p.priceNote}</p>
            </div>
            {cta('lg')}
          </div>

          <p className="mt-5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {p.trust}
          </p>
        </div>

        <ChatDemo labels={p.demo} />
      </section>

      {/* O que você ganha */}
      <motion.section {...reveal}>
        <h2 className="mb-5 text-xl font-bold text-gray-900 dark:text-white">{p.featuresTitle}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text, tone }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...SMOOTH, delay: i * 0.06 }}
              className="group rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-lg hover:shadow-gray-900/5 dark:border-gray-700 dark:bg-slate-900"
            >
              <div className={cn('mb-3 inline-flex rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-105', tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{text}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Gratuito x Premium: mostra com honestidade o que já é grátis */}
      <motion.section {...reveal}>
        <h2 className="mb-5 text-xl font-bold text-gray-900 dark:text-white">{p.compareTitle}</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-5 py-3 text-left font-medium text-gray-500 dark:text-gray-400" />
                <th className="w-24 px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-300 sm:w-32">{p.compareFree}</th>
                <th className="w-24 bg-emerald-50/70 px-3 py-3 text-center font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 sm:w-32">
                  <span className="inline-flex items-center gap-1"><Crown className="h-3.5 w-3.5" />{p.comparePremium}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {compare.map((row) => (
                <tr key={row.label} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-200">
                    <span className="inline-flex items-center gap-2">
                      {!row.free && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                      {row.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">{row.free ? yes : no}</td>
                  <td className="bg-emerald-50/70 px-3 py-3 dark:bg-emerald-500/10">{yes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Perguntas frequentes */}
      <motion.section {...reveal}>
        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
          <HelpCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {p.faqTitle}
        </h2>
        <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-slate-900">
          {p.faq.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-gray-900 transition-colors hover:bg-gray-50 dark:text-white dark:hover:bg-slate-800"
                >
                  {item.q}
                  <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-300', open && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Chamada final */}
      <motion.section
        {...reveal}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-10 text-center text-white shadow-xl shadow-emerald-600/20 sm:px-10"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-amber-300/20 blur-2xl" />
        <div className="relative">
          <h2 className="text-2xl font-bold">{p.finalTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-emerald-50/90">{p.finalSubtitle}</p>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubscribe}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-emerald-700 shadow-lg transition-colors hover:bg-emerald-50 disabled:opacity-60"
          >
            {loading ? p.ctaLoading : p.ctaSubscribe}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
          <p className="mt-3 text-xs text-emerald-50/80">
            R$ {priceWhole},{priceCents}/{p.perMonthLabel} • {p.priceNote}
          </p>
        </div>
      </motion.section>
    </div>
  );
}

/** Conversa de exemplo animada: mostra o que a Mentoria IA faz, sem chamar a IA. */
function ChatDemo({ labels }: { labels: { label: string; question: string; answer: string; recipeTitle: string; recipeMeta: string; contains: string } }) {
  const step = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...SMOOTH, delay },
  });

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-400/20 via-teal-300/10 to-amber-300/20 blur-2xl dark:from-emerald-500/20 dark:to-sky-500/10" />
      <div className="relative rounded-3xl border border-gray-200 bg-white p-5 shadow-xl shadow-gray-900/5 dark:border-gray-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">NutriBot</span>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-slate-800 dark:text-gray-400">
            {labels.label}
          </span>
        </div>

        <motion.div {...step(0.2)} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-sm text-white">
          {labels.question}
        </motion.div>

        <motion.div {...step(0.7)} className="mt-3 max-w-[92%] rounded-2xl rounded-tl-sm border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-100">
          <p className="mb-2.5">{labels.answer}</p>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-slate-900">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-amber-400">
              <ChefHat className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900 dark:text-white">{labels.recipeTitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Check className="h-3 w-3" />
                  {labels.contains}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {labels.recipeMeta}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
