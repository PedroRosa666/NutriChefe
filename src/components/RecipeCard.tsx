import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChefHat, Star, Heart } from 'lucide-react';
import { cn } from '../lib/utils';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import type { Recipe } from '../types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const navigate = useNavigate();
  const { favoriteRecipes, addToFavorites, removeFromFavorites } = useRecipesStore();
  const { isAuthenticated } = useAuthStore();
  const t = useTranslation();

  // Para dificuldade
  const difficultyTranslations = t.recipe.difficultyLevels;
  const translatedDifficulty =
    difficultyTranslations[recipe.difficulty as keyof typeof difficultyTranslations] ||
    recipe.difficulty;

  // Para categorias - mapear corretamente
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

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) return;

    try {
      if (isFavorite) {
        await removeFromFavorites(recipe.id);
      } else {
        await addToFavorites(recipe.id);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Função para exibir rating ou texto "Sem avaliações" com tradução
  const displayRating = () => {
    const noReviewsLabel =
      t.recipes?.noReviews || t.recipe?.noReviews || 'Sem avaliações';

    if (recipe.rating === 0 || !recipe.rating || recipe.reviews?.length === 0) {
      return noReviewsLabel;
    }

    return recipe.rating.toFixed(1);
  };

  return (
    <div
      onClick={() => navigate(`/receita/${recipe.id}`)}
      className="
        group relative flex h-full cursor-pointer flex-col overflow-hidden
        rounded-2xl transition-all duration-300
        hover:-translate-y-2 hover:shadow-2xl
        bg-white dark:bg-slate-800
        shadow-lg hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30
      "
    >
      {/* Imagem + overlays */}
      <div className="relative overflow-hidden h-48">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src =
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />

        {/* Gradiente moderno */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Badge de categoria - modernizado */}
        <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 shadow-lg">
          <ChefHat className="h-3.5 w-3.5 text-white" />
          <span className="truncate max-w-[130px] text-xs font-semibold text-white">{translatedCategory}</span>
        </div>

        {/* Rating badge - redesenhado */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 shadow-lg">
          <Star className="h-3.5 w-3.5 fill-white text-white" />
          <span className="text-xs font-bold text-white">{displayRating()}</span>
        </div>

        {/* Botão de favorito - redesenhado */}
        {isAuthenticated && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              'absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-110',
              isFavorite
                ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white'
                : 'bg-white/95 dark:bg-slate-900/95 text-gray-400 dark:text-gray-500 hover:bg-rose-50 dark:hover:bg-rose-900/30',
            )}
          >
            <Heart
              className={cn(
                'h-4.5 w-4.5 transition-all',
                isFavorite && 'fill-current',
              )}
            />
          </button>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-grow flex-col p-4">
        <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-gray-900 dark:text-white">
          {recipe.title}
        </h3>

        <p className="mb-3 flex-grow line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {recipe.description}
        </p>

        {/* Stats - design completamente novo */}
        <div className="mt-auto flex items-center justify-between rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700/50 dark:to-slate-800/50 p-3">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Tempo</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {recipe.prepTime}'
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-gray-300 dark:bg-slate-600" />

          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Nota</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {displayRating()}
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-gray-300 dark:bg-slate-600" />

          <div className="flex items-center gap-1.5">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg shadow-sm",
              recipe.difficulty === 'easy' && 'bg-gradient-to-br from-emerald-400 to-emerald-500',
              recipe.difficulty === 'medium' && 'bg-gradient-to-br from-amber-400 to-amber-500',
              recipe.difficulty === 'hard' && 'bg-gradient-to-br from-red-400 to-red-500',
            )}>
              <ChefHat className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Nível</span>
              <span
                className={cn(
                  'text-sm font-bold capitalize',
                  recipe.difficulty === 'easy' && 'text-emerald-600 dark:text-emerald-400',
                  recipe.difficulty === 'medium' && 'text-amber-600 dark:text-amber-400',
                  recipe.difficulty === 'hard' && 'text-red-600 dark:text-red-400',
                )}
              >
                {translatedDifficulty}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
