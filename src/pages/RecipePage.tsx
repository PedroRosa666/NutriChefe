import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useRecipesStore } from '../store/recipes';
import { RecipeDetails } from '../components/RecipeDetails';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// Renderizada dentro da home (rota filha): a receita abre como modal por cima
// da lista, que continua montada. Fechar volta para onde a pessoa estava.
export function RecipePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { recipes, fetchRecipes } = useRecipesStore();
  const [fetchDone, setFetchDone] = useState(recipes.length > 0);

  // Acesso direto pelo link: a lista ainda não foi carregada.
  useEffect(() => {
    if (recipes.length > 0) {
      setFetchDone(true);
      return;
    }
    let cancelled = false;
    fetchRecipes().finally(() => {
      if (!cancelled) setFetchDone(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRecipes]);

  // "default" = primeira página aberta nesta aba (link direto): não há para onde voltar.
  const close = useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  }, [location.key, navigate]);

  const recipe = recipes.find(r => r.id === id);

  if (!recipe && !fetchDone) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[3px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 backdrop-blur-[3px] p-4">
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Receita não encontrada
          </h1>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return <RecipeDetails recipe={recipe} onClose={close} />;
}
