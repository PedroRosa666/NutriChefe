import { create } from 'zustand';
import * as foodsService from '../services/foods';
import type { Food, FoodInput } from '../services/foods';

interface FoodsState {
  foods: Food[];
  loaded: boolean;
  loading: boolean;
  /** Carrega o catálogo uma vez por sessão (cerca de 600 itens). `force` recarrega. */
  fetch: (force?: boolean) => Promise<void>;
  create: (ownerId: string, input: FoodInput) => Promise<Food>;
  update: (id: string, input: FoodInput) => Promise<Food>;
  remove: (id: string) => Promise<void>;
  clear: () => void;
}

const byName = (a: Food, b: Food) => a.name.localeCompare(b.name, 'pt-BR');

export const useFoodsStore = create<FoodsState>((set, get) => ({
  foods: [],
  loaded: false,
  loading: false,

  fetch: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    try {
      const foods = await foodsService.listFoods();
      set({ foods, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  create: async (ownerId, input) => {
    const food = await foodsService.createFood(ownerId, input);
    set({ foods: [...get().foods, food].sort(byName) });
    return food;
  },

  update: async (id, input) => {
    const food = await foodsService.updateFood(id, input);
    set({ foods: get().foods.map((f) => (f.id === id ? food : f)).sort(byName) });
    return food;
  },

  remove: async (id) => {
    await foodsService.deleteFood(id);
    set({ foods: get().foods.filter((f) => f.id !== id) });
  },

  // Ao trocar de conta: os alimentos próprios visíveis mudam.
  clear: () => set({ foods: [], loaded: false }),
}));
