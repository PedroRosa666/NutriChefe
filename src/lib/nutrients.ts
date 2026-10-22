// Nutrientes completos do catálogo de alimentos (Tabela TACO, valores por 100 g).
// As chaves são as mesmas do campo `foods.nutrients` e de `per_serving` no diário.

export type NutrientGroup = 'energy' | 'fats' | 'minerals' | 'vitamins';

export type ExtraNutrientKey =
  | 'moisture'
  | 'kj'
  | 'ash'
  | 'cholesterol'
  | 'saturated'
  | 'monounsaturated'
  | 'polyunsaturated'
  | 'trans'
  | 'calcium'
  | 'magnesium'
  | 'manganese'
  | 'phosphorus'
  | 'iron'
  | 'potassium'
  | 'copper'
  | 'zinc'
  | 'retinol'
  | 'rae'
  | 'thiamin'
  | 'riboflavin'
  | 'pyridoxine'
  | 'niacin'
  | 'vitaminC';

export type ExtraNutrients = Partial<Record<ExtraNutrientKey, number>>;

export interface NutrientInfo {
  key: ExtraNutrientKey;
  pt: string;
  en: string;
  unit: 'g' | 'mg' | 'µg' | 'kJ';
  group: NutrientGroup;
}

export const EXTRA_NUTRIENTS: NutrientInfo[] = [
  { key: 'kj', pt: 'Energia', en: 'Energy', unit: 'kJ', group: 'energy' },
  { key: 'moisture', pt: 'Umidade', en: 'Moisture', unit: 'g', group: 'energy' },
  { key: 'ash', pt: 'Cinzas', en: 'Ash', unit: 'g', group: 'energy' },
  { key: 'saturated', pt: 'Gorduras saturadas', en: 'Saturated fat', unit: 'g', group: 'fats' },
  { key: 'monounsaturated', pt: 'Gorduras monoinsaturadas', en: 'Monounsaturated fat', unit: 'g', group: 'fats' },
  { key: 'polyunsaturated', pt: 'Gorduras poli-insaturadas', en: 'Polyunsaturated fat', unit: 'g', group: 'fats' },
  { key: 'trans', pt: 'Gorduras trans', en: 'Trans fat', unit: 'g', group: 'fats' },
  { key: 'cholesterol', pt: 'Colesterol', en: 'Cholesterol', unit: 'mg', group: 'fats' },
  { key: 'calcium', pt: 'Cálcio', en: 'Calcium', unit: 'mg', group: 'minerals' },
  { key: 'iron', pt: 'Ferro', en: 'Iron', unit: 'mg', group: 'minerals' },
  { key: 'magnesium', pt: 'Magnésio', en: 'Magnesium', unit: 'mg', group: 'minerals' },
  { key: 'phosphorus', pt: 'Fósforo', en: 'Phosphorus', unit: 'mg', group: 'minerals' },
  { key: 'potassium', pt: 'Potássio', en: 'Potassium', unit: 'mg', group: 'minerals' },
  { key: 'zinc', pt: 'Zinco', en: 'Zinc', unit: 'mg', group: 'minerals' },
  { key: 'copper', pt: 'Cobre', en: 'Copper', unit: 'mg', group: 'minerals' },
  { key: 'manganese', pt: 'Manganês', en: 'Manganese', unit: 'mg', group: 'minerals' },
  { key: 'rae', pt: 'Vitamina A (RAE)', en: 'Vitamin A (RAE)', unit: 'µg', group: 'vitamins' },
  { key: 'retinol', pt: 'Retinol', en: 'Retinol', unit: 'µg', group: 'vitamins' },
  { key: 'thiamin', pt: 'Tiamina (B1)', en: 'Thiamin (B1)', unit: 'mg', group: 'vitamins' },
  { key: 'riboflavin', pt: 'Riboflavina (B2)', en: 'Riboflavin (B2)', unit: 'mg', group: 'vitamins' },
  { key: 'niacin', pt: 'Niacina (B3)', en: 'Niacin (B3)', unit: 'mg', group: 'vitamins' },
  { key: 'pyridoxine', pt: 'Piridoxina (B6)', en: 'Pyridoxine (B6)', unit: 'mg', group: 'vitamins' },
  { key: 'vitaminC', pt: 'Vitamina C', en: 'Vitamin C', unit: 'mg', group: 'vitamins' },
];

const KEYS = new Set<string>(EXTRA_NUTRIENTS.map((n) => n.key));

/** Mantém só chaves conhecidas com número válido (o resto é "não analisado"). */
export function cleanExtraNutrients(value: unknown): ExtraNutrients {
  if (!value || typeof value !== 'object') return {};
  const out: ExtraNutrients = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(v);
    if (KEYS.has(k) && v !== null && v !== '' && Number.isFinite(n) && n >= 0) out[k as ExtraNutrientKey] = n;
  }
  return out;
}

/** Escala os nutrientes (por 100 g) para `grams` gramas, com precisão conforme o tamanho do número. */
export function scaleExtraNutrients(per100g: ExtraNutrients, grams: number): ExtraNutrients {
  const f = grams / 100;
  const out: ExtraNutrients = {};
  for (const [k, v] of Object.entries(per100g) as [ExtraNutrientKey, number][]) {
    const x = v * f;
    out[k] = x >= 100 ? Math.round(x) : x >= 1 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100;
  }
  return out;
}
