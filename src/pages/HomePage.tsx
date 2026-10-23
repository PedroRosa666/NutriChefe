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
import { LandingHero, RecipeCardSkeleton } from '../components/recipes/LandingHero';
import { PantrySearch } from '../components/recipes/PantrySearch';
import { ExclusiveShelf } from '../components/recipes/ExclusiveShelf';
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

  // Abrindo o app instalado (start_url /?inicio=1): quem está logado começa no Início (o seu dia
  // ou o painel); quem não está fica nas receitas.
  const launched = searchParams.has('inicio');
  useEffect(() => {
    if (launched) navigate(isAuthenticated ? '/perfil' : '/', { replace: true });
  }, [launched, isAuthenticated, navigate]);
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
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
        <Header
          onProfileClick={() => navigate('/perfil')}
          onAIMentoringClick={() => navigate('/mentoria-ia')}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!isAuthenticated && <LandingHero />}
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
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                {t.home.createRecipe}
              </button>
            )}
          </div>

          {recipes.length > 0 && (
            <div className="mb-6">
              <PantrySearch recipes={recipes} />
            </div>
          )}

          <div className="mb-8">
            <div className="bg-white dark:bg-slate-800/60 rounded-xl p-3.5 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.filters.categoriesTitle}</h3>
                <AdvancedFilters />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <CategoryFilter
                  categories={CATEGORIES}
                  selectedCategory={category}
                  onSelectCategory={setCategory}
                />
              </div>
            </div>
          </div>

          <ExclusiveShelf />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }, (_, i) => <RecipeCardSkeleton key={i} />)}
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">{t.home.noRecipes}</p>
              {/* Nada com a busca/filtros atuais (que ficam guardados entre as páginas): um toque desfaz. */}
              {recipes.length > 0 && (
                <button
                  onClick={() => useFiltersStore.getState().resetFilters()}
                  className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  {t.profileUi.clearFilters}
                </button>
              )}
              {recipes.length === 0 && !loading && (
                <button
                  onClick={() => fetchRecipes()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
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
