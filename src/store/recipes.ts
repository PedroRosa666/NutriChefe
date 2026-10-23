import { create } from 'zustand';
import * as db from '../services/database';
import { useAuthStore } from './auth';
import { useToastStore } from './toast';
import type { Recipe } from '../types/recipe';
import { feedback } from '../lib/i18n/current';

interface RecipesState {
  recipes: Recipe[];
  favoriteRecipes: string[];
  loading: boolean;
  error: string | null;
  addToFavorites: (recipeId: string) => Promise<void>;
  removeFromFavorites: (recipeId: string) => Promise<void>;
  addReview: (recipeId: string, review: { userId: string; userName: string; rating: number; comment: string; date: string; }) => Promise<void>;
  updateReview: (reviewId: string, updates: { rating: number; comment: string; }) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  createRecipe: (recipe: Omit<Recipe, 'id' | 'rating' | 'reviews' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  fetchRecipes: (options?: { silent?: boolean }) => Promise<void>;
  fetchFavorites: (userId: string) => Promise<void>;
  clearUserData: () => void;
}

export const useRecipesStore = create<RecipesState>((set, get) => ({
  recipes: [],
  favoriteRecipes: [],
  loading: false,
  error: null,

  clearUserData: () => {
    set({ favoriteRecipes: [] });
  },

  // `silent` atualiza a lista sem acionar o spinner (ex.: após salvar avaliação),
  // evitando desmontar a tela atual.
  fetchRecipes: async (options) => {
    if (!options?.silent) set({ loading: true, error: null });
    try {
      const recipes = await db.getRecipes();
      set({ recipes, loading: false });
      
      // Se o usuário estiver autenticado, buscar favoritos
      const { user } = useAuthStore.getState();
      if (user) {
        await get().fetchFavorites(user.id);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch recipes';
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast(feedback().recipes.loadError, 'error');
    }
  },

  fetchFavorites: async (userId: string) => {
    try {
      const favorites = await db.getFavorites(userId);
      set({ favoriteRecipes: favorites });
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      // Não mostrar toast para erro de favoritos, pois não é crítico
    }
  },

  addToFavorites: async (recipeId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      useToastStore.getState().showToast(feedback().recipes.loginToFavorite, 'error');
      return;
    }

    try {
      await db.addToFavorites(user.id, recipeId);
      set(state => ({
        favoriteRecipes: state.favoriteRecipes.includes(recipeId)
          ? state.favoriteRecipes
          : [...state.favoriteRecipes, recipeId]
      }));
      useToastStore.getState().showToast(feedback().recipes.addedToFavorites, 'success');
    } catch (error) {
      console.error('Failed to add favorite:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().recipes.addFavoriteError;
      useToastStore.getState().showToast(errorMessage, 'error');
    }
  },

  removeFromFavorites: async (recipeId: string) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      useToastStore.getState().showToast(feedback().recipes.loginToManageFavorites, 'error');
      return;
    }

    try {
      await db.removeFromFavorites(user.id, recipeId);
      set(state => ({
        favoriteRecipes: state.favoriteRecipes.filter(id => id !== recipeId)
      }));
      useToastStore.getState().showToast(feedback().recipes.removedFromFavorites, 'info');
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().recipes.removeFavoriteError;
      useToastStore.getState().showToast(errorMessage, 'error');
    }
  },

  addReview: async (recipeId: string, review) => {
    try {
      await db.addReview(recipeId, {
        user_id: review.userId,
        rating: review.rating,
        comment: review.comment
      });
      
      // Atualizar receitas para obter avaliações atualizadas
      await get().fetchRecipes({ silent: true });
      useToastStore.getState().showToast(feedback().recipes.reviewAdded, 'success');
    } catch (error) {
      console.error('Failed to add review:', error);
      const isDuplicate = (error as { code?: string } | null)?.code === '23505';
      const errorMessage = isDuplicate
        ? feedback().recipes.reviewDuplicate
        : error instanceof Error ? error.message : feedback().recipes.addReviewError;
      useToastStore.getState().showToast(errorMessage, 'error');
      throw error;
    }
  },

  updateReview: async (reviewId: string, updates) => {
    try {
      await db.updateReview(reviewId, updates);
      
      // Atualizar receitas para obter avaliações atualizadas
      await get().fetchRecipes({ silent: true });
      useToastStore.getState().showToast(feedback().recipes.reviewUpdated, 'success');
    } catch (error) {
      console.error('Failed to update review:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().recipes.updateReviewError;
      useToastStore.getState().showToast(errorMessage, 'error');
      throw error;
    }
  },

  deleteReview: async (reviewId: string) => {
    try {
      await db.deleteReview(reviewId);
      
      // Atualizar receitas para obter avaliações atualizadas
      await get().fetchRecipes({ silent: true });
      useToastStore.getState().showToast(feedback().recipes.reviewDeleted, 'success');
    } catch (error) {
      console.error('Failed to delete review:', error);
      const errorMessage = error instanceof Error ? error.message : feedback().recipes.deleteReviewError;
      useToastStore.getState().showToast(errorMessage, 'error');
      throw error;
    }
  },

  createRecipe: async (recipe) => {
    set({ error: null });
    try {
      await db.createRecipe(recipe);
      await get().fetchRecipes({ silent: true });
      useToastStore.getState().showToast(feedback().recipes.recipeCreated, 'success');
    } catch (error) {
      console.error('Failed to create recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create recipe';
      set({ error: errorMessage });
      useToastStore.getState().showToast(feedback().recipes.createRecipeError, 'error');
      throw error;
    }
  },

  updateRecipe: async (recipe) => {
    set({ error: null });
    try {
      await db.updateRecipe(recipe.id, recipe);
      await get().fetchRecipes({ silent: true });
      useToastStore.getState().showToast(feedback().recipes.recipeUpdated, 'success');
    } catch (error) {
      console.error('Failed to update recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update recipe';
      set({ error: errorMessage });
      useToastStore.getState().showToast(feedback().recipes.updateRecipeError, 'error');
      throw error;
    }
  },

  deleteRecipe: async (recipeId) => {
    set({ error: null });
    try {
      await db.deleteRecipe(recipeId);
      set(state => ({
        recipes: state.recipes.filter(recipe => recipe.id !== recipeId),
        favoriteRecipes: state.favoriteRecipes.filter(id => id !== recipeId)
      }));
      useToastStore.getState().showToast(feedback().recipes.recipeDeleted, 'success');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe';
      set({ error: errorMessage });
      useToastStore.getState().showToast(feedback().recipes.deleteRecipeError, 'error');
      throw error;
    }
  }
}));