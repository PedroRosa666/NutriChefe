// Cardápio semanal automático a partir do catálogo: respeita alergias e
// preferências do perfil de saúde e escolhe receitas e porções para chegar perto
// de todas as metas do dia (calorias, proteína, carboidrato, gordura e fibra), sem estourar. Quando
// as receitas não fecham, completa com acompanhamentos da Tabela TACO (até 4 por dia), como o
// nutricionista faria: arroz, feijão e salada no almoço, pão, fruta ou iogurte no café. As regras de
// prato (plan-sides.ts) evitam combinações estranhas e porções exageradas. Roda no navegador, sem IA.
import { blockedTerms, normalizeText, textHasBlocked, withoutAllergens, type SearchableRecipe } from '../../supabase/functions/_shared/recipe-search';
import type { Recipe } from '../types/recipe';
import type { MealPlanItem, MealSlot, PlanMeal } from '../services/care';
import { MEAL_SLOTS } from '../services/care';
import { ALL_DAYS, dayShares, mealsOnDay } from './plan-meals';
import { hasUsableNutrition } from './recipe-nutrition';
import { addTotals, belowFloor, goalDistance, goalExcesses, subTotals, ZERO_TOTALS, type GoalExcess } from './plan-goals';
import type { Food } from '../services/foods';
import { nutrientsFor } from './food-math';
import { MAX_SIDES_PER_DAY, SIDE_SPECS, blockedGroupsFor, sideAmounts, sideFits, sideReason, type SideSpec } from './plan-sides';
import type { NutritionGoals } from '../store/nutrition-goals';
import type { NutritionTotals } from '../store/nutrition-tracking';

const SLOT_WORDS: Record<MealSlot, string[]> = {
  breakfast: ['cafe', 'manha', 'panqueca', 'aveia', 'tapioca', 'smoothie', 'vitamina', 'iogurte', 'omelete', 'mingau', 'pao', 'granola', 'crepioca', 'overnight', 'torrada', 'breakfast', 'pancake', 'oat'],
  snack: ['lanche', 'snack', 'bolinho', 'barrinha', 'barra', 'cookie', 'biscoito', 'muffin', 'chips', 'hummus', 'pasta de', 'fruta', 'smoothie', 'mousse', 'brownie', 'doce', 'sobremesa', 'bolo', 'pudim', 'sorvete', 'trufa', 'torta doce'],
  lunch: [],
  dinner: ['sopa', 'caldo', 'creme de', 'salada', 'omelete', 'wrap', 'sanduiche', 'leve'],
};

// Prato de almoço ou jantar pelo nome: mesmo leve, não vai para o café nem para o lanche.
const MAIN_DISH = ['moqueca', 'lasanha', 'risoto', 'strogonoff', 'estrogonofe', 'feijoada', 'escondidinho', 'nhoque', 'fricasse', 'salmao', 'camarao', 'peixe', 'carne', 'frango', 'tofu', 'bowl', 'macarrao', 'massa', 'sopa', 'caldo'];

// Pratos principais: o que não é café da manhã nem lanche.
const MAIN_EXCLUDE = [...SLOT_WORDS.breakfast, ...SLOT_WORDS.snack].filter((w) => !['omelete', 'pao'].includes(w));

// Dietas (vegana, vegetariana, sem glúten, sem lactose) são restrições: nunca são soltas e
// valem pelos ingredientes (DIET_RESTRICTIONS). Estas são só preferências: entram quando
// há variedade e, se não houver, o resultado diz que foram deixadas de lado.
const FLEXIBLE_PREFERENCES: Record<string, (r: Recipe) => boolean> = {
  lowCarb: (r) => r.category === 'lowCarb',
  highProtein: (r) => r.category === 'highProtein',
};

const toSearchable = (r: Recipe): SearchableRecipe & { source: Recipe } => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  ingredients: r.ingredients,
  prepTime: r.prepTime,
  difficulty: r.difficulty,
  rating: r.rating,
  calories: r.nutritionFacts.calories,
  protein: r.nutritionFacts.protein,
  source: r,
});

/** Receitas sem nenhum ingrediente das alergias informadas (mesma regra do gerador e da busca). */
export const recipesWithoutAllergens = (recipes: Recipe[], allergies: string[]): Recipe[] =>
  allergies.length ? withoutAllergens(recipes.map(toSearchable), allergies).map((r) => r.source) : recipes;

const text = (r: Recipe) => normalizeText(`${r.title} ${r.description}`);
const hasAny = (r: Recipe, words: string[]) => {
  const t = text(r);
  return words.some((w) => t.includes(w));
};

function slotCandidates(pool: Recipe[], slot: MealSlot): Recipe[] {
  // Receita marcada pelo autor ("serve no café, no almoço...") vale pela marcação; as outras, pelo nome.
  const tagged = pool.filter((r) => r.mealTypes?.length);
  const fromTags = tagged.filter((r) => r.mealTypes!.includes(slot));
  const untagged = pool.filter((r) => !r.mealTypes?.length);
  let guessed: Recipe[];
  const light = untagged.filter((r) => !hasAny(r, MAIN_DISH));
  if (slot === 'breakfast') guessed = light.filter((r) => hasAny(r, SLOT_WORDS.breakfast));
  else if (slot === 'snack') guessed = light.filter((r) => hasAny(r, SLOT_WORDS.snack) || r.nutritionFacts.calories <= 250);
  else if (slot === 'dinner') {
    const lightDinner = untagged.filter((r) => hasAny(r, SLOT_WORDS.dinner) && !hasAny(r, SLOT_WORDS.snack));
    const mains = untagged.filter((r) => !hasAny(r, MAIN_EXCLUDE));
    guessed = [...new Set([...lightDinner, ...mains])];
  } else guessed = untagged.filter((r) => !hasAny(r, MAIN_EXCLUDE));
  const list = [...fromTags, ...guessed];
  return list.length ? list : pool;
}

export interface GeneratorOptions {
  recipes: Recipe[];
  dailyCalories: number;
  /** Metas de macros e fibra do paciente (0 ou ausente = sem meta para aquele nutriente). */
  goals?: Partial<NutritionGoals>;
  allergies: string[];
  preferences: string[];
  /** Blocos de refeição do plano (padrão: as quatro de sempre). Cada bloco recebe a sua parte da meta do dia. */
  meals?: PlanMeal[];
  /** Semente para variar o resultado ao gerar de novo. */
  seed?: number;
  /** Catálogo de alimentos (TACO): de onde saem os acompanhamentos. Sem ele, só receitas. */
  foods?: Food[];
  /** Receitas que o paciente já pediu para trocar: ficam de fora (se sobrar variedade). */
  avoidRecipeIds?: string[];
  /** Quantas vezes o paciente pulou cada receita: quanto mais, menos ela é escolhida. */
  skippedRecipeIds?: Record<string, number>;
  /** Monta "escolha 1" com uma opção equivalente no almoço e no jantar. */
  alternatives?: boolean;
}

export interface GeneratedPlan {
  items: MealPlanItem[];
  /** Preferências flexíveis que ficaram de fora por falta de receitas (ex.: 'lowCarb'). */
  relaxed: string[];
  /** A divisão das calorias foi sugerida (os blocos não tinham % definidas que somassem 100). */
  suggestedShares: boolean;
  /**
   * Dias que ficaram longe da meta (mais de 10%) mesmo com receitas, porções e acompanhamentos: a
   * diferença aparece para o profissional revisar, a meta não muda.
   */
  offTarget: { day: number; kcal: number; target: number }[];
  /** Nutrientes que ainda passaram da meta (além da folga) em algum dia, por falta de opção no catálogo. */
  overGoals: ({ day: number } & GoalExcess)[];
}

/** As quatro refeições de sempre, para quem chama sem blocos. */
const LEGACY_MEALS: PlanMeal[] = MEAL_SLOTS.map((category) => ({
  id: category,
  name: category,
  category,
  days: ALL_DAYS,
  time: null,
  guidance: '',
  dayOverrides: {},
  kcalShare: null,
}));

export function generateWeeklyPlan(options: GeneratorOptions): MealPlanItem[] {
  return generateWeeklyPlanDetailed(options).items;
}

interface Pick {
  meal: PlanMeal;
  recipe: Recipe;
  servings: number;
}

interface Side {
  meal: PlanMeal;
  food: Food;
  spec: SideSpec;
  grams: number;
  label: string;
}

export function generateWeeklyPlanDetailed({
  recipes,
  dailyCalories,
  goals,
  allergies,
  preferences,
  meals = LEGACY_MEALS,
  seed = Date.now(),
  foods = [],
  avoidRecipeIds = [],
  skippedRecipeIds = {},
  alternatives = false,
}: GeneratorOptions): GeneratedPlan {
  // Alergias e dietas: obrigatórias. Se faltar variedade, as receitas que servem se repetem.
  // Só receitas com nutrientes completos entram no ajuste automático (sem valor não vira zero).
  const usable = recipes.filter(hasUsableNutrition);
  let pool = withoutAllergens(usable.map(toSearchable), blockedTerms(allergies, preferences)).map((r) => r.source);

  const relaxed: string[] = [];
  for (const pref of preferences) {
    const fits = FLEXIBLE_PREFERENCES[pref];
    if (!fits) continue;
    const filtered = pool.filter(fits);
    if (filtered.length >= 4) pool = filtered;
    else relaxed.push(pref);
  }
  // O que o paciente pediu para trocar sai, desde que sobrem receitas para variar.
  const avoid = new Set(avoidRecipeIds);
  const withoutAvoided = pool.filter((r) => !avoid.has(r.id));
  if (withoutAvoided.length >= 6) pool = withoutAvoided;
  if (!pool.length) return { items: [], relaxed, suggestedShares: false, offTarget: [], overGoals: [] };

  // Embaralha de forma reproduzível pela semente.
  let s = seed % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const shuffled = (list: Recipe[]) => list.map((r) => [rand(), r] as const).sort((a, b) => a[0] - b[0]).map(([, r]) => r);

  const items: MealPlanItem[] = [];
  const used = new Map<string, number>();
  // Último dia em que cada receita apareceu: repetir no mesmo dia ou no dia seguinte custa mais.
  const lastDay = new Map<string, number>();
  const daily = Math.max(dailyCalories, 1200);
  // Metas do dia: calorias sempre; proteína, carboidrato, gordura e fibra quando informadas.
  const dayGoals: NutritionGoals = {
    calories: daily,
    protein: goals?.protein ?? 0,
    carbs: goals?.carbs ?? 0,
    fat: goals?.fat ?? 0,
    fiber: goals?.fiber ?? 0,
  };
  let suggestedShares = false;
  const offTarget: GeneratedPlan['offTarget'] = [];
  const overGoals: GeneratedPlan['overGoals'] = [];
  // Candidatas por categoria (bloco livre: como lanche), embaralhadas uma vez.
  const candidatesFor = new Map<MealSlot, Recipe[]>();
  const candidates = (slot: MealSlot) => {
    if (!candidatesFor.has(slot)) candidatesFor.set(slot, shuffled(slotCandidates(pool, slot)));
    return candidatesFor.get(slot)!;
  };

  // Acompanhamentos disponíveis (no catálogo e permitidos pelas alergias e dietas).
  const blocked = blockedTerms(allergies, preferences);
  const sideOptions = SIDE_SPECS.flatMap((spec) => {
    const food = foods.find((f) => f.taco_id === spec.taco && f.kcal > 0);
    return food && !textHasBlocked(food.name, blocked) ? [{ spec, food, amounts: sideAmounts(food, spec) }] : [];
  });
  const sideUsed = new Map<string, number>();

  /** Quanto custa escolher a receita além da distância às metas: repetição, dias seguidos, pulada pelo paciente. */
  const habitCost = (recipe: Recipe, day: number, sameDay: Recipe[]) => {
    let cost = REPEAT_COST * (used.get(recipe.id) ?? 0);
    const last = lastDay.get(recipe.id);
    if (sameDay.some((r) => r.id === recipe.id)) cost += VARIETY_COST * 4;
    else if (last !== undefined && day - last <= 1) cost += VARIETY_COST;
    cost += SKIPPED_COST * Math.min(3, skippedRecipeIds[recipe.id] ?? 0);
    if (avoid.has(recipe.id)) cost += AVOID_COST;
    return cost;
  };

  for (let day = 0; day < 7; day++) {
    const dayMeals = mealsOnDay(meals, day);
    if (!dayMeals.length) continue;
    const { shares, suggested } = dayShares(meals, day);
    suggestedShares ||= suggested;
    const picks: Pick[] = [];
    let consumed = ZERO_TOTALS;
    let shareLeft = dayMeals.reduce((sum, m) => sum + (shares.get(m.id) ?? 0), 0);

    for (const meal of dayMeals) {
      const share = shares.get(meal.id) ?? 0;
      // A refeição mira no que ainda falta do dia, na proporção dela entre as que restam: se o
      // café já trouxe muita gordura, o almoço procura um prato mais magro.
      const part = shareLeft > 0 ? share / shareLeft : 0;
      const target = goalsMap((k) => Math.max(0, dayGoals[k] - consumed[k]) * part);
      const scale = goalsMap((k) => (dayGoals[k] * share) / 100);
      const sameDay = picks.map((p) => p.recipe);
      const ranked = candidates(meal.category ?? 'snack')
        .map((recipe) => {
          const { servings, cost } = bestServings(recipe, target, scale);
          return { recipe, servings, cost: cost + habitCost(recipe, day, sameDay) };
        })
        .sort((a, b) => a.cost - b.cost);
      // Sorteia entre as 3 mais próximas: "gerar de novo" muda o cardápio sem fugir das metas.
      const top = ranked.slice(0, 3);
      const pick = top[Math.floor(rand() * top.length)];
      used.set(pick.recipe.id, (used.get(pick.recipe.id) ?? 0) + 1);
      picks.push({ meal, recipe: pick.recipe, servings: pick.servings });
      consumed = addTotals(consumed, scaled(pick.recipe, pick.servings));
      shareLeft -= share;
    }

    // Revisão do dia: enquanto algo passa da meta, fica abaixo do piso ou as calorias estão longe,
    // aplica a mudança que mais aproxima o dia de TODAS as metas: trocar uma receita, mudar a
    // porção, acrescentar um acompanhamento ou mudar a porção dele. Cada mudança respeita as regras
    // de prato (plan-sides.ts) e custa um pouco, para o dia não virar uma soma de remendos.
    const sides: Side[] = [];
    const total = () => addTotals(picksTotals(picks), sidesTotals(sides));
    const mealRecipes = (meal: PlanMeal) => picks.filter((p) => p.meal.id === meal.id).map((p) => p.recipe);
    const mealSides = (meal: PlanMeal, except?: Side) => sides.filter((x) => x.meal.id === meal.id && x !== except);
    for (let round = 0; round < 14; round++) {
      const dayTotals = total();
      if (dayIsGood(dayTotals, dayGoals)) break;
      const current = goalDistance(dayTotals, dayGoals) + portionCost(picks, sides);
      let best: { cost: number; apply: () => void } | null = null;
      const consider = (cost: number, apply: () => void) => {
        if (cost < (best?.cost ?? current - 0.01)) best = { cost, apply };
      };
      const others = (skip: number) => picks.filter((_, i) => i !== skip).map((p) => p.recipe);

      // 1) Receita ou porção de um prato.
      for (let index = 0; index < picks.length; index++) {
        const p = picks[index];
        const rest = subTotals(dayTotals, scaled(p.recipe, p.servings));
        const restPortion = portionCost(picks.filter((_, i) => i !== index), sides);
        for (const recipe of candidates(p.meal.category ?? 'snack')) {
          // A receita nova não pode brigar com o acompanhamento que já está no prato.
          if (recipe.id !== p.recipe.id && mealSides(p.meal).some((sd) => blockedGroupsFor(recipe).has(sd.spec.group))) continue;
          const habit = recipe.id === p.recipe.id ? 0 : habitCost(recipe, day, others(index)) * 0.5;
          for (const servings of SERVING_STEPS) {
            const cost = goalDistance(addTotals(rest, scaled(recipe, servings)), dayGoals) + restPortion + servingCost(servings) + habit;
            consider(cost, () => {
              if (p.recipe.id !== recipe.id) {
                used.set(p.recipe.id, Math.max(0, (used.get(p.recipe.id) ?? 1) - 1));
                used.set(recipe.id, (used.get(recipe.id) ?? 0) + 1);
              }
              picks[index] = { ...p, recipe, servings };
            });
          }
        }
      }

      // 2) Novo acompanhamento.
      if (sides.length < MAX_SIDES_PER_DAY) {
        const base = portionCost(picks, sides) + SIDE_COST;
        for (const meal of dayMeals) {
          const slot = meal.category ?? 'snack';
          const here = mealSides(meal).map((x) => x.spec);
          for (const { spec, food, amounts } of sideOptions) {
            if (!sideFits(spec, slot, mealRecipes(meal), here)) continue;
            const habit = REPEAT_COST * 0.5 * (sideUsed.get(food.id) ?? 0);
            for (const amount of amounts) {
              const cost = goalDistance(addTotals(dayTotals, nutrientsFor(food, amount.grams)), dayGoals) + base + habit;
              consider(cost, () => {
                sides.push({ meal, food, spec, ...amount });
                sideUsed.set(food.id, (sideUsed.get(food.id) ?? 0) + 1);
              });
            }
          }
        }
      }

      // 3) Porção de um acompanhamento que já está no prato.
      for (const side of sides) {
        const rest = subTotals(dayTotals, nutrientsFor(side.food, side.grams));
        const amounts = sideOptions.find((o) => o.food.id === side.food.id)?.amounts ?? [];
        for (const amount of amounts) {
          if (amount.grams === side.grams) continue;
          const cost = goalDistance(addTotals(rest, nutrientsFor(side.food, amount.grams)), dayGoals) + portionCost(picks, sides);
          consider(cost, () => Object.assign(side, amount));
        }
      }

      const chosen = best as { cost: number; apply: () => void } | null;
      if (!chosen) break;
      chosen.apply();
    }

    // "Escolha 1": no almoço e no jantar, uma segunda receita que deixa o dia quase igual.
    const groups = new Map<string, Recipe>();
    if (alternatives) {
      const dayTotals = total();
      const current = goalDistance(dayTotals, dayGoals);
      for (const p of picks) {
        if (p.meal.category !== 'lunch' && p.meal.category !== 'dinner') continue;
        const rest = subTotals(dayTotals, scaled(p.recipe, p.servings));
        const inDay = new Set(picks.map((x) => x.recipe.id));
        const alt = candidates(p.meal.category)
          .filter((r) => !inDay.has(r.id) && ![...groups.values()].some((g) => g.id === r.id))
          .filter((r) => !mealSides(p.meal).some((sd) => blockedGroupsFor(r).has(sd.spec.group)))
          .map((r) => ({ r, cost: goalDistance(addTotals(rest, scaled(r, p.servings)), dayGoals) + habitCost(r, day, []) * 0.5 }))
          .filter((x) => x.cost <= current * 1.1 + 0.08)
          .sort((a, b) => a.cost - b.cost)[0];
        if (alt) groups.set(p.meal.id, alt.r);
      }
    }

    const dayTotals = total();
    for (const p of picks) {
      const alt = groups.get(p.meal.id);
      const group = alt ? 1 : null;
      items.push(recipeItem(day, p.meal, p.recipe.id, p.servings, group));
      if (alt) items.push(recipeItem(day, p.meal, alt.id, p.servings, group));
      lastDay.set(p.recipe.id, day);
      for (const sd of sides.filter((x) => x.meal.id === p.meal.id)) {
        items.push({
          day,
          meal_id: sd.meal.id,
          meal: sd.meal.category,
          recipe_id: null,
          servings: 1,
          food_id: sd.food.id,
          food: sd.food,
          grams: sd.grams,
          measure_label: sd.label,
          option_group: null,
          note: '',
          // O que este acompanhamento completou no dia (mostrado ao profissional no editor).
          reason: sideReason(subTotals(dayTotals, nutrientsFor(sd.food, sd.grams)), dayTotals, dayGoals),
        });
      }
    }
    if (kcalOff(dayTotals.calories, daily)) offTarget.push({ day, kcal: Math.round(dayTotals.calories), target: Math.round(daily) });
    for (const e of goalExcesses(dayTotals, dayGoals)) overGoals.push({ day, ...e, total: Math.round(e.total) });
  }

  return { items, relaxed, suggestedShares, offTarget, overGoals };
}

// Porções de meia em meia, até 2: um prato principal três vezes maior não é um prato.
const SERVING_STEPS = [0.5, 1, 1.5, 2];
// Quanto custa repetir uma receita já usada na semana, na mesma escala da distância às metas.
const REPEAT_COST = 0.35;
// Mesma receita no mesmo dia (o dobro) ou no dia seguinte.
const VARIETY_COST = 0.4;
// Cada vez que o paciente pulou a receita (até 3) e receita que ele pediu para trocar.
const SKIPPED_COST = 0.25;
const AVOID_COST = 1.5;
// Cada meia porção longe de 1 e cada acompanhamento custam um pouco: o gerador prefere trocar a
// receita a dobrar o prato, e só põe acompanhamento quando ele de fato aproxima o dia das metas.
const SERVING_COST = 0.15;
const SIDE_COST = 0.06;

const servingCost = (servings: number) => SERVING_COST * Math.abs(servings - 1) * 2;
const portionCost = (picks: Pick[], sides: Side[]) =>
  picks.reduce((sum, p) => sum + servingCost(p.servings), 0) + SIDE_COST * sides.length;

/** Dia sem nada acima da meta, nada abaixo do piso e calorias a até 10% da meta. */
const dayIsGood = (totals: NutritionTotals, goals: NutritionGoals) =>
  !goalExcesses(totals, goals).length && !belowFloor(totals, goals).length && !kcalOff(totals.calories, goals.calories);

const recipeItem = (day: number, meal: PlanMeal, recipeId: string, servings: number, group: number | null): MealPlanItem => ({
  day, meal_id: meal.id, meal: meal.category, recipe_id: recipeId, servings, food_id: null, grams: null, measure_label: null, option_group: group, note: '',
});

const goalsMap = (fn: (key: keyof NutritionGoals) => number): NutritionGoals => ({
  calories: fn('calories'),
  protein: fn('protein'),
  carbs: fn('carbs'),
  fat: fn('fat'),
  fiber: fn('fiber'),
});

const scaled = (r: Recipe, servings: number): NutritionTotals => {
  const n = r.nutritionFacts;
  return { calories: n.calories * servings, protein: n.protein * servings, carbs: n.carbs * servings, fat: n.fat * servings, fiber: n.fiber * servings };
};

const picksTotals = (picks: { recipe: Recipe; servings: number }[]): NutritionTotals =>
  picks.reduce((sum, p) => addTotals(sum, scaled(p.recipe, p.servings)), ZERO_TOTALS);

const sidesTotals = (sides: Side[]): NutritionTotals =>
  sides.reduce((sum, sd) => addTotals(sum, nutrientsFor(sd.food, sd.grams)), ZERO_TOTALS);

// Calorias do dia a mais de 10% da meta, para mais ou para menos.
const kcalOff = (kcal: number, daily: number) => Math.abs(kcal - daily) / daily > 0.1;

/** Porção da receita que deixa a refeição mais perto do alvo (calorias e macros juntos). */
function bestServings(recipe: Recipe, target: NutritionGoals, scale: NutritionGoals) {
  let best = { servings: 1, cost: Infinity };
  for (const servings of SERVING_STEPS) {
    const cost = goalDistance(scaled(recipe, servings), target, scale) + servingCost(servings);
    if (cost < best.cost) best = { servings, cost };
  }
  return best;
}
