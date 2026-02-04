import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { RecipeCard } from '../components/RecipeCard';
import { CategoryFilter } from '../components/CategoryFilter';
import { AdvancedFilters } from '../components/filters/AdvancedFilters';
import { CreateRecipeForm } from '../components/CreateRecipeForm';
import { useFiltersStore } from '../store/filters';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { useTranslation } from '../hooks/useTranslation';
import { Plus } from 'lucide-react';
import { Toast } from '../components/common/Toast';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function HomePage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const {
    category,
    searchQuery,
    difficulty,
    prepTimeRange,
    minRating,
    setCategory
  } = useFiltersStore();
  const { recipes, loading, fetchRecipes } = useRecipesStore();
  const { isAuthenticated, isNutritionist, initializeAuth } = useAuthStore();
  const { message, type, hideToast } = useToastStore();
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree'];

  useEffect(() => {
    const initialize = async () => {
      if (initialized) return;

      try {
        await initializeAuth();
        await fetchRecipes();
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setInitialized(true);
      }
    };

    initialize();
  }, [initializeAuth, fetchRecipes, initialized]);

  useEffect(() => {
    if (initialized) {
      setCategory('all');
    }
  }, [setCategory, initialized]);

  const normalizeKey = (key: string) => {
    return key.toLowerCase().replace(/\s+/g, '');
  };

  const matchesPrepTime = (recipe: any) => {
    if (!prepTimeRange) return true;

    switch (prepTimeRange) {
      case 'quick':
        return recipe.prepTime <= 15;
      case 'medium':
        return recipe.prepTime <= 30;
      case 'long':
        return recipe.prepTime > 30;
      default:
        return true;
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const normalizedRecipeCategory = normalizeKey(recipe.category);
    const normalizedSelectedCategory = normalizeKey(category);

    const matchesCategory = normalizedSelectedCategory === 'all' || normalizedRecipeCategory === normalizedSelectedCategory;
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = !difficulty || recipe.difficulty === difficulty;
    const matchesRating = !minRating || recipe.rating >= minRating;
    const matchesTime = matchesPrepTime(recipe);

    return matchesCategory && matchesSearch && matchesDifficulty && matchesRating && matchesTime;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Header
          onProfileClick={() => navigate('/perfil')}
          onAIMentoringClick={() => navigate('/mentoria-ia')}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-4">
                {t.home.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-3xl text-sm sm:text-base">
                {t.home.subtitle}
              </p>
            </div>

            {isAuthenticated && isNutritionist() && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                {t.home.createRecipe}
              </button>
            )}
          </div>

          <div className="mb-8">
            <div className="bg-white dark:bg-slate-800/30 rounded-xl p-4 sm:p-5 border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Filtros
                </h3>
                <AdvancedFilters />
              </div>
              <CategoryFilter
                categories={CATEGORIES}
                selectedCategory={category}
                onSelectCategory={setCategory}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">{t.home.noRecipes}</p>
              {recipes.length === 0 && !loading && (
                <button
                  onClick={fetchRecipes}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                />
              ))}
            </div>
          )}
        </main>

        <CreateRecipeForm
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />

        {message && (
          <Toast
            message={message}
            type={type}
            onClose={hideToast}
          />
        )}
      </div>
  );
}
