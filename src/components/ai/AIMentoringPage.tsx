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

  // Check if user has access to AI mentoring
  const hasAIAccess = user && (isNutritionist() || hasFeatureAccess('ai_mentoring'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


      {hasAIAccess ? (
        <AIChatInterface />
      ) : (
        <PremiumUpgrade />
      )}
    </div>
  );
}

export default AIMentoringPage;
