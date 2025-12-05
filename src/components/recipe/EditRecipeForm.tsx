import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import type { Recipe } from '../../types/recipe';

type CategoryKey = keyof ReturnType<typeof useTranslation>['categories'];

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

  const removeArrayItem = (field: 'ingredients' | 'instructions', index: number) => {
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

  // Traduções
  const editRecipe = t.recipe.edit || 'Editar Receita';
  const title = t.recipe.recipeTitle;
  const description = t.recipe.recipeDescription;
  const imageURL = t.recipe.recipeImageURL;
  const prepTime = t.recipe.prepTime;
  const difficulty = t.recipe.difficulty;
  const category = t.recipe.recipeCategory;
  const ingredients = t.recipe.ingredients;
  const instructions = t.recipe.instructions;
  const nutritionFacts = t.recipe.nutritionFacts;
  const addIngredient = t.recipe.addIngredient;
  const addStep = t.recipe.addStep;

  const translatedCategories = (Object.keys(t.categories) as CategoryKey[]).map((key) => ({
    value: key,
    label: t.categories[key],
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white/95 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-6 pt-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50">
                {editRecipe}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t.recipe.details}
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              {t.categories[editedRecipe.category as CategoryKey] ?? t.categories.all}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-6 text-sm">
          {/* Linha 1: título + imagem */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {title}
              </label>
              <input
                type="text"
                value={editedRecipe.title}
                onChange={(e) =>
                  setEditedRecipe((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {imageURL}
              </label>
              <input
                type="url"
                value={editedRecipe.image}
                onChange={(e) =>
                  setEditedRecipe((prev) => ({ ...prev, image: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {description}
            </label>
            <textarea
              value={editedRecipe.description}
              onChange={(e) =>
                setEditedRecipe((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              rows={3}
              required
            />
          </div>

          {/* Linha 2: tempo / dificuldade / categoria */}
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {prepTime}
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                min={1}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {difficulty}
              </label>
              <select
                value={editedRecipe.difficulty}
                onChange={(e) =>
                  setEditedRecipe((prev) => ({
                    ...prev,
                    difficulty: e.target.value as Recipe['difficulty'],
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              >
                <option value="easy">{t.recipe.difficultyLevels.easy}</option>
                <option value="medium">{t.recipe.difficultyLevels.medium}</option>
                <option value="hard">{t.recipe.difficultyLevels.hard}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {category}
              </label>
              <select
                value={editedRecipe.category}
                onChange={(e) =>
                  setEditedRecipe((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
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
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 dark:bg-slate-900/40 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
                {ingredients}
              </label>
              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                <Plus className="w-3 h-3" />
                {addIngredient}
              </button>
            </div>

            <div className="space-y-2">
              {editedRecipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) =>
                      handleArrayInput('ingredients', index, e.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                    placeholder={t.recipe.example}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeArrayItem('ingredients', index)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50 px-2 text-red-500 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Modo de preparo */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 dark:bg-slate-900/40 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
                {instructions}
              </label>
              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                <Plus className="w-3 h-3" />
                {addStep}
              </button>
            </div>

            <div className="space-y-2">
              {editedRecipe.instructions.map((instruction, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={instruction}
                    onChange={(e) =>
                      handleArrayInput('instructions', index, e.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                    placeholder={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeArrayItem('instructions', index)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50 px-2 text-red-500 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Valores nutricionais */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 dark:bg-slate-900/40 dark:border-slate-800 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300 mb-3">
              {nutritionFacts}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(editedRecipe.nutritionFacts).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-200">
                      {t.profile.nutritionGoalsnames[nutritionKey]}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) =>
                        handleNutritionChange(key, e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
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
                'inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400',
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
