import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useSubscriptionStore } from '../../store/subscription';
import { AIChatInterface } from './AIChatInterface';
import { PremiumUpgrade } from './PremiumUpgrade';

interface AIMentoringPageProps {
  onBack: () => void;
}

export function AIMentoringPage({ onBack }: AIMentoringPageProps) {
  const { user, isNutritionist } = useAuthStore();
  const { hasFeatureAccess } = useSubscriptionStore();

  // Verifica acesso
  const hasAIAccess =
    user && (isNutritionist() || hasFeatureAccess('ai_mentoring'));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Botão de voltar */}
      <button
        onClick={onBack}
        className="
          mb-8 inline-flex items-center gap-2
          text-green-600 dark:text-green-400
          hover:text-green-700 dark:hover:text-green-300
          font-medium text-lg
          group
        "
      >
        <ArrowLeft
          className="
            w-6 h-6 transition-transform duration-200
            group-hover:-translate-x-1
          "
        />
        <span className="tracking-wide">Voltar</span>
      </button>

      {/* Conteúdo principal */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
        {hasAIAccess ? <AIChatInterface /> : <PremiumUpgrade />}
      </div>
    </div>
  );
}

export default AIMentoringPage;
