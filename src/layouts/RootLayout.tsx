import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useAuthStore } from '../store/auth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function RootLayout() {
  const { initializeAuth, initialized } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}
