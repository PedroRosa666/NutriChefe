import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useRecipesStore } from '../store/recipes';
import { useTranslation } from '../hooks/useTranslation';
import { RecipeHeroSection } from './recipe/RecipeHeroSection';
import { NutritionPanel } from './recipe/NutritionPanel';
import { RecipeInstructions } from './recipe/RecipeInstructions';
import { RecipeReviewSection } from './recipe/RecipeReviewSection';
import { RecipeLogModal } from './recipe/RecipeLogModal';
import { IngredientChecklist } from './recipe/IngredientChecklist';
import { EditRecipeForm } from './recipe/EditRecipeForm';
import type { Recipe } from '../types/recipe';

interface RecipeDetailsProps {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeDetails({ recipe, onClose }: RecipeDetailsProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const { user, isAuthenticated } = useAuthStore();
  const { favoriteRecipes, addToFavorites, removeFromFavorites, deleteRecipe } =
    useRecipesStore();
  const t = useTranslation();

  const isFavorite = favoriteRecipes.includes(recipe.id);
  const isAuthor = user?.id === recipe.authorId;

  const categoryTranslations = t.categories;
  const getCategoryTranslation = (category: string) => {
    const categoryMap: { [key: string]: keyof typeof categoryTranslations } = {
      vegan: 'vegan',
      lowCarb: 'lowCarb',
      'low carb': 'lowCarb',
      highProtein: 'highProtein',
      'high protein': 'highProtein',
      glutenFree: 'glutenFree',
      'gluten free': 'glutenFree',
      vegetarian: 'vegetarian',
    };

    const normalizedCategory = category.toLowerCase().replace(/\s+/g, '');
    const mappedKey = Object.keys(categoryMap).find(
      (key) => key.toLowerCase().replace(/\s+/g, '') === normalizedCategory,
    );

    if (mappedKey) {
      return categoryTranslations[categoryMap[mappedKey]];
    }

    const directKey = category as keyof typeof categoryTranslations;
    return categoryTranslations[directKey] || category;
  };

  const translatedCategory = getCategoryTranslation(recipe.category);
  const translatedDifficulty =
    t.recipe.difficultyLevels[
      recipe.difficulty as keyof typeof t.recipe.difficultyLevels
    ] || recipe.difficulty;

  const handleDelete = async () => {
    if (window.confirm(t.recipe.deleteConfirm)) {
      await deleteRecipe(recipe.id);
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto z-50">
        <div className="min-h-screen flex items-start justify-center p-3 md:p-6 py-4 md:py-8">
          <div className="relative w-full max-w-5xl">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
              <RecipeHeroSection
                image={recipe.image}
                title={recipe.title}
                translatedCategory={translatedCategory}
                difficulty={recipe.difficulty}
                translatedDifficulty={translatedDifficulty}
                prepTime={recipe.prepTime}
                rating={recipe.rating}
                reviewCount={recipe.reviews.length}
                isFavorite={isFavorite}
                isAuthor={isAuthor}
                isAuthenticated={isAuthenticated}
                isClient={user?.type === 'Client'}
                onClose={onClose}
                onToggleFavorite={() =>
                  isFavorite
                    ? removeFromFavorites(recipe.id)
                    : addToFavorites(recipe.id)
                }
                onEdit={() => setIsEditModalOpen(true)}
                onDelete={handleDelete}
                onLogMeal={() => setIsLogModalOpen(true)}
              />

              <div className="px-5 md:px-8 py-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 min-w-0 space-y-5">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50 p-5">
                      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>

                    <RecipeInstructions instructions={recipe.instructions} />
                  </div>

                  <div className="w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 space-y-5">
                    <NutritionPanel nutritionFacts={recipe.nutritionFacts} />
                    <IngredientChecklist ingredients={recipe.ingredients} />

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          {recipe.authorAvatarUrl ? (
                            <img
                              src={recipe.authorAvatarUrl}
                              alt={recipe.authorName || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-sm">
                              {recipe.authorName
                                ?.split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {recipe.authorName || t.recipe.authorFallbackName || 'User'}
                          </p>
                          <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {recipe.authorType === 'Nutritionist'
                              ? t.profile.nutricionist
                              : t.profile.client}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{t.recipe.postedOn}</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300 ml-auto">
                          {formatDate(recipe.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <RecipeReviewSection
                  recipeId={recipe.id}
                  reviews={recipe.reviews}
                  rating={recipe.rating}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLogModalOpen && (
        <RecipeLogModal
          recipe={recipe}
          onClose={() => setIsLogModalOpen(false)}
        />
      )}
      {isEditModalOpen && (
        <EditRecipeForm
          recipe={recipe}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </>
  );
}
