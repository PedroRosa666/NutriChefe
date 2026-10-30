import { Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RootLayout } from '../layouts/RootLayout';
import { RouteError } from '../components/common/RouteError';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { lazyNamed } from '../lib/stale-build';

// Páginas fora da home são carregadas sob demanda: o bundle inicial fica menor
// (a mentoria IA, por exemplo, traz o SDK do Gemini).
function lazyPage<K extends string>(load: () => Promise<{ [P in K]: ComponentType }>, name: K, overlay = false) {
  const Page = lazyNamed<K, ComponentType>(load, name);
  return (
    <Suspense
      fallback={
        overlay ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[3px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )
      }
    >
      <Page />
    </Suspense>
  );
}

/** Carregado também em segundo plano pela home, para a 1ª receita abrir sem espera. */
const loadRecipePage = () => import('../pages/RecipePage');

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        // A home fica montada enquanto uma receita está aberta: a receita é um modal por cima dela.
        element: <HomePage />,
        children: [
          { index: true, element: null },
          {
            // O nome no fim é opcional (src/lib/recipe-url.ts).
            path: 'receita/:id/:slug?',
            element: lazyPage(loadRecipePage, 'RecipePage', true),
          },
        ],
      },
      {
        path: 'perfil',
        element: lazyPage(() => import('../pages/ProfilePage'), 'ProfilePage'),
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
        path: 'admin',
        element: lazyPage(() => import('../pages/AdminPage'), 'AdminPage'),
      },
      {
        path: 'privacidade',
        element: lazyPage(() => import('../pages/PrivacyPage'), 'PrivacyPage'),
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
        path: 'demo',
        element: lazyPage(() => import('../pages/DemoPage'), 'DemoPage'),
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
