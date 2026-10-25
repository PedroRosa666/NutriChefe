// Cardápio semanal automático a partir do catálogo: respeita alergias e
// preferências do perfil de saúde e ajusta as porções para chegar perto da
// meta diária de calorias. Roda no navegador, sem custo de IA.
import { blockedTerms, normalizeText, withoutAllergens, type SearchableRecipe } from '../../supabase/functions/_shared/recipe-search';
import type { Recipe } from '../types/recipe';
import type { MealPlanItem, MealSlot, PlanMeal } from '../services/care';
import { MEAL_SLOTS } from '../services/care';
import { ALL_DAYS, dayShares, mealsOnDay } from './plan-meals';
import { hasUsableNutrition } from './recipe-nutrition';

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
  allergies: string[];
  preferences: string[];
  /** Blocos de refeição do plano (padrão: as quatro de sempre). Cada bloco recebe a sua parte da meta do dia. */
  meals?: PlanMeal[];
  /** Semente para variar o resultado ao gerar de novo. */
  seed?: number;
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
  allergies,
  preferences,
  meals = LEGACY_MEALS,
  seed = Date.now(),
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
  if (!pool.length) return { items: [], relaxed, suggestedShares: false, offTarget: [] };

  // Embaralha de forma reproduzível pela semente.
  let s = seed % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const shuffled = (list: Recipe[]) => list.map((r) => [rand(), r] as const).sort((a, b) => a[0] - b[0]).map(([, r]) => r);

  const items: MealPlanItem[] = [];
  const used = new Map<string, number>();
  const daily = Math.max(dailyCalories, 1200);
  let suggestedShares = false;
  const offTarget: GeneratedPlan['offTarget'] = [];
  // Candidatas por categoria (bloco livre: como lanche), embaralhadas uma vez.
  const candidatesFor = new Map<MealSlot, Recipe[]>();
  const candidates = (slot: MealSlot) => {
    if (!candidatesFor.has(slot)) candidatesFor.set(slot, shuffled(slotCandidates(pool, slot)));
    return candidatesFor.get(slot)!;
  };

  for (let day = 0; day < 7; day++) {
    const dayMeals = mealsOnDay(meals, day);
    if (!dayMeals.length) continue;
    const { shares, suggested } = dayShares(meals, day);
    suggestedShares ||= suggested;
    let dayKcal = 0;
    for (const meal of dayMeals) {
      const target = (daily * (shares.get(meal.id) ?? 0)) / 100;
      // Menos usada primeiro; empate decide pela proximidade da meta da refeição.
      const ranked = candidates(meal.category ?? 'snack').slice().sort((a, b) => {
        const ua = used.get(a.id) ?? 0;
        const ub = used.get(b.id) ?? 0;
        if (ua !== ub) return ua - ub;
        const da = Math.abs((a.nutritionFacts.calories || target) - target);
        const db = Math.abs((b.nutritionFacts.calories || target) - target);
        return da - db;
      });
      // Sorteia entre as 4 melhores das menos usadas: "gerar de novo" muda o cardápio
      // (as porções são ajustadas logo abaixo, então a meta continua perto).
      const minUse = used.get(ranked[0].id) ?? 0;
      const top = ranked.filter((r) => (used.get(r.id) ?? 0) === minUse).slice(0, 4);
      const pick = top[Math.floor(rand() * top.length)];
      used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      const kcal = pick.nutritionFacts.calories;
      // Porções de meia em meia, entre 0,5 e 3 (regra mostrada ao profissional quando a meta não fecha).
      const servings = kcal > 0 ? Math.min(3, Math.max(0.5, Math.round((target / kcal) * 2) / 2)) : 1;
      dayKcal += kcal * servings;
      items.push({ day, meal_id: meal.id, meal: meal.category, recipe_id: pick.id, servings, food_id: null, grams: null, measure_label: null, option_group: null, note: '' });
    }
    if (Math.abs(dayKcal - daily) / daily > 0.1) offTarget.push({ day, kcal: Math.round(dayKcal), target: Math.round(daily) });
  }

  return { items, relaxed, suggestedShares, offTarget };
}
