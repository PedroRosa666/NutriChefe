import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RecipeCard } from './components/RecipeCard';
import { CategoryFilter } from './components/CategoryFilter';
import { AdvancedFilters } from './components/filters/AdvancedFilters';
import { RecipeDetails } from './components/RecipeDetails';
import { CreateRecipeForm } from './components/CreateRecipeForm';
import { ProfilePage } from './components/profile/ProfilePage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { AIMentoringPage } from './components/ai/AIMentoringPage';
import { useFiltersStore } from './store/filters';
import { useRecipesStore } from './store/recipes';
import { useAuthStore } from './store/auth';
import { useToastStore } from './store/toast';
import { useTranslation } from './hooks/useTranslation';
import { Plus } from 'lucide-react';
import { Toast } from './components/common/Toast';
import { LoadingSpinner } from './components/common/LoadingSpinner';

function App() {
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAIMentoring, setShowAIMentoring] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { category, searchQuery, difficulty, prepTimeRange, minRating, setCategory } = useFiltersStore();
  const { recipes, loading, fetchRecipes } = useRecipesStore();
  const { user, initializeAuth } = useAuthStore();
  const { message, type, hideToast } = useToastStore();
  const t = useTranslation();

  const isAuthenticated = !!user;
  const isNutritionist = user?.type === 'Nutritionist';

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree', 'vegetarian'];

  const isResetPasswordPage = window.location.pathname === '/reset-password' ||
                              window.location.hash.includes('type=recovery');

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        if (initializeAuth) {
          await initializeAuth();
        }
        await fetchRecipes();

        if (mounted) {
          setInitialized(true);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        if (mounted) {
          setInitialized(true);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (initialized) {
      setCategory('all');
    }
  }, [initialized]);

  if (isResetPasswordPage) {
    return <ResetPasswordPage />;
  }

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 dark:text-gray-400">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  const normalizeKey = (key: string | null | undefined): string => {
    if (!key) return '';
    return key.toLowerCase().replace(/\s+/g, '');
  };

  const matchesPrepTime = (recipe: any): boolean => {
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

  const filteredRecipes = recipes.filter((recipe: any) => {
    const normalizedSelectedCategory = normalizeKey(category);
    const normalizedRecipeCategory = normalizeKey(recipe.category);

    const matchesCategory = normalizedSelectedCategory === 'all' || normalizedRecipeCategory === normalizedSelectedCategory;
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = !difficulty || recipe.difficulty === difficulty;
    const matchesRating = !minRating || recipe.rating >= minRating;
    const matchesTime = matchesPrepTime(recipe);

    return matchesCategory && matchesSearch && matchesDifficulty && matchesRating && matchesTime;
  });

  const selectedRecipeData = recipes.find((r: any) => r.id === selectedRecipe);

  if (showProfile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ProfilePage onClose={() => setShowProfile(false)} />
        <Toast message={message} type={type} onClose={hideToast} />
      </div>
    );
  }

  if (showAIMentoring) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AIMentoringPage onClose={() => setShowAIMentoring(false)} />
        <Toast message={message} type={type} onClose={hideToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        onProfileClick={() => setShowProfile(true)}
        onAIMentoringClick={() => setShowAIMentoring(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('discoverRecipes')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('exploreHealthy')}
              </p>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                {t('createRecipe')}
              </button>
            )}
          </div>

          <CategoryFilter
            categories={CATEGORIES}
            selectedCategory={category}
            onSelectCategory={setCategory}
          />

          <AdvancedFilters />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {t('noRecipes')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe: any) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => setSelectedRecipe(recipe.id)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedRecipeData && (
        <RecipeDetails
          recipe={selectedRecipeData}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {isCreateModalOpen && (
        <CreateRecipeForm
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      <Toast message={message} type={type} onClose={hideToast} />
    </div>
  );
}

export default App;
