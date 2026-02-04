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
        rounded-2xl border-2 shadow-sm transition-all duration-300
        hover:-translate-y-2 hover:shadow-2xl hover:shadow-emerald-500/15 hover:border-emerald-400
        bg-white border-gray-200
        dark:bg-slate-800 dark:border-slate-700
      "
    >
      {/* Imagem + overlays */}
      <div className="relative overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="h-56 w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src =
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />

        {/* Gradiente por cima da imagem */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Categoria (canto inferior esquerdo) */}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-sm border border-white/20">
          <ChefHat className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate max-w-[130px] text-gray-900 dark:text-white">{translatedCategory}</span>
        </span>

        {/* Rating em cima da imagem */}
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-lg">
          <Star className="h-3.5 w-3.5 fill-amber-900" />
          <span>{displayRating()}</span>
        </div>

        {/* Botão de favorito */}
        {isAuthenticated && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              'absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all duration-300 backdrop-blur-sm',
              'bg-white/95 dark:bg-slate-900/95 border-2',
              isFavorite
                ? 'text-rose-500 border-rose-400 scale-110'
                : 'text-gray-400 dark:text-gray-500 border-white/20 hover:border-rose-300 hover:text-rose-500 hover:scale-110',
            )}
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-all',
                isFavorite && 'fill-current',
              )}
            />
          </button>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-grow flex-col p-5">
        <h3 className="mb-2 line-clamp-2 text-xl font-bold leading-tight text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {recipe.title}
        </h3>

        <p className="mb-4 flex-grow line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {recipe.description}
        </p>

        {/* Linha de informações */}
        <div className="mt-auto flex items-center justify-between border-t-2 border-gray-100 dark:border-slate-700 pt-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">Tempo</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white leading-none mt-0.5">
                {recipe.prepTime}min
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-gray-200 dark:bg-slate-600" />

          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full",
              recipe.difficulty === 'easy' && 'bg-emerald-50 dark:bg-emerald-900/30',
              recipe.difficulty === 'medium' && 'bg-amber-50 dark:bg-amber-900/30',
              recipe.difficulty === 'hard' && 'bg-red-50 dark:bg-red-900/30',
            )}>
              <ChefHat className={cn(
                "h-4 w-4",
                recipe.difficulty === 'easy' && 'text-emerald-600 dark:text-emerald-400',
                recipe.difficulty === 'medium' && 'text-amber-600 dark:text-amber-400',
                recipe.difficulty === 'hard' && 'text-red-600 dark:text-red-400',
              )} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">Nível</span>
              <span
                className={cn(
                  'text-sm font-bold capitalize leading-none mt-0.5',
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
