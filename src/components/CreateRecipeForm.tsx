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

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm md:text-base text-slate-900 ' +
  'shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/70 ' +
  'dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50';

const labelClass =
  'block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const sectionCardClass =
  'rounded-2xl border border-slate-100/80 bg-white/90 p-4 shadow-sm ' +
  'dark:border-slate-800 dark:bg-slate-900/80 sm:p-5';

const sectionTitleClass =
  'text-sm font-semibold text-slate-800 dark:text-slate-100 sm:text-base';

interface FormSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn(sectionCardClass, className)}>
      {(title || description) && (
        <header className="mb-3 flex items-start justify-between gap-2">
          <div>
            {title && <h3 className={sectionTitleClass}>{title}</h3>}
            {description && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                {description}
              </p>
            )}
          </div>
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

  const hasImage = recipe.image && recipe.image.trim().length > 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950/80 via-slate-900/85 to-emerald-900/80 p-4 backdrop-blur-md">
      <div className="relative flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/95 shadow-[0_30px_80px_rgba(15,23,42,0.75)]">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/90 text-slate-400 shadow-lg ring-1 ring-slate-700/80 transition hover:scale-105 hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-900/60 px-6 pb-4 pt-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {t.recipe.CreateNewRecipe}
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl">
                {t.recipe.recipeTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {t.recipe.details}
              </p>
            </div>

            {/* Preview mini da imagem */}
            <div className="mt-2 hidden items-center gap-2 sm:flex">
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Preview
                </p>
                <p className="text-[11px] text-slate-500">
                  {hasImage ? 'Imagem carregada' : 'Cole uma URL para ver a imagem'}
                </p>
              </div>
              <div className="h-16 w-24 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800/80">
                {hasImage ? (
                  <img
                    src={recipe.image}
                    alt={String(recipe.title || 'Recipe image')}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                    {t.recipe.recipeImageURL}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 px-4 pb-6 pt-4 text-sm sm:space-y-5 sm:px-6 md:px-7"
        >
          {/* Linha principal: título/descrição ↔ imagem + meta */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)]">
            <FormSection
              title={t.recipe.CreateNewRecipe}
              description={t.recipe.details}
            >
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>{t.recipe.recipeTitle}</label>
                  <input
                    type="text"
                    value={recipe.title}
                    onChange={(e) =>
                      setRecipe((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className={cn(inputClass, 'mt-1')}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>{t.recipe.recipeDescription}</label>
                  <textarea
                    value={recipe.description}
                    onChange={(e) =>
                      setRecipe((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className={cn(inputClass, 'mt-1 min-h-[96px] resize-y')}
                    rows={3}
                    required
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title={t.recipe.recipeImageURL}>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>URL</label>
                  <input
                    type="url"
                    value={recipe.image}
                    onChange={(e) =>
                      setRecipe((prev) => ({ ...prev, image: e.target.value }))
                    }
                    className={cn(inputClass, 'mt-1')}
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
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
                      className={cn(inputClass, 'mt-1')}
                      min={1}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t.recipe.difficulty}</label>
                    <select
                      value={recipe.difficulty}
                      onChange={(e) =>
                        setRecipe((prev) => ({
                          ...prev,
                          difficulty: e.target.value as Recipe['difficulty'],
                        }))
                      }
                      className={cn(inputClass, 'mt-1')}
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

                  <div>
                    <label className={labelClass}>
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
                      className={cn(inputClass, 'mt-1')}
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
            </FormSection>
          </div>

          {/* Ingredientes */}
          <FormSection
            title={t.recipe.ingredients}
            description={t.recipe.addIngredient}
          >
            <div className="space-y-2">
              {recipe.ingredients?.map((ingredient, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-xl bg-slate-900/70 p-2 ring-1 ring-slate-800"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) =>
                      handleArrayInput('ingredients', index, e.target.value)
                    }
                    className={cn(
                      inputClass,
                      'flex-1 border-none bg-transparent shadow-none focus:ring-0'
                    )}
                    placeholder={t.recipe.example}
                    required
                  />
                  {recipe.ingredients!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('ingredients', index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-300 ring-1 ring-red-500/40 transition hover:bg-red-500/20 hover:text-red-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25"
              >
                <Plus className="h-4 w-4" />
                {t.common.add}
              </button>
            </div>
          </FormSection>

          {/* Modo de preparo */}
          <FormSection
            title={t.recipe.instructions}
            description={t.recipe.addStep}
          >
            <div className="space-y-2">
              {recipe.instructions?.map((instruction, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-xl bg-slate-900/70 p-2 ring-1 ring-slate-800"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/40">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={instruction}
                    onChange={(e) =>
                      handleArrayInput('instructions', index, e.target.value)
                    }
                    className={cn(
                      inputClass,
                      'flex-1 border-none bg-transparent shadow-none focus:ring-0'
                    )}
                    placeholder={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  {recipe.instructions!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('instructions', index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-300 ring-1 ring-red-500/40 transition hover:bg-red-500/20 hover:text-red-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-300 ring-1 ring-sky-500/40 transition hover:bg-sky-500/25"
              >
                <Plus className="h-4 w-4" />
                {t.common.add}
              </button>
            </div>
          </FormSection>

          {/* Valores nutricionais */}
          <FormSection title={t.recipe.nutritionFacts}>
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-5">
              {Object.entries(recipe.nutritionFacts || {}).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-slate-900/70 p-3 ring-1 ring-slate-800"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {t.profile.nutritionGoalsnames[nutritionKey]}
                    </p>
                    <div className="mt-1 flex items-end justify-between gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={value}
                        onChange={(e) =>
                          handleNutritionChange(key, e.target.value)
                        }
                        className={cn(
                          inputClass,
                          'mt-0 h-9 bg-slate-950/60 text-sm shadow-none focus:ring-0'
                        )}
                        placeholder="0.00"
                        required
                      />
                      <span className="pb-[2px] text-[11px] text-slate-500">
                        g
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>

          {/* Botão salvar */}
          <div className="sticky bottom-0 mt-2 border-t border-slate-800/80 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-4">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.45)] ' +
                  'transition hover:bg-emerald-400 hover:shadow-[0_20px_55px_rgba(16,185,129,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ' +
                  'disabled:cursor-not-allowed disabled:bg-emerald-700/70 disabled:text-slate-300',
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
