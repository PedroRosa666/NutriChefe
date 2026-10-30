import { create } from 'zustand';
import { pt, type Translations } from './pt';

export type { Translations };
export type Language = 'en' | 'pt';

// O português vai no pacote inicial; o inglês é baixado na primeira vez em que é escolhido
// (economiza ~25 KB gzip para quem usa o app em português). Enquanto baixa, os textos ficam
// em português e trocam sozinhos quando o inglês chega.
const loaded: Partial<Record<Language, Translations>> = { pt };
let enPromise: Promise<void> | null = null;

/** Muda quando um idioma termina de baixar: quem usa useTranslation redesenha. */
export const useLoadedLanguages = create<{ version: number }>(() => ({ version: 0 }));

export function loadLanguage(language: Language): Promise<void> {
  if (loaded[language]) return Promise.resolve();
  enPromise ??= import('./en').then(({ en }) => {
    loaded.en = en;
    useLoadedLanguages.setState((s) => ({ version: s.version + 1 }));
  });
  return enPromise;
}

/** Textos do idioma pedido; enquanto o inglês não chegou, os do português. */
export function translationsFor(language: Language): Translations {
  if (!loaded[language]) void loadLanguage(language);
  return loaded[language] ?? pt;
}

/** Idiomas já carregados (para comparar mensagens vindas de qualquer um deles). */
export function loadedTranslations(): Translations[] {
  return Object.values(loaded) as Translations[];
}


export function getSpecializationTranslation(spec: string, language: Language): string {
  const specMap: Record<string, keyof Translations['nutritionists']['specializations']> = {
    'sports': 'sports',
    'Sports Nutrition': 'sports',
    'Nutrição Esportiva': 'sports',
    'clinical': 'clinical',
    'Clinical Nutrition': 'clinical',
    'Nutrição Clínica': 'clinical',
    'weightLoss': 'weightLoss',
    'Weight Loss': 'weightLoss',
    'Emagrecimento': 'weightLoss',
    'womensHealth': 'womensHealth',
    'Women\'s Health': 'womensHealth',
    'Saúde da Mulher': 'womensHealth',
    'pediatric': 'pediatric',
    'Pediatric Nutrition': 'pediatric',
    'Nutrição Pediátrica': 'pediatric',
    'geriatric': 'geriatric',
    'Geriatric Nutrition': 'geriatric',
    'Nutrição Geriátrica': 'geriatric',
    'vegetarian': 'vegetarian',
    'Vegetarian/Vegan': 'vegetarian',
    'Vegetariano/Vegano': 'vegetarian',
    'diabetes': 'diabetes',
    'Diabetes Management': 'diabetes',
    'Controle de Diabetes': 'diabetes',
    'cardiovascular': 'cardiovascular',
    'Cardiovascular Health': 'cardiovascular',
    'Saúde Cardiovascular': 'cardiovascular',
    'gastrointestinal': 'gastrointestinal',
    'Gastrointestinal Health': 'gastrointestinal',
    'Saúde Gastrointestinal': 'gastrointestinal',
  };

  const key = specMap[spec];
  if (key) {
    return translationsFor(language).nutritionists.specializations[key];
  }

  return spec;
}
