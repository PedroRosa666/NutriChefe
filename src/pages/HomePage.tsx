import { useState, useEffect, useMemo, useRef } from 'react';
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
import { fitsOwnDiet } from '../lib/recipe-diet';

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
  const cards = useRecipesStore((s) => s.cards);
  const loading = useRecipesStore((s) => s.cardsLoading);
  const loadingMore = useRecipesStore((s) => s.cardsLoadingMore);
  const hasMore = useRecipesStore((s) => s.cardsHasMore);
  const failed = useRecipesStore((s) => s.cardsError);
  const { isAuthenticated, isNutritionist } = useAuthStore();

  // Links antigos do app instalado (/?inicio=1): só limpa o parâmetro, o Início são as receitas.
  const launched = searchParams.has('inicio');
  useEffect(() => {
    if (launched) navigate('/', { replace: true });
  }, [launched, navigate]);
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'vegetarian', 'lowCarb', 'highProtein', 'glutenFree'];

  // Receita aberta (rota filha /receita/:id) aparece como modal por cima da lista.
  const outlet = useOutlet();
  const location = useLocation();

  // Busca e filtros rodam no servidor, de página em página. A digitação espera uma pausa
  // curta antes de buscar; voltar para a home com a mesma busca atualiza em silêncio
  // (a grade não vira spinner nem recarrega as imagens).
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const filters = useMemo(
    () => ({ query: debouncedQuery, category, difficulty: difficulty || null, minRating: minRating || null, prepTimeRange: prepTimeRange || null }),
    [debouncedQuery, category, difficulty, minRating, prepTimeRange]
  );
  useEffect(() => {
    // Com resultados na tela, eles ficam até chegarem os novos (sem piscar o esqueleto a cada letra).
    useRecipesStore.getState().loadCards(filters, { silent: useRecipesStore.getState().cards.length > 0 });
  }, [filters]);

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

  // Categoria de dieta: além do rótulo, os ingredientes precisam servir (rótulo errado não engana o filtro).
  const isDietCategory = ['vegan', 'vegetarian', 'glutenFree'].includes(category);
  const filteredRecipes = isDietCategory ? cards.filter(fitsOwnDiet) : cards;

  // Página que ficou quase vazia depois do filtro de dieta: busca a próxima sozinha.
  useEffect(() => {
    if (!loading && !loadingMore && hasMore && filteredRecipes.length < 6) useRecipesStore.getState().loadMoreCards();
  }, [loading, loadingMore, hasMore, filteredRecipes.length]);

  // Rolagem infinita: chegando perto do fim da grade, carrega a próxima página.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) useRecipesStore.getState().loadMoreCards();
    }, { rootMargin: '600px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filteredRecipes.length]);

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

          <div className="mb-6">
            <PantrySearch />
          </div>

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

          {/* Âncora da busca: ao começar a digitar, a página desce até aqui (abaixo do cabeçalho fixo). */}
          <div id="lista-receitas" className="scroll-mt-32" />
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }, (_, i) => <RecipeCardSkeleton key={i} />)}
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">{isAuthenticated ? t.home.noRecipes : t.home.noRecipesGuest}</p>
              {/* Nada com a busca/filtros atuais (que ficam guardados entre as páginas): um toque desfaz. */}
              {!failed && (
                <button
                  onClick={() => useFiltersStore.getState().resetFilters()}
                  className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  {t.profileUi.clearFilters}
                </button>
              )}
              {failed && (
                <button
                  onClick={() => useRecipesStore.getState().loadCards(filters)}
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
          {!loading && hasMore && (
            <div ref={sentinel} className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => useRecipesStore.getState().loadMoreCards()}
                disabled={loadingMore}
                className="rounded-lg border border-emerald-200 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
              >
                {loadingMore ? t.common.loading : t.home.loadMore}
              </button>
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
