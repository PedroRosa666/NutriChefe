import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useRecipesStore } from '../store/recipes';
import { RecipeDetails } from '../components/RecipeDetails';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function RecipePage() {
  const navigate = useNavigate();
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

  const recipe = recipes.find(r => r.id === id);

  if (!recipe && !fetchDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Receita não encontrada
          </h1>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RecipeDetails
          recipe={recipe}
          onClose={() => navigate('/')}
        />
      </div>
    </div>
  );
}
