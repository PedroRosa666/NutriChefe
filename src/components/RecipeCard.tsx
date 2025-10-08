import React from 'react';
import { Clock, ChefHat, Star, Heart } from 'lucide-react';
import { cn } from '../lib/utils';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import type { Recipe } from '../types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const { favoriteRecipes, addToFavorites, removeFromFavorites } = useRecipesStore();
  const { isAuthenticated } = useAuthStore();
  const t = useTranslation();

  // Para dificuldade
  const difficultyTranslations = t.recipe.difficultyLevels;
  const translatedDifficulty = difficultyTranslations[recipe.difficulty as keyof typeof difficultyTranslations] || recipe.difficulty;

  // Para categorias - mapear corretamente
  const categoryTranslations = t.categories;
  
  // Função para mapear categoria do banco para chave de tradução
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
    
    // Fallback para categorias diretas
    const directKey = category as keyof typeof categoryTranslations;
    return categoryTranslations[directKey] || category;
  };

  const translatedCategory = getCategoryTranslation(recipe.category);
  const isFavorite = favoriteRecipes.includes(recipe.id);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      return;
    }

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

  // Função para exibir rating ou "Sem avaliações"
  const displayRating = () => {
    if (recipe.rating === 0 || !recipe.rating) {
      return 'Sem avaliações';
    }
    return recipe.rating.toFixed(1);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer flex flex-col h-full"
    >
      <div className="relative">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="w-full h-48 object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
          }}
        />
        <span className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          {translatedCategory}
        </span>
        {isAuthenticated && (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              "absolute top-4 left-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow-md transition-colors",
              isFavorite ? "text-red-500" : "text-gray-400 hover:text-red-500"
            )}
          >
            <Heart className={cn("w-5 h-5", isFavorite && "fill-current")} />
          </button>
        )}
      </div>
      
      {/* Conteúdo principal que cresce */}
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white line-clamp-2">
          {recipe.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3 flex-grow">
          {recipe.description}
        </p>

        {/* Informações fixas no rodapé */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">{recipe.prepTime}min</span>
          </div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 flex-shrink-0" />
            <span className={cn(
              "capitalize whitespace-nowrap",
              recipe.difficulty === 'easy' && "text-green-500",
              recipe.difficulty === 'medium' && "text-yellow-500",
              recipe.difficulty === 'hard' && "text-red-500"
            )}>
              {translatedDifficulty}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
            <span className="whitespace-nowrap text-xs">{displayRating()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}