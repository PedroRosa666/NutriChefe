import { create } from 'zustand';

interface FiltersState {
  category: string;
  searchQuery: string;
  difficulty: string | null;
  prepTimeRange: string | null;
  minRating: number | null;
  sortBy: string;
  setCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setDifficulty: (difficulty: string | null) => void;
  setPrepTimeRange: (range: string | null) => void;
  setMinRating: (rating: number | null) => void;
  setSortBy: (sort: string) => void;
  resetFilters: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  category: 'All',
  searchQuery: '',
  difficulty: null,
  prepTimeRange: null,
  minRating: null,
  sortBy: '',
  setCategory: (category) => set({ category }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setPrepTimeRange: (prepTimeRange) => set({ prepTimeRange }),
  setMinRating: (minRating) => set({ minRating }),
  setSortBy: (sortBy) => set({ sortBy }),
  resetFilters: () => set({
    category: 'All',
    searchQuery: '',
    difficulty: null,
    prepTimeRange: null,
    minRating: null,
    sortBy: ''
  }),
}));