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
        rounded-2xl border shadow-lg transition-all duration-200 
        hover:-translate-y-1 hover:shadow-emerald-500/20 hover:border-emerald-400/70
        bg-slate-50 border-slate-200 
        dark:bg-slate-800/80 dark:border-slate-700
      "
    >
      {/* Imagem + overlays */}
      <div className="relative overflow-hidden rounded-2xl">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src =
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />

        {/* Gradiente sutil por cima da imagem */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Categoria (canto inferior esquerdo) */}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white backdrop-blur shadow-sm">
          <ChefHat className="h-3.5 w-3.5 text-emerald-300" />
          <span className="truncate max-w-[130px]">{translatedCategory}</span>
        </span>

        {/* Rating pequeno em cima da imagem */}
        <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-medium text-yellow-300 backdrop-blur shadow-sm">
          <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
          <span className="text-[11px]">{displayRating()}</span>
        </div>

        {/* Botão de favorito */}
        {isAuthenticated && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              'absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border text-gray-400 shadow-md transition-all',
              'bg-slate-50/90 border-slate-200 hover:border-rose-200 hover:text-rose-500',
              'dark:bg-slate-900/90 dark:border-slate-700',
              isFavorite && 'text-rose-500 border-rose-300 dark:border-rose-700',
            )}
          >
            <Heart
              className={cn(
                'h-4 w-4',
                isFavorite && 'fill-current',
              )}
            />
          </button>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-grow flex-col p-4 md:p-5">
        <h3 className="mb-1 line-clamp-2 text-lg font-semibold leading-snug text-gray-900 dark:text-white">
          {recipe.title}
        </h3>

        <p className="mb-4 flex-grow line-clamp-3 text-sm text-gray-600 dark:text-gray-300">
          {recipe.description}
        </p>

        {/* Linha de informações */}
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-gray-500 dark:border-slate-700 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">
              {recipe.prepTime}min
            </span>
          </div>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-600 sm:block" />

          <div className="flex items-center gap-1.5">
            <ChefHat className="h-4 w-4 flex-shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap text-xs font-semibold capitalize',
                recipe.difficulty === 'easy' && 'text-emerald-500',
                recipe.difficulty === 'medium' && 'text-yellow-500',
                recipe.difficulty === 'hard' && 'text-red-500',
              )}
            >
              {translatedDifficulty}
            </span>
          </div>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-600 sm:block" />

          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 flex-shrink-0 fill-yellow-400 text-yellow-400" />
            <span className="whitespace-nowrap text-xs font-medium">
              {displayRating()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
