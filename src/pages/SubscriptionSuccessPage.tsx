import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export function SubscriptionSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/perfil');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="bg-green-100 dark:bg-green-900 p-4 rounded-full">
            <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Assinatura Confirmada!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Sua assinatura foi processada com sucesso. Você agora tem acesso a todos os recursos premium.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Redirecionando para seu perfil em 5 segundos...
        </p>
        <button
          onClick={() => navigate('/perfil')}
          className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Ir para o Perfil Agora
        </button>
      </div>
    </div>
  );
}
