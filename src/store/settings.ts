import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../lib/i18n/translations';

type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'pt',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'settings',
    }
  )
);