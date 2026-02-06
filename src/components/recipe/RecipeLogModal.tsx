import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useNutritionTrackingStore } from '../../store/nutrition-tracking';
import { useToastStore } from '../../store/toast';
import type { Recipe } from '../../types/recipe';

interface RecipeLogModalProps {
  recipe: Recipe;
  onClose: () => void;
}

export function RecipeLogModal({ recipe, onClose }: RecipeLogModalProps) {
  const t = useTranslation();
  const { addRecipeToLog } = useNutritionTrackingStore();
  const { showToast } = useToastStore();

  const [servings, setServings] = useState(1);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const handleConfirm = () => {
    addRecipeToLog(recipe, servings, date);
    showToast(t.profile.loggedToDiary ?? 'Added to diary.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t.profile.addToDiary ?? 'Add to diary'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t.profile.addToDiaryHelper ?? 'Log this recipe to track your daily goals.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              {t.profile.date ?? 'Date'}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              {t.profile.servings ?? 'Servings'}
            </label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={servings}
              onChange={(e) => setServings(Math.max(0.1, Number(e.target.value) || 1))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
              {t.profile.perServingHint ?? 'Nutrition values are multiplied by servings.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            {t.common.cancel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            {t.profile.confirmAdd ?? 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
