// Cardápio semanal automático a partir do catálogo: respeita alergias e
// preferências do perfil de saúde e ajusta as porções para chegar perto da
// meta diária de calorias. Roda no navegador, sem custo de IA.
import { normalizeText, withoutAllergens, type SearchableRecipe } from '../../supabase/functions/_shared/recipe-search';
import type { Recipe } from '../types/recipe';
import type { MealPlanItem, MealSlot } from '../services/care';
import { MEAL_SLOTS } from '../services/care';

const SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

const SLOT_WORDS: Record<MealSlot, string[]> = {
  breakfast: ['cafe', 'manha', 'panqueca', 'aveia', 'tapioca', 'smoothie', 'vitamina', 'iogurte', 'omelete', 'mingau', 'pao', 'granola', 'crepioca', 'overnight', 'torrada', 'breakfast', 'pancake', 'oat'],
  snack: ['lanche', 'snack', 'bolinho', 'barrinha', 'barra', 'cookie', 'biscoito', 'muffin', 'chips', 'hummus', 'pasta de', 'fruta', 'smoothie', 'mousse', 'brownie', 'doce', 'sobremesa', 'bolo', 'pudim', 'sorvete', 'trufa', 'torta doce'],
  lunch: [],
  dinner: ['sopa', 'caldo', 'creme de', 'salada', 'omelete', 'wrap', 'sanduiche', 'leve'],
};

// Pratos principais: o que não é café da manhã nem lanche.
const MAIN_EXCLUDE = [...SLOT_WORDS.breakfast, ...SLOT_WORDS.snack].filter((w) => !['omelete', 'pao'].includes(w));

const PREF_CATEGORIES: Record<string, string[]> = {
  vegan: ['vegan'],
  vegetarian: ['vegan', 'vegetarian'],
  glutenFree: ['glutenFree'],
  lowCarb: ['lowCarb'],
  highProtein: ['highProtein'],
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
  /** Refeições a incluir (padrão: as quatro). */
  slots?: MealSlot[];
  /** Semente para variar o resultado ao gerar de novo. */
  seed?: number;
}

export function generateWeeklyPlan({
  recipes,
  dailyCalories,
  allergies,
  preferences,
  slots = MEAL_SLOTS,
  seed = Date.now(),
}: GeneratorOptions): MealPlanItem[] {
  let pool = withoutAllergens(recipes.map(toSearchable), allergies).map((r) => r.source);

  // Preferência só filtra se sobrar variedade suficiente.
  for (const pref of preferences) {
    const cats = PREF_CATEGORIES[pref];
    if (!cats) continue;
    const filtered = pool.filter((r) => cats.includes(r.category));
    if (filtered.length >= 4) pool = filtered;
  }
  if (!pool.length) return [];

  // Embaralha de forma reproduzível pela semente.
  let s = seed % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const shuffled = (list: Recipe[]) => list.map((r) => [rand(), r] as const).sort((a, b) => a[0] - b[0]).map(([, r]) => r);

  const items: MealPlanItem[] = [];
  const used = new Map<string, number>();

  for (const slot of slots) {
    const candidates = shuffled(slotCandidates(pool, slot));
    const target = Math.max(dailyCalories, 1200) * SLOT_SHARE[slot];
    for (let day = 0; day < 7; day++) {
      // Menos usada primeiro; empate decide pela proximidade da meta da refeição.
      const pick = candidates
        .slice()
        .sort((a, b) => {
          const ua = used.get(a.id) ?? 0;
          const ub = used.get(b.id) ?? 0;
          if (ua !== ub) return ua - ub;
          const da = Math.abs((a.nutritionFacts.calories || target) - target);
          const db = Math.abs((b.nutritionFacts.calories || target) - target);
          return da - db;
        })[0];
      used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      const kcal = pick.nutritionFacts.calories;
      const servings = kcal > 0 ? Math.min(3, Math.max(0.5, Math.round((target / kcal) * 2) / 2)) : 1;
      items.push({ day, meal: slot, recipe_id: pick.id, servings, note: '' });
    }
  }

  return items.sort((a, b) => a.day - b.day || MEAL_SLOTS.indexOf(a.meal) - MEAL_SLOTS.indexOf(b.meal));
}
