import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Sparkles, Bot, MessageCircle, Star, Zap } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getSubscriptionPlans, startCheckout } from '../../services/subscription';
import type { SubscriptionPlan } from '../../types/subscription';
import { useToastStore } from '../../store/toast';

/** Fallbacks para não travar o fluxo enquanto ajusta o banco */
const FALLBACK_STRIPE_PRICE_ID = 'price_1S8hUJRvfweGXYGcPyJ9VAR9';
const FALLBACK_DISPLAY_PRICE = 19.90;

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 80, damping: 18 }
  }
};

const listVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
};

export function PremiumUpgrade() {
  const t = useTranslation();
  const { showToast } = useToastStore();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubscriptionPlans()
      .then((ps) => setPlans(ps || []))
      .catch((e) => {
        console.error(e);
        // Toast do seu projeto espera string
        showToast('Erro ao carregar planos');
      });
  }, [showToast]);

  // Prefira um plano que tenha stripe_price_id; se não houver, pegue o primeiro mesmo.
  const primaryPlan = useMemo(
    () => (plans.find((p) => (p as any).stripe_price_id) ?? plans[0] ?? null),
    [plans]
  );

  const features = [
    { icon: <Bot className="w-5 h-5" />, title: 'Mentoria IA Ilimitada', description: 'Chat 24/7 com IA especializada em nutrição' },
    { icon: <MessageCircle className="w-5 h-5" />, title: 'Acompanhamento Inteligente', description: 'Feedback contínuo e recomendações personalizadas' },
    { icon: <Star className="w-5 h-5" />, title: 'Receitas Premium', description: 'Acesso a receitas exclusivas com macros' },
    { icon: <Zap className="w-5 h-5" />, title: 'Atualizações Prioritárias', description: 'Novos recursos liberados primeiro' }
  ];

  const handleSubscribe = async () => {
    try {
      setLoading(true);

      // Sem plano? Abre direto com o priceId fallback.
      if (!primaryPlan) {
        await startCheckout({ priceId: FALLBACK_STRIPE_PRICE_ID });
        return;
      }

      // Usa o price do plano se existir; senão, faz fallback
      const priceIdToUse = (primaryPlan as any).stripe_price_id || FALLBACK_STRIPE_PRICE_ID;

      await startCheckout({
        planId: primaryPlan.id,  // ajuda o backend a vincular com seu plano quando houver
        priceId: priceIdToUse,
      });
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Não foi possível iniciar o checkout');
    } finally {
      setLoading(false);
    }
  };

  // Formatação bonita BRL + fallback 19,90 se banco vier 0/undefined
  const priceNumber =
    primaryPlan && typeof primaryPlan.price === 'number' && primaryPlan.price > 0
      ? primaryPlan.price
      : FALLBACK_DISPLAY_PRICE;

  const priceBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceNumber);
  const billing = primaryPlan?.billing_period || 'monthly';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 relative">
      {/* Glow de fundo sutil para manter o “wow” */}
      <div className="pointer-events-none absolute inset-0 blur-3xl opacity-30 dark:opacity-20"
           style={{ background: 'radial-gradient(600px 200px at 50% 10%, rgba(147,51,234,.35), transparent 60%)' }} />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-4xl text-center"
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 mb-6"
          whileHover={{ scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12 }}
        >
          <Sparkles className="w-4 h-4" />
          <span>Desbloqueie o melhor do NutriChef</span>
        </motion.div>

        <h1 className="text-3xl md:text-4xl font-extrabold mb-3 text-gray-900 dark:text-white tracking-tight">
          Torne-se <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-400">Premium</span>
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
          Acesse mentoria por IA, conteúdo exclusivo e novidades primeiro.
        </p>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* Card principal com borda e leve brilho */}
          <motion.div
            className="rounded-2xl border border-purple-100 dark:border-purple-900/40 p-6 md:p-8 text-left bg-white/70 dark:bg-white/5 backdrop-blur"
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 250, damping: 18 }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Crown className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Plano Premium
              </h2>
            </div>

            <div className="text-center mb-6">
              <span className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-400">
                {priceBRL}
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">/ {billing === 'monthly' ? 'mês' : billing}</span>
            </div>

            <motion.ul
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="space-y-3 mb-6 text-left max-w-md mx-auto"
            >
              {features.map((f, i) => (
                <motion.li key={i} variants={itemVariants} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="text-gray-700 dark:text-gray-300">
                    <div className="font-medium">{f.title}</div>
                    <div className="text-sm opacity-80">{f.description}</div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-white shadow-lg transition-all disabled:opacity-50
                         bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-600/90 hover:to-purple-700/90"
            >
              <span className="inline-flex items-center gap-2">
                <Crown className="w-5 h-5" />
                {loading ? 'Iniciando...' : 'Assinar Plano Premium'}
              </span>
            </motion.button>
          </motion.div>

          {/* Card secundário — mantém visual e animação suave */}
          <motion.div
            className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 bg-white/60 dark:bg-white/5 backdrop-blur"
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 250, damping: 18 }}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Tudo que você recebe</h3>
            <motion.div variants={listVariants} initial="hidden" animate="show" className="grid gap-3">
              {features.map((f, i) => (
                <motion.div key={i} variants={itemVariants} className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200">
                    {f.icon}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{f.title}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{f.description}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
          Cancele a qualquer momento • Sem compromisso • Suporte 24/7
        </p>
      </motion.div>
    </div>
  );
}
