import React, { useState } from 'react';
import {
  Star,
  Clock,
  ChefHat,
  Heart,
  Edit,
  Trash2,
  User,
  Calendar,
  Edit2,
  X,
  UtensilsCrossed,
  PlusCircle,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useRecipesStore } from '../store/recipes';
import { useNutritionTrackingStore } from '../store/nutrition-tracking';
import { useToastStore } from '../store/toast';
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
  const [editingReview, setEditingReview] = useState<{
    id: string;
    rating: number;
    comment: string;
  } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logServings, setLogServings] = useState(1);
  const [logDate, setLogDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const { user, isAuthenticated } = useAuthStore();
  const {
    favoriteRecipes,
    addToFavorites,
    removeFromFavorites,
    addReview,
    updateReview,
    deleteReview,
    deleteRecipe,
  } = useRecipesStore();
  const { addRecipeToLog } = useNutritionTrackingStore();
  const { showToast } = useToastStore();
  const t = useTranslation();

  const difficultyTranslations = t.recipe.difficultyLevels;
  const translatedDifficulty =
    difficultyTranslations[
      recipe.difficulty as keyof typeof difficultyTranslations
    ] || recipe.difficulty;

  // Tradução de categoria
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
  const isFavorite = favoriteRecipes.includes(recipe.id);
  const isAuthor = user?.id === recipe.authorId;

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addReview(recipe.id, {
        userId: user.id,
        userName: user.name,
        rating: newReview.rating,
        comment: newReview.comment,
        date: new Date().toISOString().split('T')[0],
      });
      setNewReview({ rating: 5, comment: '' });
    } catch (error) {
      console.error('Error adding review:', error);
    }
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;

    try {
      await updateReview(editingReview.id, {
        rating: editingReview.rating,
        comment: editingReview.comment,
      });
      setEditingReview(null);
    } catch (error) {
      console.error('Error updating review:', error);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (window.confirm(t.recipe.deleteReviewConfirm || 'Tem certeza que deseja excluir esta avaliação?')) {
      try {
        await deleteReview(reviewId);
      } catch (error) {
        console.error('Error deleting review:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (window.confirm(t.recipe.deleteConfirm)) {
      await deleteRecipe(recipe.id);
      onClose();
    }
  };

  // Função para formatar valores nutricionais com decimais
  const formatNutritionValue = (value: number) => {
    return Number(value).toFixed(1);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Função para exibir rating com tradução
  const displayRating = () => {
    const noReviewsLabel = t.recipe.noReviews || 'Sem avaliações';
    const reviewSingular = t.recipe.reviewSingular || 'avaliação';
    const reviewPlural = t.recipe.reviewPlural || 'avaliações';

    if (recipe.rating === 0 || !recipe.rating || recipe.reviews.length === 0) {
      return noReviewsLabel;
    }

    const label = recipe.reviews.length === 1 ? reviewSingular : reviewPlural;
    return `${recipe.rating.toFixed(1)} (${recipe.reviews.length} ${label})`;
  };

  const ingredientsCountLabel =
    recipe.ingredients.length === 1
      ? t.recipe.ingredientsCountSingular || 'item'
      : t.recipe.ingredientsCountPlural || 'itens';

  // Verificar se o usuário já avaliou esta receita
  const userReview = recipe.reviews.find((review) => review.userId === user?.id);
  const canAddReview = isAuthenticated && !userReview;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto z-50">
        <div className="min-h-screen flex items-center justify-center p-4 py-8">
          <div className="relative max-w-6xl w-full">
            <div className="absolute -top-10 right-0 hidden md:block text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">
              {t.recipe.details || 'Detalhes da receita'}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Cabeçalho com botão de fechar */}
              <div className="flex items-center justify-between px-6 md:px-8 pt-5 pb-4 border-b border-gray-200 dark:border-gray-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t.recipe.recipe || 'Receita'}
                </span>
                <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label={t.common.close || 'Fechar'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 md:px-8 pb-8 pt-6">
                {/* GRID PRINCIPAL */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* COLUNA ESQUERDA */}
                  <div className="space-y-5">
                    <div className="relative group">
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-64 object-cover rounded-xl shadow-md border border-gray-200 dark:border-gray-700"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg bg-white/90 dark:bg-gray-900/90 px-3 py-2 text-sm font-semibold shadow-lg backdrop-blur-sm">
                        <ChefHat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-gray-900 dark:text-white">{translatedCategory}</span>
                      </div>
                    </div>

                    {/* Informações do Autor */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md">
                            {recipe.authorAvatarUrl ? (
                              <img
                                src={recipe.authorAvatarUrl}
                                alt={recipe.authorName || 'Autor'}
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
                          <div>
                            <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                              {t.recipe.author || 'Autor'}
                            </h4>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                              {recipe.authorName || 'Usuário'}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          {recipe.authorType === 'Nutritionist'
                            ? t.profile.nutricionist
                            : t.profile.client}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-black/10 rounded-lg px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          {t.recipe.postedOn || 'Postado em'}
                        </span>
                        <span className="font-semibold">
                          {formatDate(recipe.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Ingredientes */}
                    <div className="bg-white dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                            <UtensilsCrossed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          {t.recipe.ingredients}
                        </h3>

                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                          {recipe.ingredients.length} {ingredientsCountLabel}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {recipe.ingredients.map((ingredient, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200 leading-relaxed"
                          >
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-0.5">
                              {index + 1}
                            </span>
                            <span className="flex-1">{ingredient}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* COLUNA DIREITA */}
                  <div className="space-y-5">
                    {/* Título + ações */}
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-3">
                          {recipe.title}
                        </h2>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 text-sm font-semibold">
                            <ChefHat className="w-4 h-4" />
                            {translatedCategory}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {isAuthenticated && (
                          <button
                            onClick={() =>
                              isFavorite
                                ? removeFromFavorites(recipe.id)
                                : addToFavorites(recipe.id)
                            }
                            className={cn(
                              'p-2.5 rounded-full border text-base shadow-sm transition-all',
                              isFavorite
                                ? 'border-red-300 bg-red-50 text-red-500 dark:border-red-700/60 dark:bg-red-900/30'
                                : 'border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 dark:bg-gray-900 dark:border-gray-700',
                            )}
                          >
                            <Heart
                              className={cn(
                                'w-5 h-5',
                                isFavorite && 'fill-current',
                              )}
                            />
                          </button>
                        )}
                        {user?.type === 'Client' && (
                          <button
                            onClick={() => setIsLogModalOpen(true)}
                            className="p-2.5 border rounded-xl transition-all duration-200 border-gray-200 bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-emerald-900/20 dark:hover:border-emerald-700"
                            title={t.profile.addToDiary ?? 'Adicionar ao diário'}
                          >
                            <PlusCircle className="w-5 h-5" />
                          </button>
                        )}
                        {isAuthor && (
                          <>
                            <button
                              onClick={() => setIsEditModalOpen(true)}
                              className="p-2.5 rounded-full border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 shadow-sm transition-colors dark:bg-blue-900/30 dark:border-blue-700/60 dark:hover:bg-blue-900/50"
                              title={t.recipe.edit}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleDelete}
                              className="p-2.5 rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 shadow-sm transition-colors dark:bg-red-900/30 dark:border-red-700/60 dark:hover:bg-red-900/50"
                              title={t.recipe.delete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Meta (tempo, dificuldade, rating) */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.labels.time}</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {recipe.prepTime}min
                        </span>
                      </div>

                      <div className={cn(
                        "p-3 rounded-lg border",
                        recipe.difficulty === 'easy' && 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30',
                        recipe.difficulty === 'medium' && 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30',
                        recipe.difficulty === 'hard' && 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30',
                      )}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <ChefHat className={cn(
                            "w-4 h-4",
                            recipe.difficulty === 'easy' && 'text-emerald-600 dark:text-emerald-400',
                            recipe.difficulty === 'medium' && 'text-amber-600 dark:text-amber-400',
                            recipe.difficulty === 'hard' && 'text-red-600 dark:text-red-400',
                          )} />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.labels.level}</span>
                        </div>
                        <span className={cn(
                          "text-base font-bold capitalize",
                          recipe.difficulty === 'easy' && 'text-emerald-700 dark:text-emerald-300',
                          recipe.difficulty === 'medium' && 'text-amber-700 dark:text-amber-300',
                          recipe.difficulty === 'hard' && 'text-red-700 dark:text-red-300',
                        )}>
                          {translatedDifficulty}
                        </span>
                      </div>

                      <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-800/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.labels.rating}</span>
                        </div>
                        <span className="text-base sm:text-xl font-bold text-gray-900 dark:text-white break-words leading-tight">
                          {displayRating()}
                        </span>
                      </div>
                    </div>

                    {/* Descrição */}
                    <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-base text-gray-700 dark:text-gray-200 leading-relaxed">
                        {recipe.description}
                      </p>
                    </div>

                    {/* Fatos nutricionais */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                          <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {t.recipe.nutritionFacts}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {t.profile.nutritionGoalsnames.calories}
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatNutritionValue(recipe.nutritionFacts.calories)}
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">kcal</span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {t.profile.nutritionGoalsnames.protein}
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatNutritionValue(recipe.nutritionFacts.protein)}
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">g</span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {t.profile.nutritionGoalsnames.carbs}
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatNutritionValue(recipe.nutritionFacts.carbs)}
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">g</span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {t.profile.nutritionGoalsnames.fat}
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatNutritionValue(recipe.nutritionFacts.fat)}
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">g</span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 col-span-2">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {t.profile.nutritionGoalsnames.fiber}
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatNutritionValue(recipe.nutritionFacts.fiber)}
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">g</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Instruções */}
                    <div className="bg-white dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                          <UtensilsCrossed className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {t.recipe.instructions}
                      </h3>

                      <ol className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {recipe.instructions.map((instruction, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200 leading-relaxed"
                          >
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-0.5">
                              {index + 1}
                            </span>
                            <span className="flex-1">{instruction}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>

                {/* ÁREA DE AVALIAÇÕES */}
                <div className="mt-10 space-y-6 border-t border-gray-100 dark:border-gray-800 pt-6">
                  {/* título + resumo */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      {t.recipe.reviews} ({recipe.reviews.length})
                    </h3>

                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      {displayRating()}
                    </span>
                  </div>

                  {/* Formulário para adicionar nova avaliação */}
                  {canAddReview && (
                    <form
                      onSubmit={handleAddReview}
                      className={cn(
                        'rounded-xl p-4 space-y-3',
                        'bg-emerald-50/80 shadow-sm ring-1 ring-emerald-100',
                        'dark:bg-gray-900/50 dark:ring-0 dark:border-l-4 dark:border-emerald-500/80',
                      )}
                    >
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {t.recipe.addReviewTitle}
                      </h4>

                      <div className="flex items-center gap-2">
                        <span className="text-base text-gray-700 dark:text-gray-300">
                          {t.recipe.rating}:
                        </span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() =>
                              setNewReview((prev) => ({
                                ...prev,
                                rating: star,
                              }))
                            }
                            className={cn(
                              'text-3xl transition-colors',
                              star <= newReview.rating
                                ? 'text-yellow-400'
                                : 'text-gray-300 dark:text-gray-600',
                            )}
                          >
                            ★
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={newReview.comment}
                        onChange={(e) =>
                          setNewReview((prev) => ({
                            ...prev,
                            comment: e.target.value,
                          }))
                        }
                        placeholder={t.recipe.writeReview}
                        className="w-full p-3 rounded-lg text-base placeholder:text-gray-500 bg-white border border-gray-300 text-gray-900 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        rows={4}
                        required
                      />

                      <button
                        type="submit"
                        className="inline-flex px-5 py-2.5 bg-emerald-600 text-white text-base rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                      >
                        {t.recipe.submitReview}
                      </button>
                    </form>
                  )}

                  {/* Formulário para editar avaliação */}
                  {editingReview && (
                    <form
                      onSubmit={handleUpdateReview}
                      className={cn(
                        'rounded-xl p-4 space-y-3',
                        'bg-blue-50/80 ring-1 ring-blue-200 shadow-sm',
                        'dark:bg-blue-900/30 dark:ring-0 dark:border dark:border-blue-700/70',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                          {t.recipe.editReviewTitle}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingReview(null)}
                          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-base text-gray-700 dark:text-gray-300">
                          {t.recipe.reviewLabel || 'Avaliação:'}
                        </span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() =>
                              setEditingReview((prev) =>
                                prev ? { ...prev, rating: star } : null,
                              )
                            }
                            className={cn(
                              'text-3xl transition-colors',
                              star <= editingReview.rating
                                ? 'text-yellow-400'
                                : 'text-gray-300 dark:text-gray-600',
                            )}
                          >
                            ★
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={editingReview.comment}
                        onChange={(e) =>
                          setEditingReview((prev) =>
                            prev ? { ...prev, comment: e.target.value } : prev,
                          )
                        }
                        placeholder={t.recipe.writeReview}
                        className="w-full p-3 rounded-lg text-base placeholder:text-gray-500 bg-white border border-gray-300 text-gray-900 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        rows={4}
                        required
                      />

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {t.common.save}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReview(null)}
                          className="px-5 py-2.5 text-base rounded-lg transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          {t.common.cancel}
                        </button>
                      </div>
                    </form>
                  )}

                  {!isAuthenticated && (
                    <p className="text-base text-gray-500 dark:text-gray-400">
                      {t.recipe.signInToReview}
                    </p>
                  )}

                  {/* Lista de avaliações */}
                  <div className="space-y-3">
                    {recipe.reviews.length === 0 ? (
                      <p className="text-base text-gray-500 dark:text-gray-400">
                        {t.recipe.noReviews}
                      </p>
                    ) : (
                      recipe.reviews.map((review) => {
                        const isUserReview = user?.id === review.userId;
                        return (
                          <div
                            key={review.id}
                            className={cn(
                              'rounded-xl p-4 flex flex-col gap-1',
                              'bg-gray-50 shadow-sm ring-1 ring-gray-200',
                              'dark:bg-gray-900/50 dark:ring-0 dark:border dark:border-gray-800',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                  {review.userName}
                                </p>
                                <p className="text-base text-gray-700 dark:text-gray-300">
                                  {review.comment}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <span
                                      key={i}
                                      className={cn(
                                        'text-xl',
                                        i < review.rating
                                          ? 'text-yellow-400'
                                          : 'text-gray-300 dark:text-gray-600',
                                      )}
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>

                                {isUserReview && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() =>
                                        setEditingReview({
                                          id: review.id,
                                          rating: review.rating,
                                          comment: review.comment,
                                        })
                                      }
                                      className="p-1.5 rounded transition-colors text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/40"
                                      title={t.recipe.editReview}
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteReview(review.id)
                                      }
                                      className="p-1.5 rounded transition-colors text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/40"
                                      title={t.recipe.deleteReview}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <span className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                              {review.date}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t.profile.addToDiary ?? 'Adicionar ao diário'}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {t.profile.addToDiaryHelper ?? 'Registre esta receita no seu dia para acompanhar as metas.'}
                </p>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label={t.common.close ?? 'Fechar'}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t.profile.date ?? 'Data'}
                </label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t.profile.servings ?? 'Porções'}
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={logServings}
                  onChange={(e) => setLogServings(Math.max(0.1, Number(e.target.value) || 1))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t.profile.perServingHint ?? 'Os valores nutricionais são multiplicados pelas porções.'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                {t.common.cancel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  addRecipeToLog(recipe, logServings, logDate);
                  showToast(t.profile.loggedToDiary ?? 'Adicionado ao diário.', 'success');
                  setIsLogModalOpen(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                {t.profile.confirmAdd ?? 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
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
