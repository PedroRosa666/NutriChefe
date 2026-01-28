import { useSettingsStore } from '../store/settings';
import { translations } from '../lib/i18n/translations';

export function useTranslation() {
  const { language } = useSettingsStore();
  return translations[language];
}