import { create } from 'zustand';
import { useAuthStore } from './auth';
import { getShoppingList, saveShoppingList } from '../services/care';
import { buildShoppingItems, mergeShoppingItems, type ShoppingItem, type ShoppingSource } from '../lib/ingredients';

interface ShoppingListState {
  items: ShoppingItem[];
  loaded: boolean;
  fetch: (userId: string) => Promise<void>;
  addSources: (sources: ShoppingSource[]) => Promise<number>;
  addCustom: (name: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearChecked: () => Promise<void>;
  clearAll: () => Promise<void>;
  reset: () => void;
}

// Gravações em fila: marcar vários itens rápido não chega fora de ordem.
let writeQueue: Promise<unknown> = Promise.resolve();

export const useShoppingListStore = create<ShoppingListState>()((set, get) => {
  // Antes de mudar a lista, garante que a salva foi carregada: senão a gravação trocaria
  // a lista inteira só pelo item novo.
  const ensureLoaded = async () => {
    if (get().loaded) return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('Faça login para salvar a lista de compras.');
    const items = await getShoppingList(userId);
    set({ items, loaded: true });
  };

  const persist = async (items: ShoppingItem[]) => {
    const previous = get().items;
    set({ items });
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('Faça login para salvar a lista de compras.');
    try {
      await (writeQueue = writeQueue.catch(() => undefined).then(() => saveShoppingList(userId, items)));
    } catch (error) {
      set({ items: previous });
      throw error;
    }
  };

  return {
    items: [],
    loaded: false,

    fetch: async (userId) => {
      try {
        set({ items: await getShoppingList(userId), loaded: true });
      } catch (error) {
        console.error('Error fetching shopping list:', error);
        set({ loaded: true });
      }
    },

    addSources: async (sources) => {
      await ensureLoaded();
      const added = buildShoppingItems(sources);
      await persist(mergeShoppingItems(get().items, added));
      return added.length;
    },

    addCustom: async (name) => {
      const clean = name.trim().slice(0, 120);
      if (!clean) return;
      await ensureLoaded();
      const item: ShoppingItem = { id: `custom-${Date.now()}`, name: clean, quantity: '', checked: false, recipes: [] };
      await persist([...get().items, item]);
    },

    toggle: (id) => persist(get().items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))),
    remove: (id) => persist(get().items.filter((i) => i.id !== id)),
    clearChecked: () => persist(get().items.filter((i) => !i.checked)),
    clearAll: () => persist([]),
    reset: () => set({ items: [], loaded: false }),
  };
});
