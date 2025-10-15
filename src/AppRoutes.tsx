import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Lazy load — melhora tempo de carregamento
const Home = lazy(() => import('./pages/HomePage'));
const Profile = lazy(() => import('./components/profile/ProfilePage'));
const AIMentoring = lazy(() => import('./components/ai/AIMentoringPage'));
const ResetPasswordPage = lazy(() => import('./components/auth/ResetPasswordPage'));

export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ai" element={<AIMentoring />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* qualquer rota desconhecida redireciona */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
