// Rendimento, porção e base dos nutrientes da receita (supabase/migrations/20261107120000_recipe_yield.sql).
// O banco é quem converte para "uma porção" (recipe_per_serving); a conta daqui é a mesma e serve
// só para a prévia do formulário. Lista de compras, tela e PDF usam o mesmo fator de escala.
import { parseNumber } from './ingredients';
import type { RecipeIngredient } from '../types/recipe';

export const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Base em que o autor declarou os nutrientes. legacy_unit: receita antiga, ainda não revisada. */
export type NutritionBasis = 'per_serving' | 'whole_recipe' | 'legacy_unit';
export type NutritionStatus = 'complete' | 'partial' | 'unknown' | 'manual_declared';

/** Nutrientes como o autor escreveu; chave ausente = desconhecido (nunca zero). */
export type DeclaredNutrition = Partial<Record<NutrientKey, number>>;

/** Os mesmos limites do banco. */
export const RECIPE_LIMITS = {
  maxYield: 1000,
  maxWeightG: 100000,
  maxNutrient: 100000,
  ingredients: 100,
  ingredientText: 300,
  ingredientNote: 200,
  servingLabel: 80,
} as const;

/**
 * Número digitado pela pessoa: "1,5", "1.5", "1/2", "1 1/2" ou "½". null quando vazio; NaN quando
 * não é número (para a tela recusar em vez de virar zero).
 */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = parseNumber(t);
  return n === null ? NaN : n;
}

/** Rendimento aceito: número finito maior que zero e até 1000 porções. */
export const isValidYield = (value: number | null): boolean =>
  value === null || (Number.isFinite(value) && value > 0 && value <= RECIPE_LIMITS.maxYield);

/** Valores de uma porção a partir do declarado (mesma conta de recipe_per_serving no banco). */
export function perServing(declared: DeclaredNutrition, basis: NutritionBasis, yieldServings: number | null): DeclaredNutrition {
  const out: DeclaredNutrition = {};
  if (basis === 'whole_recipe' && !(yieldServings && yieldServings > 0)) return out;
  for (const key of NUTRIENT_KEYS) {
    const value = declared[key];
    if (value === undefined || value === null || !Number.isFinite(value)) continue;
    out[key] = basis === 'whole_recipe' ? Math.round((value / yieldServings!) * 100) / 100 : value;
  }
  return out;
}

/** Situação dos dados declarados à mão (a mesma regra do banco). */
export function declaredStatus(declared: DeclaredNutrition): NutritionStatus {
  const count = NUTRIENT_KEYS.filter((k) => declared[k] !== undefined).length;
  return count === NUTRIENT_KEYS.length ? 'manual_declared' : count === 0 ? 'unknown' : 'partial';
}

interface ScalableRecipe {
  yieldServings?: number | null;
  nutritionBasis?: NutritionBasis;
}

/**
 * Quanto do preparo entra para `servings` porções (lista de compras, tela e PDF usam este fator).
 * Com rendimento conhecido, receita revisada: porções ÷ rendimento (200 g de farinha em 8 porções,
 * 2 porções = 50 g). Receita antiga: a regra de antes (as quantidades da receita por porção).
 */
export function ingredientFactor(recipe: ScalableRecipe, servings: number): number {
  const legacy = !recipe.nutritionBasis || recipe.nutritionBasis === 'legacy_unit';
  if (legacy || !recipe.yieldServings || recipe.yieldServings <= 0) return servings;
  return servings / recipe.yieldServings;
}

/**
 * Pode entrar no ajuste automático (gerador e IA): nutrientes declarados completos ou calculados
 * completos. Receita antiga sem revisão segue como antes.
 */
export const hasUsableNutrition = (recipe: { nutritionStatus?: NutritionStatus }) =>
  !recipe.nutritionStatus || recipe.nutritionStatus === 'manual_declared' || recipe.nutritionStatus === 'complete';

/** Campos do formulário como a pessoa digitou (texto), para aceitar "1,5" e "1/2" sem perder nada. */
export interface NutritionDraft {
  yieldServings: string;
  servingLabel: string;
  servingWeightG: string;
  finalWeightG: string;
  basis: NutritionBasis;
  values: Record<NutrientKey, string>;
}

export interface NutritionFields {
  yieldServings: number | null;
  servingLabel: string;
  servingWeightG: number | null;
  finalWeightG: number | null;
  nutritionBasis: NutritionBasis;
  nutritionDeclared: DeclaredNutrition;
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

export function nutritionDraftFrom(
  recipe: Partial<NutritionFields> & { nutritionFacts?: Partial<Record<NutrientKey, number>>; unknownNutrients?: NutrientKey[] }
): NutritionDraft {
  // Sem o declarado (receita vinda de um cartão): os valores de uma porção, então base "por porção".
  const fromFacts = !recipe.nutritionDeclared;
  const declared: DeclaredNutrition = recipe.nutritionDeclared ?? recipe.nutritionFacts ?? {};
  const unknown = fromFacts ? recipe.unknownNutrients ?? [] : [];
  const basis = recipe.nutritionBasis ?? 'per_serving';
  return {
    yieldServings: text(recipe.yieldServings),
    servingLabel: recipe.servingLabel ?? '',
    servingWeightG: text(recipe.servingWeightG),
    finalWeightG: text(recipe.finalWeightG),
    basis: fromFacts && basis === 'whole_recipe' ? 'per_serving' : basis,
    values: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, unknown.includes(k) ? '' : text(declared[k])])) as Record<NutrientKey, string>,
  };
}

export type NutritionDraftError =
  | { error: 'invalidYield' }
  | { error: 'wholeNeedsYield' }
  | { error: 'invalidNumber'; field: 'servingWeightG' | 'finalWeightG' | NutrientKey };

/** Lê o formulário: número inválido é recusado (nunca vira zero); vazio = não informado. */
export function readNutritionDraft(draft: NutritionDraft): { ok: true; value: NutritionFields } | ({ ok: false } & NutritionDraftError) {
  const yieldServings = parseAmount(draft.yieldServings);
  if (!isValidYield(yieldServings)) return { ok: false, error: 'invalidYield' };
  if (draft.basis === 'whole_recipe' && yieldServings === null) return { ok: false, error: 'wholeNeedsYield' };
  const weight = (field: 'servingWeightG' | 'finalWeightG') => {
    const n = parseAmount(draft[field]);
    return n === null || (Number.isFinite(n) && n > 0 && n <= RECIPE_LIMITS.maxWeightG) ? n : undefined;
  };
  const servingWeightG = weight('servingWeightG');
  if (servingWeightG === undefined) return { ok: false, error: 'invalidNumber', field: 'servingWeightG' };
  const finalWeightG = weight('finalWeightG');
  if (finalWeightG === undefined) return { ok: false, error: 'invalidNumber', field: 'finalWeightG' };
  const nutritionDeclared: DeclaredNutrition = {};
  for (const key of NUTRIENT_KEYS) {
    const n = parseAmount(draft.values[key]);
    if (n === null) continue;
    if (!Number.isFinite(n) || n < 0 || n > RECIPE_LIMITS.maxNutrient) return { ok: false, error: 'invalidNumber', field: key };
    nutritionDeclared[key] = n;
  }
  return {
    ok: true,
    value: {
      yieldServings,
      servingLabel: draft.servingLabel.trim().slice(0, RECIPE_LIMITS.servingLabel),
      servingWeightG,
      finalWeightG,
      nutritionBasis: draft.basis,
      nutritionDeclared,
    },
  };
}

export const emptyIngredient = (): RecipeIngredient => ({ text: '', foodId: null, foodName: null, quantity: null, unit: null, note: '' });

interface DraftErrorTexts {
  invalidYield: string;
  wholeNeedsYield: string;
  invalidNumber: string;
  servingWeight: string;
  finalWeight: string;
}

/** Frase do erro de leitura do formulário (rendimento ou número inválido). */
export function nutritionDraftMessage(error: NutritionDraftError, texts: DraftErrorTexts, nutrientNames: Record<NutrientKey, string>): string {
  if (error.error === 'invalidYield') return texts.invalidYield;
  if (error.error === 'wholeNeedsYield') return texts.wholeNeedsYield;
  const label = error.field === 'servingWeightG' ? texts.servingWeight : error.field === 'finalWeightG' ? texts.finalWeight : nutrientNames[error.field];
  return texts.invalidNumber.replace('{field}', label);
}
