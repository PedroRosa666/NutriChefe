import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChefHat, Star, Heart, User } from 'lucide-react';
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
        rounded-xl border shadow-sm transition-all duration-200
        hover:-translate-y-1 hover:shadow-lg hover:border-emerald-300
        bg-white border-gray-200
        dark:bg-slate-800 dark:border-slate-700
      "
    >
      {/* Imagem + overlays */}
      <div className="relative overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src =
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />

        {/* Gradiente suave por cima da imagem */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Categoria (canto inferior esquerdo) */}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm">
          <ChefHat className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate max-w-[130px] text-gray-900 dark:text-white">{translatedCategory}</span>
        </span>

        {/* Rating em cima da imagem */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-lg bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 text-xs font-semibold shadow-md backdrop-blur-sm">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          <span className="text-gray-900 dark:text-white">{displayRating()}</span>
        </div>

        {/* Botão de favorito */}
        {isAuthenticated && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              'absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-md transition-all duration-200 backdrop-blur-sm',
              'bg-white/90 dark:bg-slate-900/90',
              isFavorite
                ? 'text-rose-500'
                : 'text-gray-400 dark:text-gray-500 hover:text-rose-500',
            )}
          >
            <Heart
              className={cn(
                'h-4 w-4 transition-all',
                isFavorite && 'fill-current',
              )}
            />
          </button>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-grow flex-col p-5">
        <h3 className="mb-2 line-clamp-2 text-lg font-semibold leading-snug text-gray-900 dark:text-white">
          {recipe.title}
        </h3>

        <p className="mb-4 flex-grow line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {recipe.description}
        </p>

        {/* Linha de informações */}
<div className="mt-auto flex items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-700 pt-2">
  
  {/* Tempo */}
  <div className="flex flex-col items-center gap-1 flex-1">
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 shadow-sm">
      <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    </div>

    <div className="flex flex-col items-center gap-0 leading-tight">
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t.labels.time}
      </span>
      <span className="text-sm font-bold text-gray-900 dark:text-white">
        {recipe.prepTime}min
      </span>
    </div>
  </div>

  {/* Rating */}
  <div className="flex flex-col items-center gap-1 flex-1">
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20 shadow-sm">
      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
    </div>

    <div className="flex flex-col items-center gap-0 leading-tight">
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t.labels.rating}
      </span>
      <span className="text-sm font-bold text-gray-900 dark:text-white">
        {displayRating()}
      </span>
    </div>
  </div>

  {/* Dificuldade */}
  <div className="flex flex-col items-center gap-1 flex-1">
    <div
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg shadow-sm bg-gradient-to-br",
        recipe.difficulty === "easy" &&
          "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/20",
        recipe.difficulty === "medium" &&
          "from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20",
        recipe.difficulty === "hard" &&
          "from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20"
      )}
    >
      <ChefHat
        className={cn(
          "h-3.5 w-3.5",
          recipe.difficulty === "easy" &&
            "text-emerald-600 dark:text-emerald-400",
          recipe.difficulty === "medium" &&
            "text-orange-600 dark:text-orange-400",
          recipe.difficulty === "hard" &&
            "text-red-600 dark:text-red-400"
        )}
      />
    </div>

    <div className="flex flex-col items-center gap-0 leading-tight">
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {t.labels.level}
      </span>
      <span
        className={cn(
          "text-sm font-bold capitalize",
          recipe.difficulty === "easy" &&
            "text-emerald-600 dark:text-emerald-400",
          recipe.difficulty === "medium" &&
            "text-orange-600 dark:text-orange-400",
          recipe.difficulty === "hard" &&
            "text-red-600 dark:text-red-400"
        )}
      >
        {translatedDifficulty}
      </span>
    </div>
  </div>
</div>

        {/* Author info */}
        {recipe.authorName && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {recipe.authorAvatarUrl ? (
                <img
                  src={recipe.authorAvatarUrl}
                  alt={recipe.authorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t.recipe.by || 'Por'}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {recipe.authorName}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
