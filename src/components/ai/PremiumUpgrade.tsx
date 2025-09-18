import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Sparkles, Bot, MessageCircle, Star, Zap } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getSubscriptionPlans, startCheckout } from '../../services/subscription';
import type { SubscriptionPlan } from '../../types/subscription';
import { useToastStore } from '../../store/toast';

export function PremiumUpgrade() {
  const t = useTranslation();
  const { showToast } = useToastStore();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSubscriptionPlans().then((ps) => setPlans(ps || [])).catch((e) => {
      console.error(e);
      showToast({ title: 'Erro ao carregar planos', description: String(e), type: 'error' });
    });
  }, [showToast]);

  const primaryPlan = useMemo(() => plans?.[0], [plans]);

  const features = [
    { icon: <Bot className="w-5 h-5" />, title: 'Mentoria IA Ilimitada', description: 'Chat 24/7 com IA especializada em nutrição' },
    { icon: <MessageCircle className="w-5 h-5" />, title: 'Acompanhamento Inteligente', description: 'Feedback contínuo e recomendações personalizadas' },
    { icon: <Star className="w-5 h-5" />, title: 'Receitas Premium', description: 'Acesso a receitas exclusivas com macros' },
    { icon: <Zap className="w-5 h-5" />, title: 'Atualizações Prioritárias', description: 'Novos recursos liberados primeiro' }
  ];

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      if (!primaryPlan) throw new Error('Nenhum plano ativo encontrado');
      if (!primaryPlan.stripe_price_id) throw new Error('Plano não possui stripe_price_id configurado');
      await startCheckout({ planId: primaryPlan.id, priceId: primaryPlan.stripe_price_id });
    } catch (e: any) {
      console.error(e);
      showToast({ title: 'Não foi possível iniciar o checkout', description: String(e?.message || e), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = primaryPlan ? Number(primaryPlan.price).toFixed(2) : '—';
  const billing = primaryPlan?.billing_period || 'monthly';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 mb-6">
          <Sparkles className="w-4 h-4" />
          <span>Desbloqueie o melhor do NutriChef</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
          Torne-se <span className="text-purple-600 dark:text-purple-400">Premium</span>
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
          Acesse mentoria por IA, conteúdo exclusivo e novidades primeiro.
        </p>

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 text-left">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" /> Plano Premium
            </h3>

            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                R$ {displayPrice}
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">/ {billing === 'monthly' ? 'mês' : billing}</span>
            </div>

            <ul className="space-y-3 mb-6 text-left max-w-md mx-auto">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{f.title}</span>
                </li>
              ))}
            </ul>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubscribe}
              disabled={loading || !primaryPlan}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium shadow hover:brightness-110 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              {loading ? 'Iniciando...' : 'Assinar Plano Premium'}
            </motion.button>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
            <h3 className="text-lg font-semibold mb-4">Tudo que você recebe</h3>
            <div className="grid gap-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200">
                    {f.icon}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{f.title}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{f.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
          Cancele a qualquer momento • Sem compromisso • Suporte 24/7
        </p>
      </motion.div>
    </div>
  );
}
