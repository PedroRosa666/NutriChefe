import React, { useState } from 'react';
import { X, Plus, Minus, Utensils, BookOpen, Clock, Zap, Target } from 'lucide-react'; // Adicionados ícones para FormSection
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

// 💅 MELHORIA: Aprimoramento no foco e transições.
const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm md:text-base text-slate-900 ' +
  'shadow-sm transition-all duration-200 ' +
  'focus:border-emerald-500 focus:ring-3 focus:ring-emerald-200/50 ' + // Anel mais claro para melhor contraste
  'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:ring-emerald-400/30';

// 💅 MELHORIA: Fonte um pouco mais forte para rótulos.
const labelClass =
  'block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300';

// 💅 MELHORIA: Cartão de seção mais claro no modo escuro para contraste, sombra mais suave.
const sectionCardClass =
  'rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg ' +
  'dark:border-slate-800 dark:bg-slate-900/60 sm:p-5';

// 💅 MELHORIA: Título mais proeminente e contraste.
const sectionTitleClass =
  'text-lg font-bold text-slate-800 dark:text-slate-50 sm:text-xl';

interface FormSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  icon: React.ReactNode; // 💅 MELHORIA: Adicionado ícone para estética e clareza
}

function FormSection({ title, description, children, className, icon }: FormSectionProps) {
  return (
    <section className={cn(sectionCardClass, className)}>
      {(title || description) && (
        <header className="mb-4 flex items-center gap-3"> {/* 💅 MELHORIA: Ajuste de espaçamento e alinhamento */}
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-2 ring-emerald-500/30">
              {icon}
            </div>
          )}
          <div>
            {title && <h3 className={sectionTitleClass}>{title}</h3>}
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
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
      // Garante que os arrays não sejam nulos para evitar erros de tipagem na Recipe completa
      const ingredients = recipe.ingredients?.filter(Boolean) || [];
      const instructions = recipe.instructions?.filter(Boolean) || [];
      
      if (ingredients.length === 0 || instructions.length === 0) {
        throw new Error('Ingredients and instructions cannot be empty.');
      }
      
      const recipeData = {
        ...recipe,
        ingredients,
        instructions,
        authorId: user.id,
        rating: 0,
        reviews: [],
      } as Recipe;

      await createRecipe(recipeData);
      setRecipe(INITIAL_RECIPE);
      onClose();
    } catch (error) {
      console.error('Error creating recipe:', error);
      // Aqui você poderia adicionar um estado de erro para feedback ao usuário
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
      // 💅 MELHORIA: Garante que haja pelo menos um item vazio para começar se for nulo
      [field]: [...(prev[field] || ['']), ''],
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
    // 💅 MELHORIA: Usa Number(value) para permitir decimais de forma mais limpa, mas ainda verifica NaN.
    const numericValue = Number(value);
    setRecipe((prev) => ({
      ...prev,
      nutritionFacts: {
        ...prev.nutritionFacts,
        [key]: isNaN(numericValue) ? 0 : numericValue,
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
    // 💅 MELHORIA: Sombra mais suave no modal e cores mais ricas
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-5xl max-h-[95vh] flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-50/95 shadow-[0_30px_100px_rgba(0,0,0,0.85)] dark:bg-slate-900/95">
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/70 text-slate-300 shadow-xl ring-2 ring-slate-600/50 transition hover:scale-[1.03] hover:bg-slate-600/90 hover:text-slate-50" // 💅 MELHORIA: Botão de fechar mais suave
        >
          <X className="h-5 w-5" />
          <span className="sr-only">{t.common.close}</span>
        </button>

        {/* Header */}
        <div className="border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-900/60 px-6 pb-4 pt-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> {/* 💅 MELHORIA: Animação sutil */}
                {t.recipe.CreateNewRecipe}
              </div>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-50 sm:text-3xl"> {/* 💅 MELHORIA: Fonte mais pesada */}
                {t.recipe.recipeTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {t.recipe.details}
              </p>
            </div>

            {/* Preview mini da imagem */}
            <div className="mt-2 hidden items-center gap-3 sm:flex"> {/* 💅 MELHORIA: Ajuste de espaçamento */}
              <div className="text-right">
                <p className="text-sm font-semibold uppercase tracking-wider text-slate-300"> {/* 💅 MELHORIA: Fonte mais forte */}
                  Preview
                </p>
                <p className="text-xs text-slate-500">
                  {hasImage ? 'Imagem carregada' : 'Cole uma URL para ver a imagem'}
                </p>
              </div>
              <div className="h-16 w-24 overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-800/80 shadow-inner"> {/* 💅 MELHORIA: Bordas e sombra interna */}
                {hasImage ? (
                  <img
                    src={recipe.image}
                    alt={String(recipe.title || 'Recipe image')}
                    className="h-full w-full object-cover transition-opacity duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-center text-xs text-slate-600">
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
          className="flex-1 space-y-6 overflow-y-auto bg-slate-50 dark:bg-slate-950/90 px-4 pb-8 pt-6 sm:space-y-8 sm:px-6 md:px-8" // 💅 MELHORIA: Mais espaçamento e fundo mais escuro/sólido
        >
          {/* Linha principal: título/descrição ↔ imagem + meta */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)]"> {/* 💅 MELHORIA: Mais espaçamento de grid */}
            <FormSection
              title={t.recipe.CreateNewRecipe}
              description={t.recipe.details}
              icon={<BookOpen className="h-5 w-5" />} // 💅 MELHORIA: Ícone
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

            <FormSection title={t.recipe.recipeImageURL} icon={<Target className="h-5 w-5" />}>
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
                  {/* Tempo de Preparo */}
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

                  {/* Dificuldade */}
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

                  {/* Categoria */}
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
            icon={<Utensils className="h-5 w-5" />} // 💅 MELHORIA: Ícone
          >
            <div className="space-y-3"> {/* 💅 MELHORIA: Mais espaçamento vertical */}
              {recipe.ingredients?.map((ingredient, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl bg-slate-100/70 p-2.5 ring-1 ring-slate-200/80 dark:bg-slate-800/70 dark:ring-slate-700/80" // 💅 MELHORIA: Fundo/ring mais suave
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-500 ring-2 ring-emerald-500/50"> {/* 💅 MELHORIA: Tamanho maior e ring duplo */}
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
                      'flex-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-none' // 💅 MELHORIA: Remove o ring de foco e borda para ter foco apenas no input principal
                    )}
                    placeholder={t.recipe.example}
                    required
                  />
                  {recipe.ingredients!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('ingredients', index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/40 transition hover:bg-red-500/20 hover:text-red-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => addArrayItem('ingredients')}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-500 ring-1 ring-emerald-500/50 transition hover:bg-emerald-500/25" // 💅 MELHORIA: Botão maior e mais proeminente
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
            icon={<Clock className="h-5 w-5" />} // 💅 MELHORIA: Ícone
          >
            <div className="space-y-3">
              {recipe.instructions?.map((instruction, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl bg-slate-100/70 p-2.5 ring-1 ring-slate-200/80 dark:bg-slate-800/70 dark:ring-slate-700/80"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-500 ring-2 ring-sky-500/50">
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
                      'flex-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-none'
                    )}
                    placeholder={`${t.recipe.Step} ${index + 1}`}
                    required
                  />
                  {recipe.instructions!.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('instructions', index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/40 transition hover:bg-red-500/20 hover:text-red-100"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => addArrayItem('instructions')}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-500 ring-1 ring-sky-500/50 transition hover:bg-sky-500/25"
              >
                <Plus className="h-4 w-4" />
                {t.common.add}
              </button>
            </div>
          </FormSection>

          {/* Valores nutricionais */}
          <FormSection title={t.recipe.nutritionFacts} icon={<Zap className="h-5 w-5" />}>
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-5"> {/* 💅 MELHORIA: Mais espaçamento de grid */}
              {Object.entries(recipe.nutritionFacts || INITIAL_RECIPE.nutritionFacts!).map(([key, value]) => {
                const nutritionKey =
                  key as keyof typeof t.profile.nutritionGoalsnames;
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-slate-100/70 p-3 ring-1 ring-slate-200/80 dark:bg-slate-800/70 dark:ring-slate-700/80" // 💅 MELHORIA: Fundo/ring mais suave
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"> {/* 💅 MELHORIA: Fonte mais forte */}
                      {t.profile.nutritionGoalsnames[nutritionKey]}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-1"> {/* 💅 MELHORIA: Alinhamento vertical center */}
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
                          'mt-0 h-10 bg-slate-200/50 text-base font-medium text-slate-900 dark:bg-slate-900/60 dark:text-slate-50 shadow-none focus:ring-1 focus:ring-emerald-400/50' // 💅 MELHORIA: Tamanho maior, foco menos agressivo
                        )}
                        placeholder="0.00"
                        required
                      />
                      <span className="pb-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {key === 'calories' ? 'kcal' : 'g'} {/* 💅 MELHORIA: Unidade correta (kcal para calorias) */}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>

          {/* Botão salvar */}
          <div className="sticky bottom-0 -mx-8 mt-8 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/90 py-4 px-8"> {/* 💅 MELHORIA: Barra inferior sólida e mais espaçada */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3.5 text-lg font-bold text-slate-950 shadow-[0_15px_30px_rgba(16,185,129,0.55)] ' + // 💅 MELHORIA: Botão maior, fonte mais pesada, sombra mais proeminente
                'transition duration-300 ease-out hover:bg-emerald-400 hover:scale-[1.005] hover:shadow-[0_20px_40px_rgba(16,185,129,0.7)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 ' +
                'disabled:cursor-not-allowed disabled:bg-emerald-700/60 disabled:text-slate-300 disabled:shadow-none',
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