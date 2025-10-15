import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useFiltersStore } from '../store/filters';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { CategoryFilter } from '../components/CategoryFilter';
import { AdvancedFilters } from '../components/filters/AdvancedFilters';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetails } from '../components/RecipeDetails';
import { CreateRecipeForm } from '../components/CreateRecipeForm';
import { useTranslation } from '../hooks/useTranslation';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export default function HomePage() {
  const [selectedRecipe, setSelectedRecipe] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { recipes, loading, fetchRecipes } = useRecipesStore();
  const { isAuthenticated, isNutritionist } = useAuthStore();
  const { category, setCategory, searchQuery, difficulty, prepTimeRange, minRating } = useFiltersStore();
  const t = useTranslation();

  const CATEGORIES = ['all', 'vegan', 'lowCarb', 'highProtein', 'glutenFree', 'vegetarian'];

  const matchesPrepTime = (recipe: any) => {
    if (!prepTimeRange) return true;
    switch (prepTimeRange) {
      case 'quick': return recipe.prepTime <= 15;
      case 'medium': return recipe.prepTime <= 30;
      case 'long': return recipe.prepTime > 30;
      default: return true;
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    const matchesCategory = category === 'all' || r.category.toLowerCase() === category.toLowerCase();
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = !difficulty || r.difficulty === difficulty;
    const matchesRating = !minRating || r.rating >= minRating;
    const matchesTime = matchesPrepTime(r);
    return matchesCategory && matchesSearch && matchesDifficulty && matchesRating && matchesTime;
  });

  const selectedRecipeData = recipes.find((r) => r.id === selectedRecipe);

  return (
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

      {/* filtros */}
      <div className="mb-8 space-y-4">
        <CategoryFilter
          categories={CATEGORIES}
          selectedCategory={category}
          onSelectCategory={setCategory}
        />
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
          <button
            onClick={fetchRecipes}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Tentar novamente
          </button>
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

      {selectedRecipeData && (
        <RecipeDetails recipe={selectedRecipeData} onClose={() => setSelectedRecipe(null)} />
      )}

      <CreateRecipeForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </main>
  );
}
