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

/** Primeiro nome para a saudação, sem títulos como "Dra." ou "Dr.". */
export function firstNameOf(name: string | undefined | null, fallback: string): string {
  const words = (name ?? '').split(/\s+/).filter(Boolean);
  const first = words.find((w) => !/^(dr|dra|prof|profa|sr|sra)\.?$/i.test(w));
  return first ?? fallback;
}
