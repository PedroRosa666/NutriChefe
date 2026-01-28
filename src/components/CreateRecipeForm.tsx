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

const INITIAL_RECIPE: Partial<Recipe> = {
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
};

// Estilos base para evitar repetição
const inputClass =
  'w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm md:text-base text-slate-900 ' +
  'shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/60 ' +
  'dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50';

const labelClass =
  'block text-sm md:text-base font-medium text-slate-700 dark:text-slate-100';

const sectionTitleClass =
  'text-base font-semibold text-slate-800 dark:text-slate-100';

// Componente de seção para manter layout consistente
interface FormSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || description) && (
        <header className="space-y-1">
          {title && <h3 className={sectionTitleClass}>{title}</h3>}
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function CreateRecipeForm({ isOpen, onClose }: CreateRecipeFormProps) {
  const { user } = useAuthStore();
  const { createRecipe } = useRecipesStore();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);

  const [recipe, setRecipe] = useState<Partial<Recipe>>(INITIAL_RECIPE);

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

      setRecipe(INITIAL_RECIPE);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-2xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:scale-105 hover:bg-white hover:text-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-900"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="border-b border-slate-100/80 px-6 pb-4 pt-5 dark:border-slate-800/80 sm:px-7">
          <div className="flex flex-col gap-1">
            <p className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {t.recipe.CreateRecipe}
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 sm:text-2xl">
              {t.recipe.CreateNewRecipe}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 sm:text-base">
              {t.recipe.details}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="space-y-8 px-6 pb-7 pt-5 text-sm sm:text-base sm:px-7"
        >
          {/* Título / Imagem */}
          <FormSection>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.recipeTitle}</label>
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

              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.recipeImageURL}</label>
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
              </div>
            </div>
          </FormSection>

          {/* Descrição */}
          <FormSection description={t.recipe.details}>
            <div className="space-y-1.5">
              <label className={labelClass}>{t.recipe.recipeDescription}</label>
              <textarea
                value={recipe.description}
                onChange={(e) =>
                  setRecipe((prev) => ({ ...prev, description: e.target.value }))
                }
                className={cn(inputClass, 'min-h-[90px] resize-y')}
                rows={3}
                required
              />
            </div>
          </FormSection>

          {/* Tempo / dificuldade / categoria */}
          <FormSection>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className={labelClass}>
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
                <label className={labelClass}>{t.recipe.difficulty}</label>
                <select
                  value={recipe.difficulty}
                  onChange={(e) =>
                    setRecipe((prev) => ({
                      ...prev,
                      difficulty: e.target.value as Recipe['difficulty'],
                    }))
                  }
                  className={inputClass}
                  required
                >
                  <option value="easy">
                    {t.recipe.difficultyLevels.easy}
                  </option>
                  <option value="medium">
                    {t.recipe.difficultyLevels.medium}
                  </option>
                  <option value="hard">
                    {t.recipe.difficultyLevels.hard}
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>{t.recipe.recipeCategory}</label>
                <select
                  value={recipe.category}
                  onChange={(e) =>
                    setRecipe((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
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

          {/* Ingredientes */}
          <FormSection
            title={t.recipe.ingredients}
            description={t.recipe.addIngredient}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t.common.add}
              </span>
              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              >
                <Plus className="h-4 w-4" />
                {t.recipe.addIngredient}
              </button>
            </div>

            <div className="mt-2 space-y-2">
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
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/80 px-2 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          {/* Modo de preparo */}
          <FormSection
            title={t.recipe.instructions}
            description={t.recipe.addStep}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {t.common.add}
              </span>
              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
              >
                <Plus className="h-4 w-4" />
                {t.recipe.addStep}
              </button>
            </div>

            <div className="mt-2 space-y-2">
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
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/80 px-2 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          {/* Valores nutricionais */}
          <FormSection title={t.recipe.nutritionFacts}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {Object.entries(recipe.nutritionFacts || {}).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-200 sm:text-sm">
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
          </FormSection>

          {/* Botão salvar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-md transition ' +
                  'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ' +
                  'disabled:cursor-not-allowed disabled:opacity-80 dark:focus-visible:ring-offset-slate-900',
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