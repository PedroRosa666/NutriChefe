import { ArrowLeft } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { ProfileTabs } from './ProfileTabs';
import { ClientDashboard } from './ClientDashboard';
import { NutritionistDashboard } from './NutritionistDashboard';
import { useAuthStore } from '../../store/auth';
import { useTranslation } from '../../hooks/useTranslation';


interface ProfilePageProps {
  onBackToRecipes?: () => void;
}

export function ProfilePage({ onBackToRecipes }: ProfilePageProps) {
  const { user } = useAuthStore();
  const t = useTranslation();

  const BackToRecipes = t.buttons.BackToRecipes;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBackToRecipes}
        className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-6 group"
      >
        <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
        {BackToRecipes}
      </button>

      <div className="space-y-8">
        <ProfileCard />
        {user?.type === 'Client' ? <ClientDashboard /> : <NutritionistDashboard />}
        <ProfileTabs />
      </div>
    </div>
  );
}