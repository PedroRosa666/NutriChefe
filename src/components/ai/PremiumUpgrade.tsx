import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, Sparkles, Bot, MessageCircle, Star, Zap } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getSubscriptionPlans, startCheckout } from '../../services/subscription';
import type { SubscriptionPlan } from '../../types/subscription';
import { useToastStore } from '../../store/toast';
import { supabase } from '../../lib/supabase';



const [user, setUser] = useState<{ id: string } | null>(null);

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ? { id: session.user.id } : null);
  });
  return () => { sub?.subscription?.unsubscribe?.(); };
}, []);


/** Fallbacks para não travar o fluxo enquanto ajusta o banco */
const FALLBACK_STRIPE_PRICE_ID = 'price_1S8hUJRvfweGXYGcPyJ9VAR9';
const FALLBACK_DISPLAY_PRICE = 19.90;

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
        // seu Toast espera string — evite passar objeto
        showToast('Erro ao carregar planos');
      });
  }, [showToast]);

  // Prefere um plano que tenha stripe_price_id; senão, pega o primeiro mesmo
  const primaryPlan = useMemo(
    () => (plans.find((p) => (p as any).stripe_price_id) ?? plans[0] ?? null),
    [plans]
  );

  // Formatação de preço (BRL) com fallback 19,90 se vier 0/undefined
  const priceNumber =
    primaryPlan && typeof primaryPlan.price === 'number' && primaryPlan.price > 0
      ? primaryPlan.price
      : FALLBACK_DISPLAY_PRICE;
  const priceBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceNumber);
  const billing = primaryPlan?.billing_period || 'monthly';

  const handleSubscribe = async () => {
    try {
      setLoading(true);

      // Se não há plano ou não há stripe_price_id, cai no fallback para abrir o checkout
      const priceIdToUse = (primaryPlan as any)?.stripe_price_id || FALLBACK_STRIPE_PRICE_ID;

      await startCheckout({
        planId: primaryPlan?.id,  // ajuda o backend a mapear quando existir
        priceId: priceIdToUse,
      });
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Não foi possível iniciar o checkout');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Bot className="w-5 h-5" />,
      title: 'Mentoria IA Ilimitada',
      description: 'Chat 24/7 com IA especializada em nutrição'
    },
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: 'Consultas Personalizadas',
      description: 'IA configurada pelo seu nutricionista'
    },
    {
      icon: <Star className="w-5 h-5" />,
      title: 'Recomendações Inteligentes',
      description: 'Sugestões de receitas baseadas no seu perfil'
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Suporte Prioritário',
      description: 'Atendimento rápido e especializado'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-8 text-center border border-purple-200 dark:border-purple-700"
      >
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full">
              <Crown className="w-12 h-12 text-white" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </motion.div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Desbloqueie a Mentoria IA
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Para ter acesso ilimitado à nossa Mentoria IA e outras funcionalidades exclusivas, 
          assine o nosso <span className="font-semibold text-purple-600 dark:text-purple-400">Plano Premium</span>!
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
            >
              <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white">
                {feature.icon}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-8 border border-purple-200 dark:border-purple-700">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Plano Premium
            </h2>
          </div>
          
{/* Preço */}
<div className="text-center mb-6">
  <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">
    {priceBRL}
  </span>
  <span className="text-gray-600 dark:text-gray-400 ml-2">
    / {billing === 'monthly' ? 'mês' : billing}
  </span>
</div>

{/* Benefícios — 8 itens (4 de cada lado, alinhados no topo) */}
<div className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-white/70 dark:bg-white/5 backdrop-blur p-4 md:p-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
    {/* Coluna esquerda */}
    <ul className="space-y-3">
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          Acesso a <span className="font-medium">nutricionistas certificados</span>
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">WhatsApp direto</span> com nutricionistas
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">Metas personalizadas</span> e periodização
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">Planos alimentares</span> ajustados ao seu perfil
        </span>
      </li>
    </ul>

    {/* Coluna direita (com divisor como borda à esquerda) */}
    <div className="md:pl-6 md:border-l md:border-purple-200/60 dark:md:border-purple-900/40">
      <ul className="space-y-3">
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Acompanhamento semanal</span> e ajustes contínuos
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Relatórios de progresso</span> com gráficos
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Receitas premium</span> exclusivas
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Comunidade VIP</span> e desafios mensais
          </span>
        </li>
      </ul>
    </div>
  </div>
</div>



          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Crown className="w-5 h-5" />
            {loading ? 'Iniciando...' : 'Assinar Plano Premium'}
          </motion.button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cancele a qualquer momento • Sem compromisso • Suporte 24/7
        </p>
      </motion.div>
    </div>
  );
}
