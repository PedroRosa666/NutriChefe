import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RecipeCard } from './components/RecipeCard';
import { CategoryFilter } from './components/CategoryFilter';
import { AdvancedFilters } from './components/filters/AdvancedFilters';
import { RecipeDetails } from './components/RecipeDetails';
import { CreateRecipeForm } from './components/CreateRecipeForm';
import { ProfilePage } from './components/profile/ProfilePage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import AIMentoringPage from './components/ai/AIMentoringPage';
import { useFiltersStore } from './store/filters';
import { useRecipesStore } from './store/recipes';
import { useAuthStore } from './store/auth';
import { useToastStore } from './store/toast';
import { useTranslation } from './hooks/useTranslation';
import { Plus } from 'lucide-react';
import { Toast } from './components/common/Toast';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import ConfirmEmailPage from './components/auth/ConfirmEmailPage';

function App() {
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAIMentoring, setShowAIMentoring] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { 
    category, searchQuery, difficulty, prepTimeRange, minRating, setCategory 
  } = useFiltersStore();

  const { recipes, loading, fetchRecipes } = useRecipesStore();
  const { isAuthenticated, isNutritionist, initializeAuth } = useAuthStore();
  const { message, type, hideToast } = useToastStore();
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree', 'vegetarian'];

  const isResetPasswordPage =
    window.location.pathname === '/reset-password' ||
    window.location.hash.includes('type=recovery');

  let isConfirmEmailPage = false;
  try {
    const url = new URL(window.location.href);
    isConfirmEmailPage =
      window.location.pathname === '/auth/confirm' ||
      url.searchParams.get('code') !== null ||
      window.location.hash.includes('access_token');
  } catch {}

  useEffect(() => {
    const init = async () => {
      if (initialized) return;
      await initializeAuth();
      await fetchRecipes();
      setInitialized(true);
    };
    init();
  }, [initialized, initializeAuth, fetchRecipes]);

  if (isResetPasswordPage) return <ResetPasswordPage />;
  if (isConfirmEmailPage) return <ConfirmEmailPage />;

  if (!initialized) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  const normalizeKey = (key: string) => key?.toLowerCase().replace(/\s+/g, '');
  const matchesDifficulty = (d: string) => difficulty === 'all' || d === difficulty;
  const matchesTime = (min: number) =>
    prepTimeRange === '0-15' ? min <= 15 :
    prepTimeRange === '15-30' ? min > 15 && min <= 30 :
    prepTimeRange === '30+' ? min > 30 : true;

  const filteredRecipes = recipes.filter(r => {
    const matchesCategory =
      normalizeKey(category) === 'all' ||
      normalizeKey(r.category) === normalizeKey(category);
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRating = r.rating >= minRating;
    return matchesCategory && matchesSearch && matchesDifficulty(r.difficulty) && matchesTime(r.prepTime) && matchesRating;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        onProfileClick={() => setShowProfile(true)}
        onAIMentoringClick={() => setShowAIMentoring(true)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showAIMentoring ? (
          <AIMentoringPage onBack={() => setShowAIMentoring(false)} />
        ) : showProfile ? (
          <ProfilePage onBackToRecipes={() => setShowProfile(false)} />
        ) : selectedRecipe !== null ? (
          <RecipeDetails recipe={recipes.find(r => r.id === selectedRecipe)!} onBack={() => setSelectedRecipe(null)} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-4">{t.home.title}</h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-3xl text-sm sm:text-base">{t.home.subtitle}</p>
              </div>

              {isAuthenticated && isNutritionist() && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  <Plus size={18} />
                  {t.home.createRecipe}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <div className="md:col-span-1">
                <CategoryFilter
                  categories={CATEGORIES}
                  selectedCategory={category}
                  onSelectCategory={setCategory}
                />
                <div className="mt-4 flex justify-center sm:justify-start">
                  <AdvancedFilters />
                </div>
              </div>

              <div className="md:col-span-3">
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">{t.home.noRecipes}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map((r) => (
                      <RecipeCard key={r.id} recipe={r} onClick={() => setSelectedRecipe(r.id)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateRecipeForm isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {message && <Toast message={message} type={type} onClose={hideToast} />}
    </div>
  );
}

export default App;
