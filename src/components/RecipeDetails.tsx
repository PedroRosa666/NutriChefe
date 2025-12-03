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
} from 'lucide-react';
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
  const [editingReview, setEditingReview] = useState<{
    id: string;
    rating: number;
    comment: string;
  } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
  const t = useTranslation();

  const difficultyTranslations = t.recipe.difficultyLevels;
  const translatedDifficulty =
    difficultyTranslations[recipe.difficulty as keyof typeof difficultyTranslations] ||
    recipe.difficulty;

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
    if (window.confirm('Tem certeza que deseja excluir esta avaliação?')) {
      try {
        await deleteReview(reviewId);
      } catch (error) {
        console.error('Error deleting review:', error);
      }
    }
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

  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Função para exibir rating ou "Sem avaliações"
  const displayRating = () => {
    if (recipe.rating === 0 || !recipe.rating) {
      return 'Sem avaliações';
    }
    return `${recipe.rating.toFixed(1)} (${recipe.reviews.length} ${
      recipe.reviews.length === 1 ? 'avaliação' : 'avaliações'
    })`;
  };

  // Verificar se o usuário já avaliou esta receita
  const userReview = recipe.reviews.find((review) => review.userId === user?.id);
  const canAddReview = isAuthenticated && !userReview;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto z-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full">
            <div className="absolute -top-10 right-0 hidden md:block text-sm uppercase tracking-[0.2em] text-gray-300 dark:text-gray-500">
              {t.recipe.details || 'Detalhes da receita'}
            </div>

            <div className="bg-white/95 dark:bg-gray-900/95 rounded-2xl shadow-2xl border border-gray-200/80 dark:border-gray-700/70 overflow-hidden">
              {/* Cabeçalho com botão de fechar */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-medium uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                  {t.recipe.recipe || 'Receita'}
                </span>
                <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 pb-6 pt-2">
                {/* GRID PRINCIPAL */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* COLUNA ESQUERDA */}
                  <div className="space-y-4 md:space-y-6">
                    <div className="relative group">
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-64 object-cover rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/70"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white backdrop-blur">
                        <ChefHat className="w-4 h-4 text-green-400" />
                        <span className="font-medium">{translatedCategory}</span>
                      </div>
                    </div>

                    {/* Informações do Autor */}
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                            <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                              Autor
                            </h4>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {recipe.authorName || 'Usuário'}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
                          {recipe.authorType === 'Nutritionist' ? 'Nutricionista' : 'Cliente'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Postado em
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {formatDate(recipe.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Ingredientes na coluna esquerda */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {t.recipe.ingredients}
                        </h3>
                        <span className="text-sm text-gray-400">
                          {recipe.ingredients.length}{' '}
                          {recipe.ingredients.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <ul className="list-disc list-inside space-y-1.5">
                        {recipe.ingredients.map((ingredient, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                          >
                            {ingredient}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* COLUNA DIREITA */}
                  <div className="space-y-4 md:space-y-5">
                    {/* Título + ações */}
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h2 className="text-3xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">
                          {recipe.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-3 py-1 text-sm font-medium">
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
                                : 'border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 dark:bg-gray-900 dark:border-gray-700'
                            )}
                          >
                            <Heart
                              className={cn(
                                'w-4 h-4',
                                isFavorite && 'fill-current'
                              )}
                            />
                          </button>
                        )}
                        {isAuthor && (
                          <>
                            <button
                              onClick={() => setIsEditModalOpen(true)}
                              className="p-2.5 rounded-full border border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 shadow-sm transition-colors dark:bg-blue-900/30 dark:border-blue-700/60 dark:hover:bg-blue-900/50"
                              title="Editar receita"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleDelete}
                              className="p-2.5 rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 shadow-sm transition-colors dark:bg-red-900/30 dark:border-red-700/60 dark:hover:bg-red-900/50"
                              title="Excluir receita"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Meta (tempo, dificuldade, rating) */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-300 border-y border-gray-100 dark:border-gray-800 py-3">
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {recipe.prepTime}min
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                      <div className="inline-flex items-center gap-1.5">
                        <ChefHat className="w-4 h-4" />
                        <span
                          className={cn(
                            'font-medium capitalize',
                            recipe.difficulty === 'easy' && 'text-green-500',
                            recipe.difficulty === 'medium' && 'text-yellow-500',
                            recipe.difficulty === 'hard' && 'text-red-500'
                          )}
                        >
                          {translatedDifficulty}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                      <div className="inline-flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {displayRating()}
                        </span>
                      </div>
                    </div>

                    {/* Descrição */}
                    <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                      {recipe.description}
                    </p>

                    {/* Fatos nutricionais */}
                    <div className="bg-emerald-50/70 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/60">
                      <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                          <Star className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                        </span>
                        {t.recipe.nutritionFacts}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <div>
                          {t.profile.nutritionGoalsnames.calories}:{' '}
                          <span className="font-semibold">
                            {formatNutritionValue(recipe.nutritionFacts.calories)} kcal
                          </span>
                        </div>
                        <div>
                          {t.profile.nutritionGoalsnames.protein}:{' '}
                          <span className="font-semibold">
                            {formatNutritionValue(recipe.nutritionFacts.protein)} g
                          </span>
                        </div>
                        <div>
                          {t.profile.nutritionGoalsnames.carbs}:{' '}
                          <span className="font-semibold">
                            {formatNutritionValue(recipe.nutritionFacts.carbs)} g
                          </span>
                        </div>
                        <div>
                          {t.profile.nutritionGoalsnames.fat}:{' '}
                          <span className="font-semibold">
                            {formatNutritionValue(recipe.nutritionFacts.fat)} g
                          </span>
                        </div>
                        <div>
                          {t.profile.nutritionGoalsnames.fiber}:{' '}
                          <span className="font-semibold">
                            {formatNutritionValue(recipe.nutritionFacts.fiber)} g
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Instruções */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">
                        {t.recipe.instructions}
                      </h3>
                      <ol className="list-decimal list-inside space-y-2 max-h-64 overflow-y-auto pr-2">
                        {recipe.instructions.map((instruction, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                          >
                            {instruction}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>

                {/* ÁREA DE AVALIAÇÕES */}
                <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-6">
                  <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    {t.recipe.reviews} ({recipe.reviews.length})
                  </h3>

                  {/* Formulário para adicionar nova avaliação */}
                  {canAddReview && (
                    <form
                      onSubmit={handleAddReview}
                      className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <h4 className="text-base font-medium mb-3 text-gray-900 dark:text-white">
                        Adicionar Avaliação
                      </h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t.recipe.rating}:
                        </span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() =>
                              setNewReview((prev) => ({ ...prev, rating: star }))
                            }
                            className={cn(
                              'text-2xl transition-colors',
                              star <= newReview.rating
                                ? 'text-yellow-400'
                                : 'text-gray-300'
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
                        className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-2 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                        rows={3}
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 text-white text-base rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                      >
                        {t.recipe.submitReview}
                      </button>
                    </form>
                  )}

                  {/* Formulário para editar avaliação */}
                  {editingReview && (
                    <form
                      onSubmit={handleUpdateReview}
                      className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-medium text-gray-900 dark:text-white">
                          Editar Avaliação
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingReview(null)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Avaliação:
                        </span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() =>
                              setEditingReview((prev) =>
                                prev ? { ...prev, rating: star } : null
                              )
                            }
                            className={cn(
                              'text-2xl transition-colors',
                              star <= editingReview.rating
                                ? 'text-yellow-400'
                                : 'text-gray-300'
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
                            prev ? { ...prev, comment: e.target.value } : prev
                          )
                        }
                        placeholder="Escreva sua avaliação..."
                        className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg mb-2 text-base text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                        rows={3}
                        required
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Salvar Alterações
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReview(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 text-base rounded-lg hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {!isAuthenticated && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {t.recipe.signInToReview}
                    </p>
                  )}

                  <div className="space-y-4">
                    {recipe.reviews.length === 0 ? (
                      <p className="text-base text-gray-500 dark:text-gray-400">
                        {t.recipe.noReviews || 'Nenhuma avaliação ainda'}
                      </p>
                    ) : (
                      recipe.reviews.map((review) => {
                        const isUserReview = user?.id === review.userId;
                        return (
                          <div
                            key={review.id}
                            className="border-b border-gray-100 dark:border-gray-800 pb-4 last:border-b-0 last:pb-0"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-base font-medium text-gray-900 dark:text-white">
                                {review.userName}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <span
                                      key={i}
                                      className={cn(
                                        'text-lg',
                                        i < review.rating
                                          ? 'text-yellow-400'
                                          : 'text-gray-300'
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
                                      className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                      title="Editar avaliação"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteReview(review.id)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                      title="Excluir avaliação"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-0.5">
                              {review.comment}
                            </p>
                            <span className="text-sm text-gray-400">
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
