import { useSettingsStore } from '../store/settings';
import { translationsFor, useLoadedLanguages, type Translations } from '../lib/i18n/translations';

export type { Translations };

export function useTranslation(): Translations {
  const language = useSettingsStore((s) => s.language);
  // Redesenha quando o inglês termina de baixar.
  useLoadedLanguages((s) => s.version);
  return translationsFor(language);
}
