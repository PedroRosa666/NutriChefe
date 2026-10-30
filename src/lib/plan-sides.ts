// Acompanhamentos da Tabela TACO que o gerador de plano pode acrescentar a uma refeição para chegar
// às metas do dia, e as regras para o prato continuar com cara de prato: o que combina com cada
// refeição, quanto é uma porção de verdade e o que não vai junto (arroz em cima de risoto, frango
// num prato vegano, feijão do lado da feijoada).
import { normalizeText } from '../../supabase/functions/_shared/recipe-search';
import type { MealSlot } from '../services/care';
import type { Food } from '../services/foods';
import type { Recipe } from '../types/recipe';
import type { GoalKey, NutritionGoals } from '../store/nutrition-goals';
import type { NutritionTotals } from '../store/nutrition-tracking';
import { quantityLabel } from './food-math';
import { PLAN_GOAL_KEYS } from './plan-goals';

export type SideGroup = 'carb' | 'legume' | 'protein' | 'egg' | 'veg' | 'bread' | 'cereal' | 'fruit' | 'dairy' | 'nuts' | 'fat';

export interface SideSpec {
  /** Id do alimento na Tabela TACO (o mesmo em qualquer instalação). */
  taco: number;
  group: SideGroup;
  slots: MealSlot[];
  /** Porção mínima e máxima que faz sentido no prato, em gramas. */
  min: number;
  max: number;
}

const MAIN: MealSlot[] = ['lunch', 'dinner'];
const MORNING: MealSlot[] = ['breakfast', 'snack'];

export const SIDE_SPECS: SideSpec[] = [
  // Base do prato: arroz e tubérculos.
  { taco: 3, group: 'carb', slots: MAIN, min: 50, max: 200 }, // arroz branco cozido
  { taco: 1, group: 'carb', slots: MAIN, min: 50, max: 200 }, // arroz integral cozido
  { taco: 88, group: 'carb', slots: MAIN, min: 75, max: 200 }, // batata-doce cozida
  { taco: 91, group: 'carb', slots: MAIN, min: 75, max: 200 }, // batata inglesa cozida
  { taco: 129, group: 'carb', slots: MAIN, min: 50, max: 150 }, // mandioca cozida
  { taco: 533, group: 'carb', slots: [...MAIN, 'breakfast'], min: 50, max: 150 }, // cuscuz de milho
  // Leguminosas.
  { taco: 561, group: 'legume', slots: MAIN, min: 70, max: 140 }, // feijão carioca
  { taco: 577, group: 'legume', slots: MAIN, min: 70, max: 140 }, // lentilha cozida
  // Proteína.
  { taco: 410, group: 'protein', slots: MAIN, min: 50, max: 120 }, // peito de frango grelhado
  { taco: 377, group: 'protein', slots: MAIN, min: 50, max: 120 }, // patinho grelhado
  { taco: 277, group: 'protein', slots: MAIN, min: 40, max: 100 }, // atum
  { taco: 488, group: 'egg', slots: ['breakfast', 'lunch', 'dinner', 'snack'], min: 50, max: 100 }, // ovo cozido
  // Salada e legumes.
  { taco: 78, group: 'veg', slots: MAIN, min: 30, max: 80 }, // alface
  { taco: 157, group: 'veg', slots: MAIN, min: 50, max: 120 }, // tomate
  { taco: 110, group: 'veg', slots: MAIN, min: 35, max: 105 }, // cenoura crua
  { taco: 100, group: 'veg', slots: MAIN, min: 50, max: 120 }, // brócolis cozido
  { taco: 70, group: 'veg', slots: MAIN, min: 50, max: 120 }, // abobrinha cozida
  { taco: 142, group: 'veg', slots: MAIN, min: 50, max: 100 }, // pepino
  // Café da manhã e lanche.
  { taco: 53, group: 'bread', slots: ['breakfast'], min: 50, max: 100 }, // pão francês
  { taco: 52, group: 'bread', slots: MORNING, min: 25, max: 75 }, // pão de forma integral
  { taco: 7, group: 'cereal', slots: MORNING, min: 15, max: 45 }, // aveia em flocos
  { taco: 182, group: 'fruit', slots: MORNING, min: 70, max: 140 }, // banana-prata
  { taco: 222, group: 'fruit', slots: MORNING, min: 130, max: 130 }, // maçã fuji
  { taco: 225, group: 'fruit', slots: MORNING, min: 100, max: 200 }, // mamão formosa
  { taco: 226, group: 'fruit', slots: MORNING, min: 150, max: 150 }, // mamão papaia
  { taco: 214, group: 'fruit', slots: MORNING, min: 100, max: 200 }, // laranja-pera
  { taco: 239, group: 'fruit', slots: MORNING, min: 60, max: 144 }, // morango
  { taco: 448, group: 'dairy', slots: MORNING, min: 170, max: 170 }, // iogurte natural
  { taco: 449, group: 'dairy', slots: MORNING, min: 170, max: 170 }, // iogurte natural desnatado
  { taco: 461, group: 'dairy', slots: MORNING, min: 30, max: 60 }, // queijo minas frescal
  { taco: 589, group: 'nuts', slots: ['snack'], min: 8, max: 20 }, // castanha-do-pará
  { taco: 557, group: 'nuts', slots: ['snack'], min: 15, max: 30 }, // amendoim
  { taco: 163, group: 'fat', slots: MORNING, min: 30, max: 90 }, // abacate
  { taco: 260, group: 'fat', slots: MAIN, min: 6, max: 13 }, // azeite (na salada)
];

/** No máximo 4 acompanhamentos no dia; até 3 no almoço e no jantar (arroz, feijão e salada), 2 nas outras. */
export const MAX_SIDES_PER_DAY = 4;
export const maxSidesPerMeal = (slot: MealSlot) => (slot === 'lunch' || slot === 'dinner' ? 3 : 2);

// O que o prato já tem, pelo nome e descrição: um acompanhamento do mesmo tipo ficaria repetido.
const HAS: { group: SideGroup[]; words: string[] }[] = [
  { group: ['carb', 'bread', 'cereal'], words: ['arroz', 'risoto', 'macarrao', 'massa', 'espaguete', 'nhoque', 'batata', 'mandioca', 'mandioquinha', 'pure', 'cuscuz', 'quinoa', 'polenta', 'tapioca', 'pao', 'sanduiche', 'wrap', 'panqueca', 'crepioca', 'aveia', 'granola', 'torrada'] },
  { group: ['legume'], words: ['feijao', 'feijoada', 'lentilha', 'grao de bico', 'ervilha', 'tutu'] },
  { group: ['protein'], words: ['frango', 'carne', 'bovina', 'patinho', 'peixe', 'salmao', 'atum', 'camarao', 'tilapia', 'porco', 'lombo', 'peru', 'bacalhau'] },
  { group: ['egg'], words: ['ovo', 'omelete', 'sufle', 'fritada'] },
  { group: ['veg'], words: ['salada'] },
  { group: ['dairy'], words: ['iogurte', 'queijo', 'ricota', 'coalhada'] },
];
const DESSERT = ['bolo', 'pudim', 'cookie', 'biscoito', 'brownie', 'mousse', 'doce', 'sobremesa', 'trufa', 'barozzi', 'frutas vermelhas', 'sorvete'];
// Prato doce só ganha fruta, laticínio ou oleaginosa (bolo com arroz, ovo ou salada não é refeição).
const DESSERT_OK: SideGroup[] = ['fruit', 'dairy', 'nuts'];

/** Tipos de acompanhamento que não combinam com esta receita. */
export function blockedGroupsFor(recipe: Recipe): Set<SideGroup> {
  // Palavra inteira ("ovo" não acha "novo"); "batata doce" não é doce de sobremesa.
  const t = ` ${normalizeText(`${recipe.title} ${recipe.description}`)} `;
  const has = (w: string) => t.includes(` ${w} `) || t.includes(` ${w}s `);
  const blocked = new Set<SideGroup>();
  for (const { group, words } of HAS) if (words.some(has)) group.forEach((g) => blocked.add(g));
  // Prato vegano ou vegetariano continua vegano/vegetariano, mesmo para quem come carne.
  if (recipe.category === 'vegan' || recipe.category === 'vegetarian') blocked.add('protein');
  if (recipe.category === 'vegan') ['egg', 'dairy'].forEach((g) => blocked.add(g as SideGroup));
  if (DESSERT.some((w) => has(w)) && !has('batata doce')) {
    for (const g of ['carb', 'legume', 'protein', 'egg', 'veg', 'bread', 'cereal', 'fat'] as SideGroup[]) if (!DESSERT_OK.includes(g)) blocked.add(g);
  }
  return blocked;
}

/**
 * Pode entrar na refeição? Mesmo tipo só uma vez, nada que o prato já tenha, limite por refeição,
 * e o azeite só onde já há salada (é tempero, não prato).
 */
export function sideFits(spec: SideSpec, slot: MealSlot, recipes: Recipe[], mealSides: SideSpec[]): boolean {
  if (!spec.slots.includes(slot)) return false;
  if (mealSides.length >= maxSidesPerMeal(slot)) return false;
  if (mealSides.some((s) => s.group === spec.group)) return false;
  if (recipes.some((r) => blockedGroupsFor(r).has(spec.group))) return false;
  if (spec.taco === 260 && !mealSides.some((s) => s.group === 'veg')) return false;
  return true;
}

/**
 * Porções possíveis, na medida caseira do catálogo quando há (meia medida só nas grandes, como
 * concha e filé) e dentro do mínimo e máximo do acompanhamento; sem medida, de 25 em 25 g.
 */
export function sideAmounts(food: Food, spec: SideSpec): { grams: number; label: string }[] {
  const measure = food.measures.find((m) => m.grams > 0);
  const out: { grams: number; label: string }[] = [];
  if (measure) {
    const step = measure.grams >= 100 ? 0.5 : 1;
    for (let n = step; n <= 12; n += step) {
      const grams = Math.round(n * measure.grams);
      if (grams > spec.max) break;
      if (grams >= spec.min) out.push({ grams, label: quantityLabel(n, measure) });
    }
  }
  if (!out.length) {
    for (let g = spec.min; g <= spec.max; g += 25) out.push({ grams: g, label: quantityLabel(g, null) });
  }
  return out;
}

/**
 * Por que o acompanhamento entrou: as metas em que ele mais diminuiu a falta no dia (no máximo
 * duas). Vazio quando ele não completou nada (não deveria acontecer: só entra se aproxima o dia).
 */
export function sideReason(without: NutritionTotals, withSide: NutritionTotals, goals: Partial<NutritionGoals>): GoalKey[] {
  const gains = PLAN_GOAL_KEYS.flatMap((key) => {
    const goal = goals[key] ?? 0;
    if (goal <= 0) return [];
    const gap = (t: NutritionTotals) => Math.max(0, goal - t[key]) / goal;
    const gain = gap(without) - gap(withSide);
    return gain > 0.02 ? [{ key, gain }] : [];
  }).sort((a, b) => b.gain - a.gain);
  if (!gains.length) return [];
  return gains.filter((g) => g.gain >= gains[0].gain * 0.5).slice(0, 2).map((g) => g.key);
}
