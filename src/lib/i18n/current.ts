import { useSettingsStore } from '../../store/settings';
import { translations } from './translations';

// Textos do idioma atual, para código fora do React (stores e services).
export function currentTranslations() {
  return translations[useSettingsStore.getState().language];
}

// Atalho para o bloco de avisos (toasts e erros mostrados ao usuário).
export function feedback() {
  return currentTranslations().feedback;
}
