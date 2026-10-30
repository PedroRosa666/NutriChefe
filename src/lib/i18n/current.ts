import { useSettingsStore } from '../../store/settings';
import { translationsFor } from './translations';

// Textos do idioma atual, para código fora do React (stores e services).
function currentTranslations() {
  return translationsFor(useSettingsStore.getState().language);
}

// Atalho para o bloco de avisos (toasts e erros mostrados ao usuário).
export function feedback() {
  return currentTranslations().feedback;
}

// Frases dos erros com código estável (src/lib/app-errors.ts).
export function appErrorTexts() {
  return currentTranslations().appErrors;
}
