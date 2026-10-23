import { useEffect } from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { Home } from 'lucide-react';
import { reportError } from '../lib/error-reporting';

export function NotFoundPage() {
  const navigate = useNavigate();
  // Esta página também é a tela de erro das rotas: um erro de código (não um 404) é registrado.
  const routeError = useRouteError();
  useEffect(() => {
    if (routeError && !isRouteErrorResponse(routeError)) reportError(routeError, 'route');
  }, [routeError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="text-6xl font-bold text-gray-300 dark:text-gray-700">404</div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Página não encontrada
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Desculpe, a página que você está procurando não existe ou foi removida.
        </p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Home className="w-5 h-5" />
          Voltar ao Início
        </button>
      </div>
    </div>
  );
}
