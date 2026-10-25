import { create } from 'zustand';
import * as db from '../services/database';
import type { RecipeFilters, RecipeInput } from '../services/database';
import { useAuthStore } from './auth';
import { useToastStore } from './toast';
import type { Recipe } from '../types/recipe';
import { appErrorTexts, feedback } from '../lib/i18n/current';
import { errorCode, errorText } from '../lib/app-errors';

// Receitas em camadas, para o catálogo crescer sem o app baixar tudo:
// - cards: a grade da tela inicial, de página em página, com busca e filtros no servidor;
// - index: cartões de todo o catálogo, só quando uma ferramenta precisa escolher entre
//   todas (gerador e editor de plano, trocas, diário, "O que tem em casa?");
// - details: receitas completas (preparo e avaliações), carregadas ao abrir;
// - mine: receitas do próprio autor, completas (painel e conteúdo do nutricionista).
interface RecipesState {
  cards: Recipe[];
  cardsHasMore: boolean;
  cardsLoading: boolean;
  cardsLoadingMore: boolean;
  cardsError: boolean;
  cardsFilters: RecipeFilters | null;
  loadCards: (filters: RecipeFilters, options?: { silent?: boolean }) => Promise<void>;
  loadMoreCards: () => Promise<void>;

  index: Recipe[];
  indexLoaded: boolean;
  ensureIndex: (options?: { force?: boolean }) => Promise<Recipe[]>;

  details: Record<string, Recipe>;
  loadRecipe: (id: string, options?: { force?: boolean }) => Promise<Recipe | null>;

  mine: Recipe[];
  mineLoaded: boolean;
  loadMine: (options?: { force?: boolean }) => Promise<void>;

  favoriteRecipes: string[];
  fetchFavorites: (userId: string) => Promise<void>;
  addToFavorites: (recipeId: string) => Promise<void>;
  removeFromFavorites: (recipeId: string) => Promise<void>;

  addReview: (recipeId: string, review: { userId: string; userName: string; rating: number; comment: string; date: string }) => Promise<void>;
  updateReview: (recipeId: string, reviewId: string, updates: { rating: number; comment: string }) => Promise<void>;
  deleteReview: (recipeId: string, reviewId: string) => Promise<void>;
  /** `operationId`: o mesmo em cada nova tentativa do mesmo envio (não grava duas vezes). */
  createRecipe: (recipe: RecipeInput, operationId?: string) => Promise<Recipe>;
  updateRecipe: (recipe: Recipe, operationId?: string) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;

  /** Algo mudou (receita salva, login, assinatura): recarrega o que já estava carregado. */
  refresh: (recipeId?: string) => Promise<void>;
  clearUserData: () => void;
}

// Respostas atrasadas (a pessoa digitou de novo) não sobrescrevem a busca atual.
let cardsRequest = 0;
let indexPromise: Promise<Recipe[]> | null = null;

const toast = () => useToastStore.getState().showToast;

export const useRecipesStore = create<RecipesState>((set, get) => ({
  cards: [],
  cardsHasMore: false,
  cardsLoading: false,
  cardsLoadingMore: false,
  cardsError: false,
  cardsFilters: null,

  loadCards: async (filters, options) => {
    const request = ++cardsRequest;
    set({ cardsFilters: filters, cardsError: false, ...(options?.silent ? {} : { cardsLoading: true }) });
    try {
      const { recipes, hasMore } = await db.searchRecipes(filters, 0);
      if (request !== cardsRequest) return;
      set({ cards: recipes, cardsHasMore: hasMore, cardsLoading: false });
    } catch (error) {
      if (request !== cardsRequest) return;
      console.error('Error fetching recipes:', error);
      set({ cardsLoading: false, cardsError: true });
      toast()(feedback().recipes.loadError, 'error');
    }
  },

  loadMoreCards: async () => {
    const { cardsFilters, cardsHasMore, cardsLoading, cardsLoadingMore, cards } = get();
    if (!cardsFilters || !cardsHasMore || cardsLoading || cardsLoadingMore) return;
    const request = cardsRequest;
    set({ cardsLoadingMore: true });
    try {
      const page = Math.ceil(cards.length / db.RECIPES_PAGE_SIZE);
      const { recipes, hasMore } = await db.searchRecipes(cardsFilters, page);
      if (request !== cardsRequest) return;
      const seen = new Set(cards.map((r) => r.id));
      set({ cards: [...cards, ...recipes.filter((r) => !seen.has(r.id))], cardsHasMore: hasMore, cardsLoadingMore: false });
    } catch (error) {
      console.error('Error fetching more recipes:', error);
      set({ cardsLoadingMore: false });
      toast()(feedback().recipes.loadError, 'error');
    }
  },

  index: [],
  indexLoaded: false,

  ensureIndex: async (options) => {
    if (get().indexLoaded && !options?.force) return get().index;
    if (!indexPromise || options?.force) {
      indexPromise = db
        .getRecipeIndex()
        .then((index) => {
          set({ index, indexLoaded: true });
          return index;
        })
        .catch((error) => {
          console.error('Error fetching recipe index:', error);
          toast()(feedback().recipes.loadError, 'error');
          return get().index;
        })
        .finally(() => {
          indexPromise = null;
        });
    }
    return indexPromise;
  },

  details: {},

  loadRecipe: async (id, options) => {
    const cached = get().details[id];
    if (cached && !options?.force) return cached;
    const recipe = await db.getRecipeById(id);
    set((state) => {
      const details = { ...state.details };
      if (recipe) details[id] = recipe;
      else delete details[id];
      return { details };
    });
    return recipe;
  },

  mine: [],
  mineLoaded: false,

  loadMine: async (options) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    if (get().mineLoaded && !options?.force) return;
    try {
      const mine = await db.getRecipesByAuthor(user.id);
      set({ mine, mineLoaded: true });
    } catch (error) {
      console.error('Error fetching own recipes:', error);
    }
  },

  favoriteRecipes: [],

  fetchFavorites: async (userId) => {
    try {
      set({ favoriteRecipes: await db.getFavorites(userId) });
    } catch (error) {
      // Não é crítico: sem aviso na tela.
      console.error('Failed to fetch favorites:', error);
    }
  },

  addToFavorites: async (recipeId) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      toast()(feedback().recipes.loginToFavorite, 'error');
      return;
    }
    try {
      await db.addToFavorites(user.id, recipeId);
      set((state) => ({
        favoriteRecipes: state.favoriteRecipes.includes(recipeId) ? state.favoriteRecipes : [...state.favoriteRecipes, recipeId],
      }));
      toast()(feedback().recipes.addedToFavorites, 'success');
    } catch (error) {
      console.error('Failed to add favorite:', error);
      toast()(error instanceof Error ? error.message : feedback().recipes.addFavoriteError, 'error');
    }
  },

  removeFromFavorites: async (recipeId) => {
    const { user } = useAuthStore.getState();
    if (!user) {
      toast()(feedback().recipes.loginToManageFavorites, 'error');
      return;
    }
    try {
      await db.removeFromFavorites(user.id, recipeId);
      set((state) => ({ favoriteRecipes: state.favoriteRecipes.filter((id) => id !== recipeId) }));
      toast()(feedback().recipes.removedFromFavorites, 'info');
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      toast()(error instanceof Error ? error.message : feedback().recipes.removeFavoriteError, 'error');
    }
  },

  addReview: async (recipeId, review) => {
    try {
      await db.addReview(recipeId, { user_id: review.userId, rating: review.rating, comment: review.comment });
      await get().refresh(recipeId);
      toast()(feedback().recipes.reviewAdded, 'success');
    } catch (error) {
      console.error('Failed to add review:', error);
      const isDuplicate = (error as { code?: string } | null)?.code === '23505';
      toast()(
        isDuplicate ? feedback().recipes.reviewDuplicate : error instanceof Error ? error.message : feedback().recipes.addReviewError,
        'error'
      );
      throw error;
    }
  },

  updateReview: async (recipeId, reviewId, updates) => {
    try {
      await db.updateReview(reviewId, updates);
      await get().refresh(recipeId);
      toast()(feedback().recipes.reviewUpdated, 'success');
    } catch (error) {
      console.error('Failed to update review:', error);
      toast()(error instanceof Error ? error.message : feedback().recipes.updateReviewError, 'error');
      throw error;
    }
  },

  deleteReview: async (recipeId, reviewId) => {
    try {
      await db.deleteReview(reviewId);
      await get().refresh(recipeId);
      toast()(feedback().recipes.reviewDeleted, 'success');
    } catch (error) {
      console.error('Failed to delete review:', error);
      toast()(error instanceof Error ? error.message : feedback().recipes.deleteReviewError, 'error');
      throw error;
    }
  },

  createRecipe: async (recipe, operationId) => {
    try {
      const created = await db.createRecipe(recipe, operationId);
      await get().refresh(created.id);
      toast()(feedback().recipes.recipeCreated, 'success');
      return created;
    } catch (error) {
      console.error('Failed to create recipe:', error);
      toast()(errorCode(error) === 'unknown' ? feedback().recipes.createRecipeError : errorText(error, appErrorTexts()), 'error');
      throw error;
    }
  },

  updateRecipe: async (recipe, operationId) => {
    try {
      await db.updateRecipe(recipe, operationId);
      await get().refresh(recipe.id);
      toast()(feedback().recipes.recipeUpdated, 'success');
    } catch (error) {
      console.error('Failed to update recipe:', error);
      toast()(errorCode(error) === 'unknown' ? feedback().recipes.updateRecipeError : errorText(error, appErrorTexts()), 'error');
      throw error;
    }
  },

  deleteRecipe: async (recipeId) => {
    try {
      await db.deleteRecipe(recipeId);
      set((state) => {
        const details = { ...state.details };
        delete details[recipeId];
        const without = (list: Recipe[]) => list.filter((r) => r.id !== recipeId);
        return {
          cards: without(state.cards),
          index: without(state.index),
          mine: without(state.mine),
          details,
          favoriteRecipes: state.favoriteRecipes.filter((id) => id !== recipeId),
        };
      });
      toast()(feedback().recipes.recipeDeleted, 'success');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      toast()(feedback().recipes.deleteRecipeError, 'error');
      throw error;
    }
  },

  refresh: async (recipeId) => {
    const { cardsFilters, indexLoaded, mineLoaded, details } = get();
    const jobs: Promise<unknown>[] = [];
    if (cardsFilters) jobs.push(get().loadCards(cardsFilters, { silent: true }));
    if (indexLoaded) jobs.push(get().ensureIndex({ force: true }));
    if (mineLoaded) jobs.push(get().loadMine({ force: true }));
    if (recipeId) {
      if (details[recipeId]) jobs.push(get().loadRecipe(recipeId, { force: true }).catch(() => null));
    } else {
      // Login, saída ou assinatura: o que cada pessoa pode ver muda; receitas abertas antes saem.
      set({ details: {} });
    }
    await Promise.all(jobs);
  },

  clearUserData: () => set({ favoriteRecipes: [], mine: [], mineLoaded: false }),
}));
