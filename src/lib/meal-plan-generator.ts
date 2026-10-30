// Cardápio semanal automático a partir do catálogo: respeita alergias e
// preferências do perfil de saúde e escolhe receitas e porções para chegar perto
// das metas do dia (calorias, proteína, carboidrato, gordura e fibra), sem estourar. Quando as
// receitas não fecham o carboidrato (ou as calorias), completa com um acompanhamento simples da
// Tabela TACO, como o nutricionista faria: arroz e feijão no almoço, pão ou fruta no café.
// Roda no navegador, sem custo de IA.
import { blockedTerms, normalizeText, textHasBlocked, withoutAllergens, type SearchableRecipe } from '../../supabase/functions/_shared/recipe-search';
import type { Recipe } from '../types/recipe';
import type { MealPlanItem, MealSlot, PlanMeal } from '../services/care';
import { MEAL_SLOTS } from '../services/care';
import { ALL_DAYS, dayShares, mealsOnDay } from './plan-meals';
import { hasUsableNutrition } from './recipe-nutrition';
import { addTotals, belowFloor, goalDistance, goalExcesses, subTotals, ZERO_TOTALS, type GoalExcess } from './plan-goals';
import type { Food } from '../services/foods';
import { nutrientsFor, quantityLabel } from './food-math';
import type { NutritionGoals } from '../store/nutrition-goals';
import type { NutritionTotals } from '../store/nutrition-tracking';

const SLOT_WORDS: Record<MealSlot, string[]> = {
  breakfast: ['cafe', 'manha', 'panqueca', 'aveia', 'tapioca', 'smoothie', 'vitamina', 'iogurte', 'omelete', 'mingau', 'pao', 'granola', 'crepioca', 'overnight', 'torrada', 'breakfast', 'pancake', 'oat'],
  snack: ['lanche', 'snack', 'bolinho', 'barrinha', 'barra', 'cookie', 'biscoito', 'muffin', 'chips', 'hummus', 'pasta de', 'fruta', 'smoothie', 'mousse', 'brownie', 'doce', 'sobremesa', 'bolo', 'pudim', 'sorvete', 'trufa', 'torta doce'],
  lunch: [],
  dinner: ['sopa', 'caldo', 'creme de', 'salada', 'omelete', 'wrap', 'sanduiche', 'leve'],
};

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
  let list: Recipe[];
  if (slot === 'breakfast') list = pool.filter((r) => hasAny(r, SLOT_WORDS.breakfast));
  else if (slot === 'snack') list = pool.filter((r) => hasAny(r, SLOT_WORDS.snack) || r.nutritionFacts.calories <= 250);
  else if (slot === 'dinner') {
    const light = pool.filter((r) => hasAny(r, SLOT_WORDS.dinner) && !hasAny(r, SLOT_WORDS.snack));
    const mains = pool.filter((r) => !hasAny(r, MAIN_EXCLUDE));
    list = [...new Set([...light, ...mains])];
  } else list = pool.filter((r) => !hasAny(r, MAIN_EXCLUDE));
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
}

export interface GeneratedPlan {
  items: MealPlanItem[];
  /** Preferências flexíveis que ficaram de fora por falta de receitas (ex.: 'lowCarb'). */
  relaxed: string[];
  /** A divisão das calorias foi sugerida (os blocos não tinham % definidas que somassem 100). */
  suggestedShares: boolean;
  /**
   * Dias que ficaram longe da meta (mais de 10%) por causa dos limites de porção (0,5 a 3 por
   * receita): a diferença aparece para o profissional revisar, a meta não muda.
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

export function generateWeeklyPlanDetailed({
  recipes,
  dailyCalories,
  goals,
  allergies,
  preferences,
  meals = LEGACY_MEALS,
  seed = Date.now(),
  foods = [],
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
  if (!pool.length) return { items: [], relaxed, suggestedShares: false, offTarget: [], overGoals: [] };

  // Embaralha de forma reproduzível pela semente.
  let s = seed % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const shuffled = (list: Recipe[]) => list.map((r) => [rand(), r] as const).sort((a, b) => a[0] - b[0]).map(([, r]) => r);

  const items: MealPlanItem[] = [];
  const used = new Map<string, number>();
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

  // Acompanhamentos permitidos por categoria (as mesmas alergias e dietas das receitas).
  const blocked = blockedTerms(allergies, preferences);
  const sideFoods = new Map<MealSlot, Food[]>();
  const sidesFor = (slot: MealSlot) => {
    if (!sideFoods.has(slot)) {
      const ids = SIDE_TACO_IDS[slot];
      sideFoods.set(slot, foods.filter((f) => f.taco_id !== null && ids.includes(f.taco_id) && f.kcal > 0 && !textHasBlocked(f.name, blocked)));
    }
    return sideFoods.get(slot)!;
  };
  const sideUsed = new Map<string, number>();

  for (let day = 0; day < 7; day++) {
    const dayMeals = mealsOnDay(meals, day);
    if (!dayMeals.length) continue;
    const { shares, suggested } = dayShares(meals, day);
    suggestedShares ||= suggested;
    const picks: { meal: PlanMeal; recipe: Recipe; servings: number; share: number }[] = [];
    let consumed = ZERO_TOTALS;
    let shareLeft = dayMeals.reduce((sum, m) => sum + (shares.get(m.id) ?? 0), 0);

    for (const meal of dayMeals) {
      const share = shares.get(meal.id) ?? 0;
      // A refeição mira no que ainda falta do dia, na proporção dela entre as que restam: se o
      // café já trouxe muita gordura, o almoço procura um prato mais magro.
      const part = shareLeft > 0 ? share / shareLeft : 0;
      const target = goalsMap((k) => Math.max(0, dayGoals[k] - consumed[k]) * part);
      const scale = goalsMap((k) => (dayGoals[k] * share) / 100);
      // Escolhas repetidas custam mais (variedade); empate na distância decide pela semente.
      const ranked = candidates(meal.category ?? 'snack')
        .map((recipe) => {
          const { servings, cost } = bestServings(recipe, target, scale);
          return { recipe, servings, cost: cost + REPEAT_COST * (used.get(recipe.id) ?? 0) };
        })
        .sort((a, b) => a.cost - b.cost);
      // Sorteia entre as 3 mais próximas: "gerar de novo" muda o cardápio sem fugir das metas.
      const top = ranked.slice(0, 3);
      const pick = top[Math.floor(rand() * top.length)];
      used.set(pick.recipe.id, (used.get(pick.recipe.id) ?? 0) + 1);
      picks.push({ meal, recipe: pick.recipe, servings: pick.servings, share });
      consumed = addTotals(consumed, scaled(pick.recipe, pick.servings));
      shareLeft -= share;
    }

    // Revisão do dia: se algo passou da meta, ficou abaixo do piso (ex.: carboidrato) ou as calorias
    // ficaram longe, aplica a mudança que mais aproxima o dia das metas, algumas vezes: trocar uma
    // receita, mudar a porção ou acrescentar um acompanhamento (no máximo um por refeição e dois
    // por dia, para o plano continuar parecendo um plano).
    const sides: Side[] = [];
    const total = () => addTotals(picksTotals(picks), sidesTotals(sides));
    for (let round = 0; round < 8; round++) {
      const dayTotals = total();
      if (!goalExcesses(dayTotals, dayGoals).length && !belowFloor(dayTotals, dayGoals).length && !kcalOff(dayTotals.calories, daily)) break;
      const current = goalDistance(dayTotals, dayGoals);
      let best: { index: number; recipe: Recipe; servings: number; cost: number } | null = null;
      let bestSide: (Side & { cost: number }) | null = null;
      for (let index = 0; index < picks.length; index++) {
        const p = picks[index];
        const rest = subTotals(dayTotals, scaled(p.recipe, p.servings));
        for (const recipe of candidates(p.meal.category ?? 'snack')) {
          for (const servings of SERVING_STEPS) {
            const cost =
              goalDistance(addTotals(rest, scaled(recipe, servings)), dayGoals) +
              (recipe.id === p.recipe.id ? 0 : REPEAT_COST * 0.5 * (used.get(recipe.id) ?? 0));
            if (cost < (best?.cost ?? current * 0.98)) best = { index, recipe, servings, cost };
          }
        }
      }
      if (sides.length < MAX_SIDES_PER_DAY) {
        for (const meal of dayMeals) {
          if (sides.some((sd) => sd.meal.id === meal.id)) continue;
          for (const food of sidesFor(meal.category ?? 'snack')) {
            for (const amount of sideAmounts(food)) {
              const cost =
                goalDistance(addTotals(dayTotals, nutrientsFor(food, amount.grams)), dayGoals) +
                REPEAT_COST * 0.5 * (sideUsed.get(food.id) ?? 0);
              const bar = Math.min(best?.cost ?? Infinity, bestSide?.cost ?? Infinity, current * 0.98);
              if (cost < bar) bestSide = { meal, food, ...amount, cost };
            }
          }
        }
      }
      if (bestSide && (!best || bestSide.cost < best.cost)) {
        const side: Side = { meal: bestSide.meal, food: bestSide.food, grams: bestSide.grams, label: bestSide.label };
        sides.push(side);
        sideUsed.set(side.food.id, (sideUsed.get(side.food.id) ?? 0) + 1);
        continue;
      }
      if (!best) break;
      const { index, recipe, servings } = best;
      const old = picks[index];
      if (old.recipe.id !== recipe.id) {
        used.set(old.recipe.id, Math.max(0, (used.get(old.recipe.id) ?? 1) - 1));
        used.set(recipe.id, (used.get(recipe.id) ?? 0) + 1);
      }
      picks[index] = { ...old, recipe, servings };
    }

    const dayTotals = total();
    for (const p of picks) {
      items.push({ day, meal_id: p.meal.id, meal: p.meal.category, recipe_id: p.recipe.id, servings: p.servings, food_id: null, grams: null, measure_label: null, option_group: null, note: '' });
      for (const sd of sides.filter((x) => x.meal.id === p.meal.id)) {
        items.push({ day, meal_id: sd.meal.id, meal: sd.meal.category, recipe_id: null, servings: 1, food_id: sd.food.id, food: sd.food, grams: sd.grams, measure_label: sd.label, option_group: null, note: '' });
      }
    }
    if (kcalOff(dayTotals.calories, daily)) offTarget.push({ day, kcal: Math.round(dayTotals.calories), target: Math.round(daily) });
    for (const e of goalExcesses(dayTotals, dayGoals)) overGoals.push({ day, ...e, total: Math.round(e.total) });
  }

  return { items, relaxed, suggestedShares, offTarget, overGoals };
}

/**
 * Acompanhamentos por refeição (ids da Tabela TACO): o básico do prato brasileiro, para completar
 * carboidrato e calorias quando as receitas não fecham. Alimento que não estiver no catálogo é ignorado.
 */
const SIDE_TACO_IDS: Record<MealSlot, number[]> = {
  // Pão francês, pão de forma integral, banana-prata, aveia em flocos, mamão formosa, maçã fuji.
  breakfast: [53, 52, 182, 7, 225, 222],
  // Arroz branco e integral, feijão carioca, batata-doce, mandioca, cuscuz de milho, batata inglesa.
  lunch: [3, 1, 561, 88, 129, 533, 91],
  dinner: [3, 1, 561, 88, 129, 533, 91],
  // Banana-prata, maçã fuji, mamão formosa, pão de forma integral.
  snack: [182, 222, 225, 52],
};
const MAX_SIDES_PER_DAY = 2;

interface Side {
  meal: PlanMeal;
  food: Food;
  grams: number;
  label: string;
}

const sidesTotals = (sides: Side[]): NutritionTotals =>
  sides.reduce((sum, sd) => addTotals(sum, nutrientsFor(sd.food, sd.grams)), ZERO_TOTALS);

/**
 * Quantidades possíveis de um acompanhamento, na medida caseira do catálogo quando há (ex.: 2 a 6
 * colheres de sopa de arroz, 1 ou 2 pães) e entre 30 g e 250 g; sem medida, de 50 em 50 g.
 */
function sideAmounts(food: Food): { grams: number; label: string }[] {
  const measure = food.measures.find((m) => m.grams > 0);
  if (!measure) return [50, 100, 150, 200].map((g) => ({ grams: g, label: quantityLabel(g, null) }));
  const out: { grams: number; label: string }[] = [];
  for (let n = 1; n <= 8; n++) {
    const grams = n * measure.grams;
    if (grams > 250) break;
    if (grams >= 30) out.push({ grams, label: quantityLabel(n, measure) });
  }
  return out.length ? out : [{ grams: measure.grams, label: quantityLabel(1, measure) }];
}

// Porções de meia em meia, entre 0,5 e 3 (regra mostrada ao profissional quando a meta não fecha).
const SERVING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3];
// Quanto custa repetir uma receita já usada na semana, na mesma escala da distância às metas.
const REPEAT_COST = 0.35;

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

// Calorias do dia a mais de 10% da meta, para mais ou para menos.
const kcalOff = (kcal: number, daily: number) => Math.abs(kcal - daily) / daily > 0.1;

/** Porção da receita que deixa a refeição mais perto do alvo (calorias e macros juntos). */
function bestServings(recipe: Recipe, target: NutritionGoals, scale: NutritionGoals) {
  let best = { servings: 1, cost: Infinity };
  for (const servings of SERVING_STEPS) {
    const cost = goalDistance(scaled(recipe, servings), target, scale);
    if (cost < best.cost) best = { servings, cost };
  }
  return best;
}
