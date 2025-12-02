import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export function SubscriptionCancelledPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="bg-red-100 dark:bg-red-900 p-4 rounded-full">
            <X className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Pagamento Cancelado
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Seu pagamento foi cancelado. Sua assinatura não foi processada.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          Você pode tentar novamente a qualquer momento.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/mentoria-ia')}
            className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Tentar Novamente
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
}
