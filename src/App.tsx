import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RecipeCard } from './components/RecipeCard';
import { CategoryFilter } from './components/CategoryFilter';
import { AdvancedFilters } from './components/filters/AdvancedFilters';
// (Removido o import do RecipeDetails, se não estiver usando,
// pode recolocar depois)
import { ProfilePage } from './components/profile/ProfilePage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { AIMentoringPage } from './components/ai/AIMentoringPage';
import { useFiltersStore } from './store/filters';
import { useRecipesStore } from './store/recipes';
import { useAuthStore } from './store/auth';
import { useToastStore } from './store/toast';
import { useTranslation } from './hooks/useTranslation';
import { Plus } from 'lucide-react';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { Toast } from './components/common/Toast';
import { ConfirmEmailPage } from './components/auth/ConfirmEmailPage';
import { CreateRecipeForm } from './components/CreateRecipeForm';

function App() {
  const [showProfile, setShowProfile] = useState(false);
  const [showAIMentoring, setShowAIMentoring] = useState(false);
  const [showCreateRecipe, setShowCreateRecipe] = useState(false); // <- controle do modal
  const [initialized, setInitialized] = useState(false);

  const { category, setCategory } = useFiltersStore();

  // ⚠️ Pegue APENAS o que você realmente usa do store
  const { recipes, loading, fetchRecipes } = useRecipesStore();

  const { isAuthenticated, isNutritionist, initializeAuth } = useAuthStore();
  const { message, type, hideToast } = useToastStore();
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree', 'vegetarian'];

  // Páginas especiais
  const isResetPasswordPage =
    window.location.pathname === '/reset-password' ||
    window.location.hash.includes('type=recovery');

  let isConfirmPage = false;
  try {
    const url = new URL(window.location.href);
    isConfirmPage =
      window.location.pathname === '/auth/confirm' ||
      url.searchParams.get('code') !== null ||
      window.location.hash.includes('access_token');
  } catch {
    // se der erro de URL em algum ambiente, caímos fora silenciosamente
  }

  // Inicialização
  useEffect(() => {
    const initialize = async () => {
      if (initialized) return;
      try {
        await initializeAuth();
        await fetchRecipes();
        setInitialized(true);
      } catch (e) {
        console.error(e);
      }
    };
    initialize();
  }, [initialized, initializeAuth, fetchRecipes]);

  if (isResetPasswordPage) return <ResetPasswordPage />;
  if (isConfirmPage) return <ConfirmEmailPage />;

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        onProfileClick={() => setShowProfile(true)}
        onAIMentoringClick={() => setShowAIMentoring(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showAIMentoring ? (
          <AIMentoringPage onBack={() => setShowAIMentoring(false)} />
        ) : showProfile ? (
          <ProfilePage onBackToRecipes={() => setShowProfile(false)} />
        ) : (
          <>
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
                  onClick={() => setShowCreateRecipe(true)}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  <Plus size={18} />
                  {t.recipes.createRecipe}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <div className="md:col-span-1">
                <CategoryFilter
                  categories={CATEGORIES}
                  selectedCategory={category}
                  onCategoryChange={setCategory}
                />
                <AdvancedFilters />
              </div>

              <div className="md:col-span-3">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : recipes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">
                      {t.recipes.noRecipesFound}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recipes.map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal de criação: usa as props corretas que seu componente espera */}
            <CreateRecipeForm
              isOpen={showCreateRecipe}
              onClose={() => setShowCreateRecipe(false)}
            />
          </>
        )}
      </main>

      {message && <Toast message={message} type={type} onClose={hideToast} />}
    </div>
  );
}

export default App;
