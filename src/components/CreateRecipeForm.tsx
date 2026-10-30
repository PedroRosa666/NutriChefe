import React, { useRef, useState, useId } from 'react';
import { useDialog } from '../hooks/useDialog';
import { X, Plus, Minus } from 'lucide-react';
import { useRecipesStore } from '../store/recipes';
import { confirmDialog } from '../store/confirm';
import { useAuthStore } from '../store/auth';
import { RecipeImageInput } from './recipe/RecipeImageInput';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { confirmDietCategory } from '../lib/recipe-diet';
import type { Recipe, RecipeIngredient } from '../types/recipe';
import { RecipeIngredientsField } from './recipe/RecipeIngredientsField';
import { RecipeNutritionField } from './recipe/RecipeNutritionField';
import { emptyIngredient, nutritionDraftFrom, nutritionDraftMessage, readNutritionDraft, type NutritionDraft } from '../lib/recipe-nutrition';
import { useToastStore } from '../store/toast';
import { useIngredientCalc } from '../hooks/useIngredientCalc';

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
  // Sem categoria marcada: o autor escolhe (antes vinha "Vegana" e muita receita ficou com o rótulo errado).
  category: '',
  ingredients: [],
  instructions: [''],
  nutritionFacts: {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  },
};

// Receita nova: valores por porção, todos em branco ("não informado" até o autor preencher).
const initialNutrition = (): NutritionDraft => nutritionDraftFrom({ nutritionDeclared: {} });

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
  const fid = useId();
  const { user } = useAuthStore();
  const { createRecipe } = useRecipesStore();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);

  const [recipe, setRecipe] = useState<Partial<Recipe>>(INITIAL_RECIPE);
  const [rows, setRows] = useState<RecipeIngredient[]>(() => [emptyIngredient()]);
  const [nutrition, setNutrition] = useState<NutritionDraft>(initialNutrition);
  const calc = useIngredientCalc(rows);
  // Mesmo envio repetido (rede caiu na resposta): o banco não cria duas receitas.
  const operationId = useRef<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const reset = () => {
    setRecipe(INITIAL_RECIPE);
    setRows([emptyIngredient()]);
    setNutrition(initialNutrition());
    operationId.current = null;
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, { onClose: () => close(), active: isOpen && !!user });

  if (!isOpen || !user) return null;

  // Fechar com a receita pela metade: confirma antes de jogar fora.
  const close = async () => {
    const dirty =
      JSON.stringify(recipe) !== JSON.stringify(INITIAL_RECIPE) ||
      rows.some((r) => r.text.trim() || r.note.trim() || r.foodId) ||
      JSON.stringify(nutrition) !== JSON.stringify(initialNutrition());
    if (dirty && !(await confirmDialog(t.profileUi.discardRecipe))) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const read = readNutritionDraft(nutrition);
    if (!read.ok) {
      showToast(nutritionDraftMessage(read, t.recipeForm, t.profile.nutritionGoalsnames), 'warning');
      return;
    }
    const ingredientRows = rows.filter((r) => r.text.trim());
    const recipeData = {
      ...recipe,
      ...read.value,
      ingredientRows,
      ingredients: ingredientRows.map((r) => r.text.trim()),
      authorId: user.id,
      rating: 0,
      reviews: [],
    } as Recipe;
    if (!(await confirmDietCategory(recipeData, t))) return;

    setLoading(true);
    try {
      operationId.current ??= crypto.randomUUID();
      await createRecipe(recipeData, operationId.current);

      reset();
      onClose();
    } catch (error) {
      console.error('Error creating recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArrayInput = (
    field: 'instructions',
    index: number,
    value: string
  ) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: prev[field]?.map((item, i) => (i === index ? value : item)),
    }));
  };

  const addArrayItem = (field: 'instructions') => {
    setRecipe((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }));
  };

  const removeArrayItem = (
    field: 'instructions',
    index: number
  ) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index),
    }));
  };

  const translatedCategories = (Object.keys(t.categories) as CategoryKey[])
    .filter((key) => key !== 'all')
    .map((key) => ({
      value: key,
      label: t.categories[key],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-recipe-title" className="relative h-[100dvh] w-full max-w-3xl overflow-y-auto sm:h-auto sm:max-h-[90vh] sm:rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 shadow-2xl dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        {/* Botão fechar */}
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm transition hover:scale-105 hover:bg-white hover:text-slate-700 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-900"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="border-b border-slate-100/80 px-4 pb-4 pt-5 pr-14 dark:border-slate-800/80 sm:px-7">
          <div className="flex flex-col gap-1">
            <p className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {t.recipe.CreateRecipe}
            </p>
            <h2 id="create-recipe-title" className="text-xl font-semibold text-slate-900 dark:text-slate-50 sm:text-2xl">
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
          className="space-y-8 px-4 pb-7 pt-5 text-base sm:px-7"
        >
          {/* Título / Imagem */}
          <FormSection>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${fid}-1`} className={labelClass}>{t.recipe.recipeTitle}</label>
                <input id={`${fid}-1`}
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
                <label htmlFor={`${fid}-2`} className={labelClass}>{t.recipe.recipeImageURL}</label>
                <RecipeImageInput id={`${fid}-2`}
                  value={recipe.image ?? ''}
                  onChange={(image) => setRecipe((prev) => ({ ...prev, image }))}
                  inputClassName={inputClass}
                />
              </div>
            </div>
          </FormSection>

          {/* Descrição */}
          <FormSection description={t.recipe.details}>
            <div className="space-y-1.5">
              <label htmlFor={`${fid}-3`} className={labelClass}>{t.recipe.recipeDescription}</label>
              <textarea id={`${fid}-3`}
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor={`${fid}-4`} className={labelClass}>
                  {t.recipe.prepTime} (min)
                </label>
                <input id={`${fid}-4`}
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
                <label htmlFor={`${fid}-5`} className={labelClass}>{t.recipe.difficulty}</label>
                <select id={`${fid}-5`}
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
                <label htmlFor={`${fid}-6`} className={labelClass}>{t.recipe.recipeCategory}</label>
                <select id={`${fid}-6`}
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
                  <option value="" disabled>
                    {t.recipe.chooseCategory}
                  </option>
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
          <FormSection title={t.recipe.ingredients}>
            <RecipeIngredientsField
              rows={rows}
              onChange={setRows}
              inputClass={inputClass}
              calc={nutrition.source === 'ingredients'}
              issues={calc.issueByIndex}
            />
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
                    aria-label={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  {recipe.instructions!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('instructions', index)}
                      aria-label={t.common.remove}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white/80 px-2 text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          {/* Rendimento, porção e valores nutricionais */}
          <FormSection title={`${t.recipeForm.yieldTitle} · ${t.recipe.nutritionFacts}`}>
            <RecipeNutritionField draft={nutrition} onChange={setNutrition} inputClass={inputClass} labelClass={labelClass} calc={calc} />
          </FormSection>

          {/* Botão salvar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 px-4 py-3 text-base font-semibold text-white shadow-md transition ' +
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