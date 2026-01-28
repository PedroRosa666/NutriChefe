import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { ProfilePage } from '../pages/ProfilePage';
import { RecipePage } from '../pages/RecipePage';
import { AIMentoringPage } from '../pages/AIMentoringPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { ConfirmEmailPage } from '../pages/ConfirmEmailPage';
import { SubscriptionSuccessPage } from '../pages/SubscriptionSuccessPage';
import { SubscriptionCancelledPage } from '../pages/SubscriptionCancelledPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RootLayout } from '../layouts/RootLayout';

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
        element: <ProfilePage />,
      },
      {
        path: 'receita/:id',
        element: <RecipePage />,
      },
      {
        path: 'mentoria-ia',
        element: <AIMentoringPage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
      },
      {
        path: 'auth/confirm',
        element: <ConfirmEmailPage />,
      },
      {
        path: 'assinatura/sucesso',
        element: <SubscriptionSuccessPage />,
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
