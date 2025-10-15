import { useState, useEffect, useMemo } from 'react';
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

// Se você já estiver usando o LoadingGate radical, importe e envolva o conteúdo.
// import LoadingGate from './components/common/LoadingGate';

type Pane = 'home' | 'ai' | 'profile';

function App() {
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [pane, setPane] = useState<Pane>('home');

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

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree', 'vegetarian'];

  // Detecta página de reset de senha
  const isResetPasswordPage = window.location.pathname === '/reset-password' || 
                              window.location.hash.includes('type=recovery');

  // Inicialização (auth -> recipes)
  useEffect(() => {
    const initialize = async () => {
      if (initialized) return;
      try {
        await initializeAuth();
        await fetchRecipes();
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setInitialized(true);
      }
    };
    initialize();
  }, [initializeAuth, fetchRecipes, initialized]);

  // Define categoria inicial quando app pronto
  useEffect(() => {
    if (initialized) setCategory('all');
  }, [setCategory, initialized]);

  // Ao trocar de “tela”, limpamos overlays que poderiam conflitar
  useEffect(() => {
    // fecha card de receita e modal de criação ao alternar
    setSelectedRecipe(null);
    setIsCreateModalOpen(false);
  }, [pane]);

  // Funções auxiliares
  const normalizeKey = (key: string) => key.toLowerCase().replace(/\s+/g, '');

  const matchesPrepTime = (recipe: any) => {
    if (!prepTimeRange) return true;
    switch (prepTimeRange) {
      case 'quick':  return recipe.prepTime <= 15;
      case 'medium': return recipe.prepTime <= 30;
      case 'long':   return recipe.prepTime > 30;
      default:       return true;
    }
  };

  // Filtragem memoizada p/ reduzir trabalho em re-renders
  const filteredRecipes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const normalizedSelectedCategory = normalizeKey(category);
    return recipes.filter((recipe) => {
      const normalizedRecipeCategory = normalizeKey(recipe.category);
      const matchesCategory = normalizedSelectedCategory === 'all' || normalizedRecipeCategory === normalizedSelectedCategory;
      const matchesSearch = recipe.title.toLowerCase().includes(q) ||
                            recipe.description.toLowerCase().includes(q);
      const matchesDifficulty = !difficulty || recipe.difficulty === difficulty;
      const matchesRating = !minRating || recipe.rating >= minRating;
      const matchesTime = matchesPrepTime(recipe);
      return matchesCategory && matchesSearch && matchesDifficulty && matchesRating && matchesTime;
    });
  }, [recipes, category, searchQuery, difficulty, minRating, prepTimeRange]);

  const selectedRecipeData = recipes.find(r => r.id === selectedRecipe);

  // Reset password tem prioridade
  if (isResetPasswordPage) {
    return <ResetPasswordPage />;
  }

  // Loading inicial
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-green-600 dark:text-green-400">NutriChef</h1>
          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-300">
            <LoadingSpinner size="lg" />
            <span>Carregando aplicação…</span>
          </div>
        </div>
      </div>
    );
    // Se estiver usando o LoadingGate, troque pelo componente:
    // return (
    //   <LoadingGate initialized={initialized} minDurationMs={5000}>
    //     {/* o conteúdo real entra aqui quando liberar */}
    //   </LoadingGate>
    // );
  }

  // Render
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header 
        onProfileClick={() => setPane('profile')}
        onAIMentoringClick={() => setPane('ai')}
        // Se seu Header tiver botão para "Home", pode passar:
        // onHomeClick={() => setPane('home')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {pane === 'ai' ? (
          <AIMentoringPage onBack={() => setPane('home')} />
        ) : pane === 'profile' ? (
          <ProfilePage onBackToRecipes={() => setPane('home')} />
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
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  {t.home.createRecipe}
                </button>
              )}
            </div>

            {/* Filtros */}
            <div className="mb-8 space-y-4">
              <div className="w-full">
                <CategoryFilter
                  categories={CATEGORIES}
                  selectedCategory={category}
                  onSelectCategory={setCategory}
                />
              </div>
              <div className="flex justify-center sm:justify-end">
                <AdvancedFilters />
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
                    onClick={() => setSelectedRecipe(recipe.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selectedRecipeData && pane === 'home' && (
        <RecipeDetails
          recipe={selectedRecipeData}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      <CreateRecipeForm
        isOpen={isCreateModalOpen && pane === 'home'}
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

export default App;
