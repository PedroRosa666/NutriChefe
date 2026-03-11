import React from 'react';
import { ArrowLeft, Bot, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/auth';
import { useSubscriptionStore } from '../../store/subscription';
import { AIChatInterface } from './AIChatInterface';
import { PremiumUpgrade } from './PremiumUpgrade';
import { useTranslation } from '../../hooks/useTranslation';

interface AIMentoringPageProps {
  onBack: () => void;
}

export function AIMentoringPage({ onBack }: AIMentoringPageProps) {
  const { user, isNutritionist } = useAuthStore();
  const { hasFeatureAccess } = useSubscriptionStore();
  const t = useTranslation();

  const hasAIAccess = user && (isNutritionist() || hasFeatureAccess('ai_mentoring'));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.button
        onClick={onBack}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        {t.common.back}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {hasAIAccess ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-none border border-gray-200 dark:border-gray-700/60 overflow-hidden">
            <AIChatInterface />
          </div>
        ) : (
          <PremiumUpgrade />
        )}
      </motion.div>
    </div>
  );
}

export default AIMentoringPage;
