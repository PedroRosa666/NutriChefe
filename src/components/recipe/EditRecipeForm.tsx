import React, { useState } from 'react';
import { X, Plus, Minus, Clock, ChefHat, Image, FileText, UtensilsCrossed, ListOrdered, Activity } from 'lucide-react';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import type { Recipe } from '../../types/recipe';

type CategoryKey = keyof ReturnType<typeof useTranslation>['categories'];

const inputClass =
  'w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm md:text-base text-slate-900 ' +
  'shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/60 ' +
  'dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50';

const labelClass =
  'block text-sm md:text-base font-medium text-slate-700 dark:text-slate-100';

interface FormSectionProps {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function FormSection({ title, icon, action, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                {icon}
              </span>
            )}
            {title && (
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {title}
              </h3>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface EditRecipeFormProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

export function EditRecipeForm({ recipe, isOpen, onClose }: EditRecipeFormProps) {
  const { updateRecipe } = useRecipesStore();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState<Recipe>(recipe);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateRecipe(editedRecipe);
      onClose();
    } catch (error) {
      console.error('Error updating recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArrayInput = (
    field: 'ingredients' | 'instructions',
    index: number,
    value: string
  ) => {
    setEditedRecipe((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  const addArrayItem = (field: 'ingredients' | 'instructions') => {
    setEditedRecipe((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const removeArrayItem = (
    field: 'ingredients' | 'instructions',
    index: number
  ) => {
    setEditedRecipe((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleNutritionChange = (key: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setEditedRecipe((prev) => ({
      ...prev,
      nutritionFacts: {
        ...prev.nutritionFacts,
        [key]: numericValue,
      },
    }));
  };

  const translatedCategories = (Object.keys(t.categories) as CategoryKey[])
    .filter((key) => key !== 'all')
    .map((key) => ({
      value: key,
      label: t.categories[key],
    }));

  const nutritionUnits: Record<string, string> = {
    calories: 'kcal',
    protein: 'g',
    carbs: 'g',
    fat: 'g',
    fiber: 'g',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-2xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:scale-105 hover:bg-white hover:text-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-900"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        <div className="border-b border-slate-100/80 px-6 pb-4 pt-5 dark:border-slate-800/80 sm:px-7">
          <div className="flex flex-col gap-1">
            <p className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {t.recipe.edit || 'Editar Receita'}
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 sm:text-2xl">
              {editedRecipe.title || t.recipe.edit}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 sm:text-base">
              {t.recipe.details}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 px-6 pb-7 pt-5 text-sm sm:text-base sm:px-7"
        >
          <FormSection
            title={t.recipe.recipeTitle}
            icon={<FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.recipeTitle}</label>
                <input
                  type="text"
                  value={editedRecipe.title}
                  onChange={(e) =>
                    setEditedRecipe((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.recipeImageURL}</label>
                <input
                  type="url"
                  value={editedRecipe.image}
                  onChange={(e) =>
                    setEditedRecipe((prev) => ({ ...prev, image: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="https://example.com/image.jpg"
                  required
                />
              </div>
            </div>

            {editedRecipe.image && (
              <div className="relative mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <img
                  src={editedRecipe.image}
                  alt={editedRecipe.title}
                  className="h-40 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow backdrop-blur-sm dark:bg-slate-900/90 dark:text-slate-200">
                  <Image className="h-3 w-3" />
                  Preview
                </div>
              </div>
            )}
          </FormSection>

          <FormSection>
            <div className="space-y-1.5">
              <label className={labelClass}>{t.recipe.recipeDescription}</label>
              <textarea
                value={editedRecipe.description}
                onChange={(e) =>
                  setEditedRecipe((prev) => ({ ...prev, description: e.target.value }))
                }
                className={cn(inputClass, 'min-h-[90px] resize-y')}
                rows={3}
                required
              />
            </div>
          </FormSection>

          <FormSection
            title={t.recipe.prepTime}
            icon={<Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          >
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  {t.recipe.prepTime} (min)
                </label>
                <input
                  type="number"
                  value={editedRecipe.prepTime}
                  onChange={(e) =>
                    setEditedRecipe((prev) => ({
                      ...prev,
                      prepTime: Number(e.target.value),
                    }))
                  }
                  className={inputClass}
                  min={1}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.difficulty}</label>
                <select
                  value={editedRecipe.difficulty}
                  onChange={(e) =>
                    setEditedRecipe((prev) => ({
                      ...prev,
                      difficulty: e.target.value as Recipe['difficulty'],
                    }))
                  }
                  className={inputClass}
                  required
                >
                  <option value="easy">{t.recipe.difficultyLevels.easy}</option>
                  <option value="medium">{t.recipe.difficultyLevels.medium}</option>
                  <option value="hard">{t.recipe.difficultyLevels.hard}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.recipeCategory}</label>
                <select
                  value={editedRecipe.category}
                  onChange={(e) =>
                    setEditedRecipe((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className={inputClass}
                  required
                >
                  {translatedCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection
            title={t.recipe.ingredients}
            icon={<UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            action={
              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.recipe.addIngredient}
              </button>
            }
          >
            <div className="space-y-2">
              {editedRecipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) =>
                      handleArrayInput('ingredients', index, e.target.value)
                    }
                    className={cn(inputClass, 'flex-1')}
                    placeholder={t.recipe.example}
                    required
                  />
                  {editedRecipe.ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('ingredients', index)}
                      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection
            title={t.recipe.instructions}
            icon={<ListOrdered className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            action={
              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.recipe.addStep}
              </button>
            }
          >
            <div className="space-y-2">
              {editedRecipe.instructions.map((instruction, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={instruction}
                    onChange={(e) =>
                      handleArrayInput('instructions', index, e.target.value)
                    }
                    className={cn(inputClass, 'flex-1')}
                    placeholder={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  {editedRecipe.instructions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('instructions', index)}
                      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection
            title={t.recipe.nutritionFacts}
            icon={<Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          >
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {Object.entries(editedRecipe.nutritionFacts).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-200 sm:text-sm">
                      {t.profile.nutritionGoalsnames[nutritionKey]}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={value}
                        onChange={(e) =>
                          handleNutritionChange(key, e.target.value)
                        }
                        className={cn(inputClass, 'pr-10')}
                        placeholder="0.00"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 dark:text-slate-500">
                        {nutritionUnits[key] || ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex-[2] inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-md transition ' +
                  'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ' +
                  'disabled:cursor-not-allowed disabled:opacity-80 dark:focus-visible:ring-offset-slate-900',
                loading && 'opacity-80'
              )}
            >
              {loading ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
