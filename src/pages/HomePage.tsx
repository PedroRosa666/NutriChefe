import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useOutlet, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Header } from '../components/Header';
import { RecipeCard } from '../components/RecipeCard';
import { CategoryFilter } from '../components/CategoryFilter';
import { AdvancedFilters } from '../components/filters/AdvancedFilters';
import { CreateRecipeForm } from '../components/CreateRecipeForm';
import { useFiltersStore } from '../store/filters';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import { Plus } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { Recipe } from '../types/recipe';

export function HomePage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const {
    category,
    searchQuery,
    difficulty,
    prepTimeRange,
    minRating,
    setCategory,
    setSearchQuery
  } = useFiltersStore();
  const [searchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q');

  // Links com ?q= (ex.: cartões da Mentoria IA) já abrem a busca preenchida.
  useEffect(() => {
    if (queryFromUrl) setSearchQuery(queryFromUrl);
  }, [queryFromUrl, setSearchQuery]);
  const { recipes, loading, fetchRecipes } = useRecipesStore();
  const { isAuthenticated, isNutritionist } = useAuthStore();
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'vegetarian', 'lowCarb', 'highProtein', 'glutenFree'];

  // Receita aberta (rota filha /receita/:id) aparece como modal por cima da lista.
  const outlet = useOutlet();
  const location = useLocation();

  // A sessão é inicializada no RootLayout; aqui só carregamos as receitas.
  // Voltando para a home com a lista já carregada, atualiza em silêncio
  // (antes a grade virava um spinner e as imagens recarregavam).
  useEffect(() => {
    fetchRecipes({ silent: useRecipesStore.getState().recipes.length > 0 });
  }, [fetchRecipes]);

  // Baixa o código do modal de receita enquanto a pessoa olha a lista.
  useEffect(() => {
    const load = () => { import('./RecipePage'); };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load);
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, []);

  const normalizeKey = (key: string) => {
    return key.toLowerCase().replace(/\s+/g, '');
  };

  const matchesPrepTime = (recipe: Recipe) => {
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
              <div className="flex flex-wrap items-center gap-2">
                <CategoryFilter
                  categories={CATEGORIES}
                  selectedCategory={category}
                  onSelectCategory={setCategory}
                />
                <div className="ml-auto">
                  <AdvancedFilters />
                </div>
              </div>
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
                  onClick={() => fetchRecipes()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t.common.retry}
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

        <AnimatePresence>
          {location.pathname.startsWith('/receita/') && <div key={location.pathname}>{outlet}</div>}
        </AnimatePresence>

      </div>
  );
}
