import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRecipesStore } from '../store/recipes';
import { RecipeDetails } from '../components/RecipeDetails';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function RecipePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { recipes, loading, fetchRecipes } = useRecipesStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && recipes.length === 0) {
      fetchRecipes().then(() => setInitialized(true));
    } else {
      setInitialized(true);
    }
  }, [fetchRecipes, initialized, recipes.length]);

  const recipe = recipes.find(r => r.id === parseInt(id || '0'));

  if (loading) {
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
