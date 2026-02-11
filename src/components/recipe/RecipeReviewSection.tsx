import React, { useState } from 'react';
import { Star, Edit2, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';

interface ReviewData {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

interface RecipeReviewSectionProps {
  recipeId: number;
  reviews: ReviewData[];
  rating: number;
}

function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md';
}) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={cn(
            'transition-colors',
            onChange ? 'cursor-pointer' : 'cursor-default',
          )}
        >
          <Star
            className={cn(
              sizeClass,
              (hover || value) >= star
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-300 dark:text-gray-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function RecipeReviewSection({ recipeId, reviews, rating }: RecipeReviewSectionProps) {
  const t = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const { addReview, updateReview, deleteReview } = useRecipesStore();

  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [editing, setEditing] = useState<{ id: string; rating: number; comment: string } | null>(null);

  const userReview = reviews.find((r) => r.userId === user?.id);
  const canAdd = isAuthenticated && !userReview;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addReview(recipeId, {
        userId: user.id,
        userName: user.name,
        rating: newRating,
        comment: newComment,
        date: new Date().toISOString().split('T')[0],
      });
      setNewRating(5);
      setNewComment('');
    } catch (err) {
      console.error('Error adding review:', err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateReview(editing.id, { rating: editing.rating, comment: editing.comment });
      setEditing(null);
    } catch (err) {
      console.error('Error updating review:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.recipe.deleteReviewConfirm || 'Are you sure you want to delete this review?')) {
      try {
        await deleteReview(id);
      } catch (err) {
        console.error('Error deleting review:', err);
      }
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t.recipe.reviews}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {reviews.length === 0
                ? t.recipe.noReviews
                : `${reviews.length} ${reviews.length === 1 ? t.recipe.reviewSingular : t.recipe.reviewPlural}`}
            </p>
          </div>
        </div>
        {rating > 0 && reviews.length > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{rating.toFixed(1)}</span>
            <div className="flex flex-col items-start">
              <StarRating value={Math.round(rating)} size="sm" />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {reviews.length} {reviews.length === 1 ? t.recipe.reviewSingular : t.recipe.reviewPlural}
              </span>
            </div>
          </div>
        )}
      </div>

      {canAdd && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t.recipe.addReviewTitle}</h4>
          <StarRating value={newRating} onChange={setNewRating} />
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t.recipe.writeReview}
            className="w-full p-3 rounded-lg text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-shadow"
            rows={3}
            required
          />
          <button
            type="submit"
            className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t.recipe.submitReview}
          </button>
        </form>
      )}

      {editing && (
        <form onSubmit={handleUpdate} className="mb-6 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t.recipe.editReviewTitle}</h4>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <StarRating
            value={editing.rating}
            onChange={(v) => setEditing((prev) => (prev ? { ...prev, rating: v } : null))}
          />
          <textarea
            value={editing.comment}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, comment: e.target.value } : null))}
            className="w-full p-3 rounded-lg text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
            rows={3}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.common.save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}

      {!isAuthenticated && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t.recipe.signInToReview}</p>
      )}

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="text-center py-10">
            <Star className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">{t.recipe.noReviews}</p>
          </div>
        ) : (
          reviews.map((review) => {
            const isOwn = user?.id === review.userId;
            return (
              <div
                key={review.id}
                className={cn(
                  'rounded-xl p-4 border transition-colors',
                  isOwn
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-800/30'
                    : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {review.userName
                        ?.split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{review.userName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating value={review.rating} size="sm" />
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{review.date}</span>
                      </div>
                    </div>
                  </div>
                  {isOwn && !editing && (
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setEditing({ id: review.id, rating: review.rating, comment: review.comment })
                        }
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed pl-12">
                  {review.comment}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
