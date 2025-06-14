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
  const translations = useTranslation();
  const [loading, setLoading] = useState(false);

  // Estado inicial corrigido
  const [recipe, setRecipe] = useState<Partial<Recipe>>({
    title: '',
    description: '',
    image: '',
    prepTime: 30,
    difficulty: 'medium',
    category: 'vegan', // Categoria válida
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
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting recipe:', recipe);
      console.log('User ID:', user.id);
      
      const recipeData = {
        ...recipe,
        authorId: user.id,
        rating: 0,
        reviews: [],
      } as Recipe;

      await createRecipe(recipeData);
      
      // Reset form
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

  const removeArrayItem = (field: 'ingredients' | 'instructions', index: number) => {
    setRecipe((prev) => ({
      ...prev,
      [field]: prev[field]?.filter((_, i) => i !== index),
    }));
  };

  // Mapeia as categorias traduzidas para o formato { valor: 'original', label: 'traduzido' }
  const translatedCategories = (Object.keys(translations.categories) as CategoryKey[])
    .filter(key => key !== 'all') // Remove 'all' das opções
    .map((key) => ({
      value: key,
      label: translations.categories[key],
    }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 text-black dark:text-gray-400 rounded-xl max-w-3xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          {translations.recipe.CreateNewRecipe}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                {translations.recipe.recipeTitle}
              </label>
              <input
                type="text"
                value={recipe.title}
                onChange={(e) => setRecipe((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                {translations.recipe.recipeImageURL}
              </label>
              <input
                type="url"
                value={recipe.image}
                onChange={(e) => setRecipe((prev) => ({ ...prev, image: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                placeholder="https://example.com/image.jpg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
              {translations.recipe.recipeDescription}
            </label>
            <textarea
              value={recipe.description}
              onChange={(e) => setRecipe((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
              rows={3}
              required
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                {translations.recipe.prepTime} (minutos)
              </label>
              <input
                type="number"
                value={recipe.prepTime}
                onChange={(e) => setRecipe((prev) => ({ ...prev, prepTime: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                {translations.recipe.difficulty}
              </label>
              <select
                value={recipe.difficulty}
                onChange={(e) => setRecipe((prev) => ({ ...prev, difficulty: e.target.value as Recipe['difficulty'] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                required
              >
                <option value="easy">{translations.recipe.difficultyLevels.easy}</option>
                <option value="medium">{translations.recipe.difficultyLevels.medium}</option>
                <option value="hard">{translations.recipe.difficultyLevels.hard}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                {translations.recipe.recipeCategory}
              </label>
              <select
                value={recipe.category}
                onChange={(e) => setRecipe((prev) => ({
                  ...prev,
                  category: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
              {translations.recipe.ingredients}
            </label>
            {recipe.ingredients?.map((ingredient, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ingredient}
                  onChange={(e) => handleArrayInput('ingredients', index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                  placeholder={translations.recipe.example}
                  required
                />
                {recipe.ingredients!.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem('ingredients', index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayItem('ingredients')}
              className="flex items-center gap-2 text-green-600 hover:text-green-700"
            >
              <Plus className="w-4 h-4" /> {translations.recipe.addIngredient}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
              {translations.recipe.instructions}
            </label>
            {recipe.instructions?.map((instruction, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => handleArrayInput('instructions', index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                  placeholder={`${translations.recipe.Step} ${index + 1}`}
                  required
                />
                {recipe.instructions!.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem('instructions', index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayItem('instructions')}
              className="flex items-center gap-2 text-green-600 hover:text-green-700"
            >
              <Plus className="w-4 h-4" /> {translations.recipe.addStep}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2 dark:text-white">
              {translations.recipe.nutritionFacts}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(recipe.nutritionFacts || {}).map(([key, value]) => {
                const nutritionKey = key as keyof typeof translations.profile.nutritionGoalsnames;
                return (
                  <div key={key}>
                    <label className="block text-sm text-gray-600 mb-1 capitalize dark:text-white">
                      {translations.profile.nutritionGoalsnames[nutritionKey]}
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) =>
                        setRecipe((prev) => {
                          const updatedNutritionFacts = {
                            calories: prev.nutritionFacts?.calories || 0,
                            protein: prev.nutritionFacts?.protein || 0,
                            carbs: prev.nutritionFacts?.carbs || 0,
                            fat: prev.nutritionFacts?.fat || 0,
                            fiber: prev.nutritionFacts?.fiber || 0,
                            [key]: Number(e.target.value) || 0,
                          };

                          return {
                            ...prev,
                            nutritionFacts: updatedNutritionFacts,
                          };
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
                      min="0"
                      required
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-3 rounded-lg text-white font-medium transition-colors',
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {loading ? 'Criando...' : translations.recipe.CreateRecipe}
          </button>
        </form>
      </div>
    </div>
  );
}