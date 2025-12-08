import React, { useState, useCallback, useMemo } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { useRecipesStore } from '../store/recipes';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import type { Recipe } from '../types/recipe';

// Definindo o tipo inicial para o estado da receita (simplifica o reset)
type RecipeDraft = Omit<Recipe, 'authorId' | 'rating' | 'reviews'> & Partial<Pick<Recipe, 'authorId' | 'rating' | 'reviews'>>;

const INITIAL_RECIPE_STATE: RecipeDraft = {
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

type CategoryKey = keyof ReturnType<typeof useTranslation>['categories'];
type ArrayField = 'ingredients' | 'instructions';

interface CreateRecipeFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRecipeForm({ isOpen, onClose }: CreateRecipeFormProps) {
  const { user } = useAuthStore();
  const { createRecipe } = useRecipesStore();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<RecipeDraft>(INITIAL_RECIPE_STATE);

  // Early return se o modal não estiver aberto ou o usuário não estiver logado
  if (!isOpen || !user) return null;

  // Função para resetar o formulário
  const resetForm = useCallback(() => {
    setRecipe(INITIAL_RECIPE_STATE);
  }, []);

  // Handler para campos de array (ingredientes/instruções)
  const handleArrayInput = useCallback(
    (field: ArrayField, index: number, value: string) => {
      setRecipe((prev) => ({
        ...prev,
        [field]: prev[field]?.map((item, i) => (i === index ? value : item)),
      }));
    },
    []
  );

  // Função para adicionar um item ao array (ingredientes/instruções)
  const addArrayItem = useCallback((field: ArrayField) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ''],
    }));
  }, []);

  // Função para remover um item do array (ingredientes/instruções)
  const removeArrayItem = useCallback((field: ArrayField, index: number) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index),
    }));
  }, []);

  // Handler para alterar os fatos nutricionais
  const handleNutritionChange = useCallback((key: keyof Recipe['nutritionFacts'], value: string) => {
    const numericValue = parseFloat(value) || 0;
    setRecipe((prev) => ({
      ...prev,
      nutritionFacts: {
        ...prev.nutritionFacts,
        [key]: numericValue,
      },
    }));
  }, []);

  // Lógica de submissão
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return; // Checagem adicional, embora o early return já cubra

    setLoading(true);
    try {
      // Garantir que os campos obrigatórios para o tipo Recipe estejam presentes
      const recipeData: Recipe = {
        ...(recipe as Omit<RecipeDraft, 'authorId' | 'rating' | 'reviews'>),
        authorId: user.id,
        rating: 0,
        reviews: [],
      };

      await createRecipe(recipeData);
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating recipe:', error);
      // Aqui você poderia adicionar um estado de erro para feedback ao usuário
    } finally {
      setLoading(false);
    }
  };

  // Memoização das categorias traduzidas (otimização)
  const translatedCategories = useMemo(() => {
    return (Object.keys(t.categories) as CategoryKey[])
      .filter((key) => key !== 'all')
      .map((key) => ({
        value: key,
        label: t.categories[key],
      }));
  }, [t.categories]);

  // --- Funções de Componente de Input Reutilizáveis (para clareza) ---

  const ArrayInputSection = ({ field, title, placeholderKey, buttonLabelKey, stepPrefixKey }: {
    field: ArrayField,
    title: string,
    placeholderKey: keyof typeof t.recipe,
    buttonLabelKey: keyof typeof t.recipe,
    stepPrefixKey?: keyof typeof t.recipe
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <button
          type="button"
          onClick={() => addArrayItem(field)}
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          <Plus className="w-4 h-4" />
          {t.recipe[buttonLabelKey]}
        </button>
      </div>
      <div className="space-y-2">
        {recipe[field]?.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => handleArrayInput(field, index, e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              placeholder={stepPrefixKey ? `${t.recipe[stepPrefixKey]} ${index + 1}` : t.recipe[placeholderKey]}
              required
            />
            {recipe[field]!.length > 1 && (
              <button
                type="button"
                onClick={() => removeArrayItem(field, index)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

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

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-6 text-base">
          
          {/* Título / Imagem */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="title" className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.recipeTitle}
              </label>
              <input
                id="title"
                type="text"
                value={recipe.title}
                onChange={(e) => setRecipe((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="image" className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.recipeImageURL}
              </label>
              <input
                id="image"
                type="url"
                value={recipe.image}
                onChange={(e) => setRecipe((prev) => ({ ...prev, image: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-base font-medium text-slate-700 dark:text-slate-100">
              {t.recipe.recipeDescription}
            </label>
            <textarea
              id="description"
              value={recipe.description}
              onChange={(e) => setRecipe((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              rows={3}
              required
            />
          </div>

          {/* Tempo / dificuldade / categoria */}
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="prepTime" className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.prepTime} (min)
              </label>
              <input
                id="prepTime"
                type="number"
                value={recipe.prepTime}
                onChange={(e) => setRecipe((prev) => ({ ...prev, prepTime: Number(e.target.value) }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                min={1}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="difficulty" className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.difficulty}
              </label>
              <select
                id="difficulty"
                value={recipe.difficulty}
                onChange={(e) => setRecipe((prev) => ({ ...prev, difficulty: e.target.value as Recipe['difficulty'] }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                required
              >
                <option value="easy">{t.recipe.difficultyLevels.easy}</option>
                <option value="medium">{t.recipe.difficultyLevels.medium}</option>
                <option value="hard">{t.recipe.difficultyLevels.hard}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category" className="block text-base font-medium text-slate-700 dark:text-slate-100">
                {t.recipe.recipeCategory}
              </label>
              <select
                id="category"
                value={recipe.category}
                onChange={(e) => setRecipe((prev) => ({ ...prev, category: e.target.value }))}
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

          {/* Ingredientes (Utilizando o componente de seção reutilizável) */}
          <ArrayInputSection
            field="ingredients"
            title={t.recipe.ingredients}
            placeholderKey="example"
            buttonLabelKey="addIngredient"
          />

          {/* Modo de preparo (Utilizando o componente de seção reutilizável) */}
          <ArrayInputSection
            field="instructions"
            title={t.recipe.instructions}
            placeholderKey="Step" // Será ignorado pois stepPrefixKey está presente
            buttonLabelKey="addStep"
            stepPrefixKey="Step"
          />

          {/* Valores nutricionais */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {t.recipe.nutritionFacts}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(recipe.nutritionFacts || {}).map(([key, value]) => {
                const nutritionKey = key as keyof Recipe['nutritionFacts'];
                const translatedLabel = t.profile.nutritionGoalsnames[nutritionKey];

                return (
                  <div key={key} className="space-y-1.5">
                    <label htmlFor={`nutri-${key}`} className="block text-sm font-medium text-slate-600 dark:text-slate-200">
                      {translatedLabel}
                    </label>
                    <input
                      id={`nutri-${key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => handleNutritionChange(nutritionKey, e.target.value)}
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