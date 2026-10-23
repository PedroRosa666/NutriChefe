import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { isStaleBuildError, reloadForNewBuild } from '../../lib/stale-build';
import { reportError } from '../../lib/error-reporting';
import { ErrorScreen } from './ErrorBoundary';

/** Erro capturado pelo roteador: 404 vira "página não encontrada"; o resto, a tela de erro. */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (isStaleBuildError(error) && reloadForNewBuild()) return null;
  reportError(error, 'router');
  return <ErrorScreen />;
}
