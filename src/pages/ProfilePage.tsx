import { useNavigate } from 'react-router-dom';
import { ProfilePage as ProfilePageComponent } from '../components/profile/ProfilePage';

export function ProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <ProfilePageComponent onBackToRecipes={() => navigate('/')} />
    </div>
  );
}
