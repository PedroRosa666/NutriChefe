import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ProfilePage as ProfilePageComponent } from '../components/profile/ProfilePage';

export function ProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProfilePageComponent onBackToRecipes={() => navigate('/')} />
      </div>
    </div>
  );
}
