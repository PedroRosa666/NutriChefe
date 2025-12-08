import React, { useState } from 'react';
import { Minus, Plus, Sparkles, X } from 'lucide-react';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import type { Recipe } from '../types/recipe';

type CategoryKey = keyof ReturnType<typeof useTranslation>['categories'];

interface CreateRecipeFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-200/80 bg-white/70 px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-800/60';

const sectionClass =
  'space-y-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/70 p-4 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80';

export function CreateRecipeForm({ isOpen, onClose }: CreateRecipeFormProps) {
  const { user } = useAuthStore();
  const { createRecipe } = useRecipesStore();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);

  const [recipe, setRecipe] = useState<Partial<Recipe>>({
    title: '',
    description: '',
    image: '',
    prepTime: 30,
    difficulty: 'medium',
    category: 'vegan',
    ingredients: [''],
    instructions: [''],
    nutritionFacts: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    },
  });

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const recipeData = {
        ...recipe,
        authorId: user.id,
        rating: 0,
        reviews: [],
      } as Recipe;

      await createRecipe(recipeData);

      setRecipe({
        title: '',
        description: '',
        image: '',
        prepTime: 30,
        difficulty: 'medium',
        category: 'vegan',
        ingredients: [''],
        instructions: [''],
        nutritionFacts: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        },
      });

      onClose();
    } catch (error) {
      console.error('Error creating recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArrayInput = (
    field: 'ingredients' | 'instructions',
    index: number,
    value: string
  ) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: prev[field]?.map((item, i) => (i === index ? value : item)),
    }));
  };

  const addArrayItem = (field: 'ingredients' | 'instructions') => {
    setRecipe((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }));
  };

  const removeArrayItem = (
    field: 'ingredients' | 'instructions',
    index: number
  ) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index),
    }));
  };

  const handleNutritionChange = (key: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setRecipe((prev) => ({
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/80 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {t.recipe.CreateNewRecipe}
              </h2>
              <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                {t.recipe.details}
              </p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="px-6 pb-7 pt-5 space-y-6 text-base bg-white/70 dark:bg-slate-900/60"
        >
          {/* Título / Imagem */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className={sectionClass}>
              <div className="space-y-1">
                <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.recipeTitle}
                </label>
                <input
                  type="text"
                  value={recipe.title}
                  onChange={(e) =>
                    setRecipe((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.recipeImageURL}
                </label>
                <input
                  type="url"
                  value={recipe.image}
                  onChange={(e) =>
                    setRecipe((prev) => ({ ...prev, image: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="https://example.com/image.jpg"
                  required
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t.recipe.example}
                </p>
              </div>
            </div>

            <div className={sectionClass}>
              <div className="space-y-1">
                <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.recipeDescription}
                </label>
                <textarea
                  value={recipe.description}
                  onChange={(e) =>
                    setRecipe((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className={cn(inputClass, 'min-h-[140px] resize-none')}
                  rows={4}
                  required
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t.recipe.details}
                </p>
              </div>
            </div>
          </div>

          {/* Tempo / dificuldade / categoria */}
          <div className={sectionClass}>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.prepTime} (min)
                </label>
                <input
                  type="number"
                  value={recipe.prepTime}
                  onChange={(e) =>
                    setRecipe((prev) => ({
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
                <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.difficulty}
                </label>
                <select
                  value={recipe.difficulty}
                  onChange={(e) =>
                    setRecipe((prev) => ({
                      ...prev,
                      difficulty: e.target.value as Recipe['difficulty'],
                    }))
                  }
                  className={cn(inputClass, 'pr-10')}
                  required
                >
                  <option value="easy">{t.recipe.difficultyLevels.easy}</option>
                  <option value="medium">{t.recipe.difficultyLevels.medium}</option>
                  <option value="hard">{t.recipe.difficultyLevels.hard}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.recipeCategory}
                </label>
                <select
                  value={recipe.category}
                  onChange={(e) =>
                    setRecipe((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className={cn(inputClass, 'pr-10')}
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
          </div>

          {/* Ingredientes */}
          <div className={sectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {t.recipe.ingredients}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t.recipe.example}
                </p>
              </div>
              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Plus className="w-4 h-4" />
                {t.recipe.addIngredient}
              </button>
            </div>

            <div className="space-y-2">
              {recipe.ingredients?.map((ingredient, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) =>
                      handleArrayInput('ingredients', index, e.target.value)
                    }
                    className={inputClass}
                    placeholder={t.recipe.example}
                    required
                  />
                  {recipe.ingredients!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('ingredients', index)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Modo de preparo */}
          <div className={sectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {t.recipe.instructions}
              </h3>
              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Plus className="w-4 h-4" />
                {t.recipe.addStep}
              </button>
            </div>

            <div className="space-y-2">
              {recipe.instructions?.map((instruction, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={instruction}
                    onChange={(e) =>
                      handleArrayInput('instructions', index, e.target.value)
                    }
                    className={inputClass}
                    placeholder={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  {recipe.instructions!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('instructions', index)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Valores nutricionais */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {t.recipe.nutritionFacts}
              </h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {t.recipe.perServing}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {Object.entries(recipe.nutritionFacts || {}).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t.profile.nutritionGoalsnames[nutritionKey]}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => handleNutritionChange(key, e.target.value)}
                      className={inputClass}
                      placeholder="0.00"
                      required
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botão salvar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-80 dark:shadow-emerald-950/40 dark:focus:ring-offset-slate-900',
                loading && 'opacity-90'
              )}
            >
              {loading && <span className="h-2 w-2 animate-ping rounded-full bg-white" />}
              {loading ? t.common.loading : t.recipe.CreateRecipe}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}