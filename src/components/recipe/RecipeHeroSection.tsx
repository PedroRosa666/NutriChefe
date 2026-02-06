import { X, Heart, Edit, Trash2, PlusCircle, Clock, Star, ChefHat } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

interface RecipeHeroProps {
  image: string;
  title: string;
  translatedCategory: string;
  difficulty: 'easy' | 'medium' | 'hard';
  translatedDifficulty: string;
  prepTime: number;
  rating: number;
  reviewCount: number;
  isFavorite: boolean;
  isAuthor: boolean;
  isAuthenticated: boolean;
  isClient: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLogMeal: () => void;
}

export function RecipeHeroSection({
  image, title, translatedCategory, difficulty, translatedDifficulty,
  prepTime, rating, reviewCount, isFavorite, isAuthor, isAuthenticated,
  isClient, onClose, onToggleFavorite, onEdit, onDelete, onLogMeal,
}: RecipeHeroProps) {
  const t = useTranslation();

  return (
    <div className="relative overflow-hidden">
      <img
        src={image}
        alt={title}
        className="w-full h-[260px] sm:h-[320px] md:h-[380px] object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop';
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors"
          aria-label={t.common.close}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              onClick={onToggleFavorite}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md transition-all',
                isFavorite
                  ? 'bg-red-500/80 text-white'
                  : 'bg-black/30 text-white/90 hover:bg-black/50',
              )}
            >
              <Heart className={cn('w-5 h-5', isFavorite && 'fill-current')} />
            </button>
          )}
          {isClient && (
            <button
              onClick={onLogMeal}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors"
              title={t.profile.addToDiary}
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          )}
          {isAuthor && (
            <>
              <button
                onClick={onEdit}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors"
                title={t.recipe.edit}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white/90 hover:bg-red-500/80 transition-colors"
                title={t.recipe.delete}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/20">
            <ChefHat className="w-3.5 h-3.5" />
            {translatedCategory}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full backdrop-blur-md px-3 py-1 text-xs font-semibold border',
              difficulty === 'easy' && 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
              difficulty === 'medium' && 'bg-amber-500/20 text-amber-200 border-amber-400/30',
              difficulty === 'hard' && 'bg-red-500/20 text-red-200 border-red-400/30',
            )}
          >
            {translatedDifficulty}
          </span>
        </div>

        <h1 className="text-2xl md:text-4xl font-bold text-white mb-4 leading-tight drop-shadow-lg">
          {title}
        </h1>

        <div className="flex items-center gap-4 md:gap-6 text-white/80 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/60" />
            <span className="text-sm font-semibold">{prepTime}min</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-semibold">
              {rating > 0 && reviewCount > 0
                ? `${rating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? t.recipe.reviewSingular : t.recipe.reviewPlural})`
                : t.recipe.noReviews}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
