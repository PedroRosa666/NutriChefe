import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {t.recipe.CreateNewRecipe}
          </h2>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            {t.recipe.details}
          </p>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="px-6 pb-6 pt-4 space-y-6 text-base"
        >
          {/* Título / Imagem */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.recipeTitle}
              </label>
              <input
                type="text"
                value={recipe.title}
                onChange={(e) =>
                  setRecipe((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.recipeImageURL}
              </label>
              <input
                type="url"
                value={recipe.image}
                onChange={(e) =>
                  setRecipe((prev) => ({ ...prev, image: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-base font-medium text-slate-700 dark:text-slate-100">
              {t.recipe.recipeDescription}
            </label>
            <textarea
              value={recipe.description}
              onChange={(e) =>
                setRecipe((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              rows={3}
              required
            />
          </div>

          {/* Tempo / dificuldade / categoria */}
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-base font-medium text-slate-700 dark:text-slate-100">
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                min={1}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-base font-medium text-slate-700 dark:text-slate-100">
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                required
              >
                <option value="easy">{t.recipe.difficultyLevels.easy}</option>
                <option value="medium">{t.recipe.difficultyLevels.medium}</option>
                <option value="hard">{t.recipe.difficultyLevels.hard}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-base font-medium text-slate-700 dark:text-slate-100">
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
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

          {/* Ingredientes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {t.recipe.ingredients}
              </h3>
              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
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
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                    placeholder={t.recipe.example}
                    required
                  />
                  {recipe.ingredients!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('ingredients', index)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Modo de preparo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {t.recipe.instructions}
              </h3>
              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
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
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                    placeholder={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  {recipe.instructions!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('instructions', index)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Valores nutricionais */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t.recipe.nutritionFacts}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(recipe.nutritionFacts || {}).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                      {t.profile.nutritionGoalsnames[nutritionKey]}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => handleNutritionChange(key, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
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
                'inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400',
                loading && 'opacity-80'
              )}
            >
              {loading ? t.common.loading : t.recipe.CreateRecipe}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
