import React, { useState } from 'react';
import { Star, Clock, ChefHat, Heart, Edit, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useRecipesStore } from '../store/recipes';
import { EditRecipeForm } from './recipe/EditRecipeForm';
import type { Recipe } from '../types/recipe';
import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';

interface RecipeDetailsProps {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeDetails({ recipe, onClose }: RecipeDetailsProps) {
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const { favoriteRecipes, addToFavorites, removeFromFavorites, addReview, deleteRecipe } = useRecipesStore();
  const t = useTranslation();

  const difficultyTranslations = t.recipe.difficultyLevels;
  const translatedDifficulty = difficultyTranslations[recipe.difficulty as keyof typeof difficultyTranslations] || recipe.difficulty;

  // Tradução de categoria
  const categoryTranslations = t.categories;
  const getCategoryTranslation = (category: string) => {
    const categoryMap: { [key: string]: keyof typeof categoryTranslations } = {
      'vegan': 'vegan',
      'lowCarb': 'lowCarb',
      'low carb': 'lowCarb',
      'highProtein': 'highProtein',
      'high protein': 'highProtein',
      'glutenFree': 'glutenFree',
      'gluten free': 'glutenFree',
      'vegetarian': 'vegetarian'
    };

    const normalizedCategory = category.toLowerCase().replace(/\s+/g, '');
    const mappedKey = Object.keys(categoryMap).find(key => 
      key.toLowerCase().replace(/\s+/g, '') === normalizedCategory
    );
    
    if (mappedKey) {
      return categoryTranslations[categoryMap[mappedKey]];
    }
    
    const directKey = category as keyof typeof categoryTranslations;
    return categoryTranslations[directKey] || category;
  };

  const translatedCategory = getCategoryTranslation(recipe.category);
  const isFavorite = favoriteRecipes.includes(recipe.id);
  const isAuthor = user?.id === recipe.authorId;

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    addReview(recipe.id, {
      userId: user.id,
      userName: user.name,
      rating: newReview.rating,
      comment: newReview.comment,
      date: new Date().toISOString().split('T')[0]
    });
    setNewReview({ rating: 5, comment: '' });
  };

  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir esta receita?')) {
      await deleteRecipe(recipe.id);
      onClose();
    }
  };

  // Função para formatar valores nutricionais com decimais
  const formatNutritionValue = (value: number) => {
    return Number(value).toFixed(1);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto z-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 relative text-gray-600 dark:text-white dark:bg-gray-800">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>

            <div className="grid md:grid-cols-2 gap-6">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-64 object-cover rounded-lg"
              />

              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{recipe.title}</h2>
                    <span className="inline-block bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
                      {translatedCategory}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {isAuthenticated && (
                      <button
                        onClick={() => isFavorite ? removeFromFavorites(recipe.id) : addToFavorites(recipe.id)}
                        className={cn(
                          "p-2 rounded-full",
                          isFavorite ? "text-red-500" : "text-gray-400"
                        )}
                      >
                        <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
                      </button>
                    )}
                    {isAuthor && (
                      <>
                        <button
                          onClick={() => setIsEditModalOpen(true)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                          title="Editar receita"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleDelete}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                          title="Excluir receita"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 dark:text-gray-300">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{recipe.prepTime}min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ChefHat className="w-4 h-4" />
                    <span className={cn(
                      "capitalize",
                      recipe.difficulty === 'easy' && "text-green-500",
                      recipe.difficulty === 'medium' && "text-yellow-500",
                      recipe.difficulty === 'hard' && "text-red-500"
                    )}>{translatedDifficulty}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{recipe.rating.toFixed(1)} ({recipe.reviews.length} {recipe.reviews.length === 1 ? 'avaliação' : 'avaliações'})</span>
                  </div>
                </div>

                <p className="text-gray-600 mb-4 dark:text-gray-300">{recipe.description}</p>

                {/* Seção de fatos nutricionais com valores decimais formatados */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                  <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t.recipe.nutritionFacts}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <div>{t.profile.nutritionGoalsnames.calories}: {formatNutritionValue(recipe.nutritionFacts.calories)} kcal</div>
                    <div>{t.profile.nutritionGoalsnames.protein}: {formatNutritionValue(recipe.nutritionFacts.protein)} g</div>
                    <div>{t.profile.nutritionGoalsnames.carbs}: {formatNutritionValue(recipe.nutritionFacts.carbs)} g</div>
                    <div>{t.profile.nutritionGoalsnames.fat}: {formatNutritionValue(recipe.nutritionFacts.fat)} g</div>
                    <div>{t.profile.nutritionGoalsnames.fiber}: {formatNutritionValue(recipe.nutritionFacts.fiber)} g</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t.recipe.ingredients}</h3>
                <ul className="list-disc list-inside space-y-1">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-300">{ingredient}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">{t.recipe.instructions}</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {recipe.instructions.map((instruction, index) => (
                    <li key={index} className="text-gray-600 dark:text-gray-300">{instruction}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
                {t.recipe.reviews} ({recipe.reviews.length})
              </h3>
              {isAuthenticated ? (
                <form onSubmit={handleAddReview} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-700 dark:text-gray-300">{t.recipe.rating}:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        className={cn(
                          "text-2xl transition-colors",
                          star <= newReview.rating ? "text-yellow-400" : "text-gray-300"
                        )}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newReview.comment}
                    onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder={t.recipe.writeReview}
                    className="w-full p-2 border border-gray-300 rounded-lg mb-2 text-black"
                    rows={3}
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {t.recipe.submitReview}
                  </button>
                </form>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 mb-4">{t.recipe.signInToReview}</p>
              )}

              <div className="space-y-4">
                {recipe.reviews.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">{t.recipe.noReviews || 'Nenhuma avaliação ainda'}</p>
                ) : (
                  recipe.reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-200 dark:border-gray-700 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">{review.userName}</span>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={cn(
                                "text-lg",
                                i < review.rating ? "text-yellow-400" : "text-gray-300"
                              )}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300">{review.comment}</p>
                      <span className="text-sm text-gray-400">{review.date}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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