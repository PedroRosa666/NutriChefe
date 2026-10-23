import { useSettingsStore } from '../store/settings';

/** Locale das datas e números conforme o idioma escolhido no app (não o do navegador). */
export function appLocale(): string {
  return useSettingsStore.getState().language === 'pt' ? 'pt-BR' : 'en-US';
}

/** Número no formato do idioma atual, até 1 casa: 1,5 em português e 1.5 em inglês. */
export function fmtNum(value: number): string {
  const locale = useSettingsStore.getState().language === 'pt' ? 'pt-BR' : 'en';
  return value.toLocaleString(locale, { maximumFractionDigits: 1 });
}
