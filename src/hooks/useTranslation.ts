import { useSettingsStore } from '../store/settings';
import { translations } from '../lib/i18n/translations';

export type Translations = (typeof translations)[keyof typeof translations];

export function useTranslation(): Translations {
  const { language } = useSettingsStore();
  return translations[language];
}