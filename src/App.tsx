import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RecipeCard } from './components/RecipeCard';
import { CategoryFilter } from './components/CategoryFilter';
import { AdvancedFilters } from './components/filters/AdvancedFilters';
import { RecipeDetails } from './components/RecipeDetails';
import { CreateRecipeForm } from './components/CreateRecipeForm';
import { ProfilePage } from './components/profile/ProfilePage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
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
  const { isAuthenticated, isNutritionist, user, initializeAuth } = useAuthStore();
  const { message, type, hideToast } = useToastStore();
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree', 'vegetarian'];

  // Verificar se é página de reset de senha
  const isResetPasswordPage = window.location.pathname === '/reset-password' || 
                             window.location.hash.includes('type=recovery');

  // Inicializar aplicação
  useEffect(() => {
    const initialize = async () => {
      if (initialized) return;
      
      console.log('Initializing app...');
      try {
        // Primeiro inicializar autenticação
        await initializeAuth();
        
        // Depois buscar receitas
        await fetchRecipes();
        
        setInitialized(true);
        console.log('App initialized successfully');
      } catch (error) {
        console.error('Error initializing app:', error);
        setInitialized(true); // Marcar como inicializado mesmo com erro
      }
    };

    initialize();
  }, [initializeAuth, fetchRecipes, initialized]);

  // Sincroniza a categoria inicial
  useEffect(() => {
    if (initialized) {
      setCategory('all');
    }
  }, [setCategory, initialized]);

  // Se for página de reset de senha, mostrar apenas essa página
  if (isResetPasswordPage) {
    return <ResetPasswordPage />;
  }

  // Função para normalizar as chaves
  const normalizeKey = (key: string) => {
    return key.toLowerCase().replace(/\s+/g, '');
  };

  // Função para filtrar por tempo de preparo
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

  // Filtra as receitas
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

  const selectedRecipeData = recipes.find(r => r.id === selectedRecipe);

  // Mostrar loading inicial
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header onProfileClick={() => setShowProfile(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showProfile ? (
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
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  {t.home.createRecipe}
                </button>
              )}
            </div>

            {/* Filtros com layout melhorado */}
            <div className="mb-8 space-y-4">
              {/* Filtros de categoria - sempre em linha completa */}
              <div className="w-full">
                <CategoryFilter
                  categories={CATEGORIES}
                  selectedCategory={category}
                  onSelectCategory={setCategory}
                />
              </div>
              
              {/* Filtros avançados - alinhados à direita em desktop, centralizados em mobile */}
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

      {selectedRecipeData && (
        <RecipeDetails
          recipe={selectedRecipeData}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

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

export default App;