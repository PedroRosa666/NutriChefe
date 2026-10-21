import { useNavigate } from 'react-router-dom';
import { ProfilePage as ProfilePageComponent } from '../components/profile/ProfilePage';

export function ProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ProfilePageComponent onBackToRecipes={() => navigate('/')} />
    </div>
  );
}
