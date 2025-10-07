import { create } from 'zustand';
import * as db from '../services/database';
import { useAuthStore } from './auth';
import { useToastStore } from './toast';
import type { Recipe } from '../types/recipe';

interface RecipesState {
  recipes: Recipe[];
  favoriteRecipes: number[];
  favoritesLoaded: boolean;
  loading: boolean;
  error: string | null;
  addToFavorites: (recipeId: number) => Promise<void>;
  removeFromFavorites: (recipeId: number) => Promise<void>;
  addReview: (recipeId: number, review: { userId: string; userName: string; rating: number; comment: string; date: string; }) => Promise<void>;
  updateReview: (reviewId: string, updates: { rating: number; comment: string; }) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  createRecipe: (recipe: Omit<Recipe, 'id' | 'rating' | 'reviews' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: number) => Promise<void>;
  fetchRecipes: () => Promise<void>;
  fetchFavorites: (userId: string) => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearUserData: () => void;
}

export const useRecipesStore = create<RecipesState>((set, get) => ({
  recipes: [],
  favoriteRecipes: [],
  favoritesLoaded: false,
  loading: false,
  error: null,

  clearUserData: () => {
    console.log('Clearing user data from recipes store');
    set({ favoriteRecipes: [], favoritesLoaded: false });
  },

  initializeAuth: async () => {
    // Esta função será chamada pelo useAuthStore
    const { user } = useAuthStore.getState();
    if (user) {
      await get().fetchFavorites(user.id);
    }
  },

  fetchRecipes: async () => {
    set({ loading: true, error: null });
    try {
      console.log('Fetching recipes from database...');
      const recipes = await db.getRecipes();
      console.log('Recipes fetched successfully:', recipes.length);
      set({ recipes, loading: false });
      
      // Se o usuário estiver autenticado, buscar favoritos
      const { user } = useAuthStore.getState();
      if (user && !get().favoritesLoaded) {
        await get().fetchFavorites(user.id);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch recipes';
      set({ error: errorMessage, loading: false });
      useToastStore.getState().showToast('Erro ao carregar receitas', 'error');
    }
  },

  fetchFavorites: async (userId: string) => {
    try {
      console.log('Fetching favorites for user:', userId);
      const favorites = await db.getFavorites(userId);
      console.log('Favorites fetched:', favorites);
      set({ favoriteRecipes: favorites, favoritesLoaded: true });
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      // Não mostrar toast para erro de favoritos, pois não é crítico
    }
  },

  addToFavorites: async (recipeId: number) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      useToastStore.getState().showToast('Faça login para favoritar receitas', 'error');
      return;
    }

    try {
      console.log('Adding to favorites:', { userId: user.id, recipeId });
      await db.addToFavorites(user.id, recipeId);
      set(state => ({
        favoriteRecipes: [...state.favoriteRecipes, recipeId]
      }));
      useToastStore.getState().showToast('Adicionado aos favoritos', 'success');
    } catch (error) {
      console.error('Failed to add favorite:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar aos favoritos';
      useToastStore.getState().showToast(errorMessage, 'error');
    }
  },

  removeFromFavorites: async (recipeId: number) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      useToastStore.getState().showToast('Faça login para gerenciar favoritos', 'error');
      return;
    }

    try {
      console.log('Removing from favorites:', { userId: user.id, recipeId });
      await db.removeFromFavorites(user.id, recipeId);
      set(state => ({
        favoriteRecipes: state.favoriteRecipes.filter(id => id !== recipeId)
      }));
      useToastStore.getState().showToast('Removido dos favoritos', 'info');
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao remover dos favoritos';
      useToastStore.getState().showToast(errorMessage, 'error');
    }
  },

  addReview: async (recipeId: number, review) => {
    try {
      console.log('Adding review:', { recipeId, review });
      await db.addReview(recipeId, {
        user_id: review.userId,
        rating: review.rating,
        comment: review.comment
      });
      
      // Atualizar receitas para obter avaliações atualizadas
      await get().fetchRecipes();
      useToastStore.getState().showToast('Avaliação adicionada com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to add review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar avaliação';
      useToastStore.getState().showToast(errorMessage, 'error');
      throw error;
    }
  },

  updateReview: async (reviewId: string, updates) => {
    try {
      console.log('Updating review:', { reviewId, updates });
      await db.updateReview(reviewId, updates);
      
      // Atualizar receitas para obter avaliações atualizadas
      await get().fetchRecipes();
      useToastStore.getState().showToast('Avaliação atualizada com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to update review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar avaliação';
      useToastStore.getState().showToast(errorMessage, 'error');
      throw error;
    }
  },

  deleteReview: async (reviewId: string) => {
    try {
      console.log('Deleting review:', reviewId);
      await db.deleteReview(reviewId);
      
      // Atualizar receitas para obter avaliações atualizadas
      await get().fetchRecipes();
      useToastStore.getState().showToast('Avaliação excluída com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to delete review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir avaliação';
      useToastStore.getState().showToast(errorMessage, 'error');
      throw error;
    }
  },

  createRecipe: async (recipe) => {
    set({ loading: true, error: null });
    try {
      console.log('Creating recipe:', recipe);
      await db.createRecipe(recipe);
      await get().fetchRecipes();
      useToastStore.getState().showToast('Receita criada com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to create recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create recipe';
      set({ error: errorMessage });
      useToastStore.getState().showToast('Erro ao criar receita', 'error');
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateRecipe: async (recipe) => {
    set({ loading: true, error: null });
    try {
      console.log('Updating recipe:', recipe);
      await db.updateRecipe(recipe.id, recipe);
      await get().fetchRecipes();
      useToastStore.getState().showToast('Receita atualizada com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to update recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update recipe';
      set({ error: errorMessage });
      useToastStore.getState().showToast('Erro ao atualizar receita', 'error');
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteRecipe: async (recipeId) => {
    set({ loading: true, error: null });
    try {
      console.log('Deleting recipe:', recipeId);
      await db.deleteRecipe(recipeId);
      set(state => ({
        recipes: state.recipes.filter(recipe => recipe.id !== recipeId),
        favoriteRecipes: state.favoriteRecipes.filter(id => id !== recipeId)
      }));
      useToastStore.getState().showToast('Receita excluída com sucesso!', 'success');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe';
      set({ error: errorMessage });
      useToastStore.getState().showToast('Erro ao excluir receita', 'error');
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));