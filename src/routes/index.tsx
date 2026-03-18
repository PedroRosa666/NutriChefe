import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { ProfilePage } from '../pages/ProfilePage';
import { RecipePage } from '../pages/RecipePage';
import { AIMentoringPage } from '../pages/AIMentoringPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { ConfirmEmailPage } from '../pages/ConfirmEmailPage';
import { SubscriptionSuccessPage } from '../pages/SubscriptionSuccessPage';
import { SubscriptionCancelledPage } from '../pages/SubscriptionCancelledPage';
import { NutritionistsPage } from '../pages/NutritionistsPage';
import { NutritionistProfilePage } from '../pages/NutritionistProfilePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RootLayout } from '../layouts/RootLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';

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
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'receita/:id',
        element: <RecipePage />,
      },
      {
        path: 'mentoria-ia',
        element: (
          <ProtectedRoute>
            <AIMentoringPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'nutricionistas',
        element: <NutritionistsPage />,
      },
      {
        path: 'nutricionista/:id',
        element: <NutritionistProfilePage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
      },
      {
        path: 'confirmar-email',
        element: <ConfirmEmailPage />,
      },
      {
        path: 'assinatura/sucesso',
        element: (
          <ProtectedRoute>
            <SubscriptionSuccessPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'assinatura/cancelada',
        element: <SubscriptionCancelledPage />,
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
