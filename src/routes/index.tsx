import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RootLayout } from '../layouts/RootLayout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// Páginas fora da home são carregadas sob demanda: o bundle inicial fica menor
// (a mentoria IA, por exemplo, traz o SDK do Gemini).
function lazyPage<T>(load: () => Promise<T>, name: keyof T) {
  const Page = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'perfil',
        element: lazyPage(() => import('../pages/ProfilePage'), 'ProfilePage'),
      },
      {
        path: 'receita/:id',
        element: lazyPage(() => import('../pages/RecipePage'), 'RecipePage'),
      },
      {
        path: 'mentoria-ia',
        element: lazyPage(() => import('../pages/AIMentoringPage'), 'AIMentoringPage'),
      },
      {
        path: 'nutricionistas',
        element: lazyPage(() => import('../pages/NutritionistsPage'), 'NutritionistsPage'),
      },
      {
        path: 'nutricionista/:id',
        element: lazyPage(() => import('../pages/NutritionistProfilePage'), 'NutritionistProfilePage'),
      },
      {
        path: 'forgot-password',
        element: lazyPage(() => import('../pages/ForgotPasswordPage'), 'ForgotPasswordPage'),
      },
      {
        path: 'reset-password',
        element: lazyPage(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage'),
      },
      {
        path: 'confirm-email',
        element: lazyPage(() => import('../pages/ConfirmEmailPage'), 'ConfirmEmailPage'),
      },
      {
        path: 'login',
        element: <HomePage />,
      },
      {
        path: 'assinatura/sucesso',
        element: lazyPage(() => import('../pages/SubscriptionSuccessPage'), 'SubscriptionSuccessPage'),
      },
      {
        path: 'assinatura/cancelada',
        element: lazyPage(() => import('../pages/SubscriptionCancelledPage'), 'SubscriptionCancelledPage'),
      },
      {
        path: '404',
        element: <NotFoundPage />,
      },
      {
        path: '*',
        element: <Navigate to="/404" replace />,
      },
    ],
  },
]);
