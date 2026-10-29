import type { User as AuthUser } from '@supabase/supabase-js';
import { sqlArg, supabase } from '../lib/supabase';
import type { Recipe, RecipeIngredient } from '../types/recipe';
import { NUTRIENT_KEYS, type DeclaredNutrition, type NutritionBasis, type NutritionSource, type NutritionStatus } from '../lib/recipe-nutrition';
import { parseIngredient } from '../lib/ingredients';
import { PUBLIC_PROFILE_COLUMNS } from '../lib/profile-columns';
import { feedback } from '../lib/i18n/current';

// Tipos para o banco de dados
interface DatabaseRecipe {
  id: string;
  title: string;
  description: string;
  image: string;
  prep_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rating: number;
  review_count?: number;
  category: string;
  ingredients: string[] | null;
  instructions: string[] | null;
  nutrition_facts: Partial<Recipe['nutritionFacts']> | null;
  author_id: string;
  created_at: string;
  updated_at: string;
  premium_only?: boolean;
  yield_servings?: number | string | null;
  final_weight_g?: number | string | null;
  serving_weight_g?: number | string | null;
  serving_label?: string | null;
  nutrition_declared?: Record<string, unknown> | null;
  nutrition_basis?: NutritionBasis;
  nutrition_status?: NutritionStatus;
  nutrition_source?: NutritionSource;
  nutrition_needs_review?: boolean;
  recipe_version?: number;
  recipe_ingredients?: Array<{
    id: string;
    position: number;
    text: string;
    food_id: string | null;
    quantity: number | string | null;
    unit: string | null;
    note: string | null;
    grams: number | string | null;
    measure_label: string | null;
    excluded: boolean | null;
    line_nutrients: Record<string, unknown> | null;
    foods: { name: string } | null;
  }>;
  profiles?: {
    full_name: string;
    user_type: string;
    avatar_url?: string | null;
  } | null;
  reviews?: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    user_id: string;
    profiles: {
      full_name: string;
    } | null;
  }>;
}

// Receita completa (página da receita, receitas do próprio autor): com preparo, ingredientes
// estruturados e avaliações.
const RECIPE_SELECT = `
  *,
  profiles!recipes_author_id_fkey(full_name, user_type, avatar_url),
  recipe_ingredients(id, position, text, food_id, quantity, unit, note, grams, measure_label, excluded, line_nutrients, foods(name)),
  reviews(
    id,
    rating,
    comment,
    created_at,
    user_id,
    profiles!reviews_user_id_fkey(full_name)
  )
`;

// Cartão / índice: o necessário para a grade, os filtros, o gerador de plano e as trocas.
// Sem modo de preparo nem avaliações (a nota e a contagem vêm prontas do banco).
const CARD_SELECT = `
  id, title, description, image, prep_time, difficulty, rating, review_count, category, ingredients,
  nutrition_facts, author_id, created_at, updated_at, premium_only,
  yield_servings, serving_label, nutrition_basis, nutrition_status, nutrition_source, nutrition_needs_review,
  profiles!recipes_author_id_fkey(full_name, user_type, avatar_url)
`;

export const RECIPES_PAGE_SIZE = 24;

export interface RecipeFilters {
  query: string;
  category: string;
  difficulty: string | null;
  minRating: number | null;
  prepTimeRange: string | null;
}

export type RecipeInput = Omit<Recipe, 'id' | 'rating' | 'reviewCount' | 'full' | 'reviews' | 'createdAt' | 'updatedAt'>;

const numberOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

function toDeclared(raw: Record<string, unknown> | null | undefined): DeclaredNutrition {
  const out: DeclaredNutrition = {};
  for (const key of NUTRIENT_KEYS) {
    const n = numberOrNull(raw?.[key]);
    if (n !== null && Number.isFinite(n)) out[key] = n;
  }
  return out;
}

function toNutritionFacts(facts: Partial<Recipe['nutritionFacts']> | null | undefined): Recipe['nutritionFacts'] {
  return {
    calories: Number(facts?.calories) || 0,
    protein: Number(facts?.protein) || 0,
    carbs: Number(facts?.carbs) || 0,
    fat: Number(facts?.fat) || 0,
    fiber: Number(facts?.fiber) || 0,
  };
}

// Função para converter receita do banco para o formato da aplicação
function convertDatabaseRecipeToAppRecipe(dbRecipe: DatabaseRecipe): Recipe {
  // Cartões não trazem as avaliações: nota e contagem vêm das colunas mantidas pelo banco.
  const reviews = dbRecipe.reviews || [];
  const full = dbRecipe.reviews !== undefined;
  const averageRating = full
    ? reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
    : Number(dbRecipe.rating) || 0;

  return {
    id: dbRecipe.id,
    title: dbRecipe.title,
    description: dbRecipe.description,
    image: dbRecipe.image,
    prepTime: dbRecipe.prep_time,
    difficulty: dbRecipe.difficulty,
    rating: Number(averageRating.toFixed(1)),
    reviewCount: full ? reviews.length : Number(dbRecipe.review_count) || 0,
    full,
    category: dbRecipe.category,
    ingredients: dbRecipe.ingredients ?? [],
    instructions: dbRecipe.instructions ?? [],
    nutritionFacts: toNutritionFacts(dbRecipe.nutrition_facts),
    unknownNutrients: NUTRIENT_KEYS.filter((k) => numberOrNull(dbRecipe.nutrition_facts?.[k]) === null),
    nutritionDeclared: dbRecipe.nutrition_declared ? toDeclared(dbRecipe.nutrition_declared) : undefined,
    nutritionBasis: dbRecipe.nutrition_basis ?? 'legacy_unit',
    nutritionStatus: dbRecipe.nutrition_status ?? 'manual_declared',
    nutritionSource: dbRecipe.nutrition_source ?? 'legacy',
    nutritionNeedsReview: dbRecipe.nutrition_needs_review === true,
    yieldServings: numberOrNull(dbRecipe.yield_servings),
    servingLabel: dbRecipe.serving_label ?? '',
    servingWeightG: numberOrNull(dbRecipe.serving_weight_g),
    finalWeightG: numberOrNull(dbRecipe.final_weight_g),
    recipeVersion: dbRecipe.recipe_version,
    ingredientRows: dbRecipe.recipe_ingredients
      ?.slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        id: row.id,
        text: row.text,
        foodId: row.food_id,
        foodName: row.foods?.name ?? null,
        quantity: numberOrNull(row.quantity),
        unit: row.unit,
        note: row.note ?? '',
        grams: numberOrNull(row.grams),
        measureLabel: row.measure_label,
        excluded: row.excluded === true,
        lineNutrients: row.line_nutrients ? toDeclared(row.line_nutrients) : null,
      })),
    reviews: reviews
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(review => ({
        id: review.id,
        userId: review.user_id,
        userName: review.profiles?.full_name ?? '',
        rating: review.rating,
        comment: review.comment || '',
        // Data local (em UTC, avaliações depois das 21h no Brasil mostravam o dia seguinte).
        date: new Date(review.created_at).toLocaleDateString('sv-SE')
      })),
    authorId: dbRecipe.author_id,
    authorName: dbRecipe.profiles?.full_name,
    authorType: dbRecipe.profiles?.user_type as 'Nutritionist' | 'Client',
    authorAvatarUrl: dbRecipe.profiles?.avatar_url || null,
    createdAt: dbRecipe.created_at,
    updatedAt: dbRecipe.updated_at,
    premiumOnly: dbRecipe.premium_only === true
  };
}

// Funções de usuário
export async function getUserProfile(id: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Funções de receitas

/** Ingredientes como o app grava: a linha do autor e a quantidade lida dela (a mesma leitura da lista de compras). */
export function ingredientRowsFor(recipe: Pick<Recipe, 'ingredients' | 'ingredientRows'>): RecipeIngredient[] {
  const rows = recipe.ingredientRows ?? recipe.ingredients.map((text) => ({ text, foodId: null, quantity: null, unit: null, note: '' }));
  return rows
    .map((row) => ({ ...row, text: row.text.trim(), note: row.note.trim() }))
    .filter((row) => row.text)
    .map((row) => {
      const parsed = parseIngredient(row.text);
      return { ...row, quantity: parsed.quantity && parsed.quantity > 0 ? parsed.quantity : null, unit: parsed.quantity ? parsed.unit : null };
    });
}

/**
 * Cria (recipeId null) ou atualiza a receita com rendimento, base dos nutrientes e ingredientes,
 * tudo de uma vez (save_recipe). `operationId` repetido não grava duas vezes.
 */
async function saveRecipe(recipeId: string | null, recipe: RecipeInput, operationId?: string): Promise<Recipe> {
  const declared = recipe.nutritionDeclared ?? recipe.nutritionFacts;
  // Uma cópia de receita antiga começa revisada: os valores antigos já eram os de uma porção.
  const basis = recipe.nutritionBasis === 'legacy_unit' && !recipeId ? 'per_serving' : recipe.nutritionBasis ?? 'per_serving';
  const { data, error } = await supabase.rpc('save_recipe', {
    p_recipe: sqlArg(recipeId),
    p_data: {
      title: recipe.title,
      description: recipe.description,
      image: recipe.image,
      prep_time: recipe.prepTime,
      difficulty: recipe.difficulty,
      category: recipe.category,
      instructions: recipe.instructions.map((s) => s.trim()).filter(Boolean),
      yield_servings: recipe.yieldServings ?? null,
      final_weight_g: recipe.finalWeightG ?? null,
      serving_weight_g: recipe.servingWeightG ?? null,
      serving_label: recipe.servingLabel ?? '',
      nutrition_basis: basis,
      nutrition: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, declared?.[k] ?? null])),
      // Calculado pelos ingredientes: o banco faz a conta. Cópia de receita antiga: à mão.
      nutrition_source: recipe.nutritionSource === 'ingredients' ? 'ingredients' : 'manual',
      confirm_manual: recipe.confirmManual === true,
    },
    p_ingredients: ingredientRowsFor(recipe).map((row) => ({
      id: row.id ?? null,
      text: row.text,
      food_id: row.foodId,
      quantity: row.quantity,
      unit: row.unit,
      note: row.note,
      grams: row.grams ?? null,
      measure_label: row.measureLabel ?? null,
      excluded: row.excluded === true,
    })),
    p_operation: sqlArg(operationId ?? null),
  });
  if (error) throw error;
  const saved = await getRecipeById((data as unknown as { recipe_id: string }).recipe_id);
  if (!saved) throw new Error('not_found');
  return saved;
}

export const createRecipe = (recipe: RecipeInput, operationId?: string) => saveRecipe(null, recipe, operationId);

export const updateRecipe = (recipe: Recipe, operationId?: string) => saveRecipe(recipe.id, recipe, operationId);

export async function deleteRecipe(recipeId: string) {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId);

  if (error) throw error;
}

const toRecipes = (rows: unknown[] | null) => (rows ?? []).map((r) => convertDatabaseRecipeToAppRecipe(r as DatabaseRecipe));

/** Uma página da grade, com a busca e os filtros aplicados no servidor (search_recipes). */
export async function searchRecipes(filters: RecipeFilters, page: number): Promise<{ recipes: Recipe[]; hasMore: boolean }> {
  const from = page * RECIPES_PAGE_SIZE;
  // Pede um a mais para saber se existe a próxima página sem contar o total.
  const { data, error } = await supabase
    .rpc('search_recipes', {
      p_query: filters.query.trim(),
      p_category: filters.category === 'all' ? sqlArg(null) : filters.category,
      p_difficulty: sqlArg(filters.difficulty),
      p_min_rating: sqlArg(filters.minRating),
      p_prep: sqlArg(filters.prepTimeRange),
    })
    .select(CARD_SELECT)
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + RECIPES_PAGE_SIZE);
  if (error) throw error;
  const rows = toRecipes(data);
  return { recipes: rows.slice(0, RECIPES_PAGE_SIZE), hasMore: rows.length > RECIPES_PAGE_SIZE };
}

/**
 * Índice leve de todo o catálogo visível (cartões, sem preparo nem avaliações), em páginas
 * de 1000. Para o que precisa escolher entre todas as receitas: gerador de plano, editor,
 * trocas, diário e "O que tem em casa?". Carregado só quando uma dessas telas abre.
 */
export async function getRecipeIndex(): Promise<Recipe[]> {
  const all: Recipe[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('recipes')
      .select(CARD_SELECT)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    all.push(...toRecipes(data));
    if (!data || data.length < 1000) return all;
  }
}

/** Cartões destas receitas (favoritos, itens de um plano). */
export async function getRecipesByIds(ids: string[]): Promise<Recipe[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return [];
  const out: Recipe[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase.from('recipes').select(CARD_SELECT).in('id', unique.slice(i, i + 200));
    if (error) throw error;
    out.push(...toRecipes(data));
  }
  return out;
}

/** Receita completa, com preparo e avaliações (página da receita). */
export async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from('recipes').select(RECIPE_SELECT).eq('id', recipeId).maybeSingle();
  if (error) throw error;
  return data ? convertDatabaseRecipeToAppRecipe(data as unknown as DatabaseRecipe) : null;
}

/** Receitas completas de um autor (painel e conteúdo do nutricionista). */
export async function getRecipesByAuthor(authorId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return toRecipes(data);
}

// Funções de avaliações
export async function addReview(recipeId: string, review: {
  user_id: string;
  rating: number;
  comment: string;
}) {
  const { data, error } = await supabase
    .from('reviews')
    .insert([{
      recipe_id: recipeId,
      user_id: review.user_id,
      rating: review.rating,
      comment: review.comment
    }])
    .select(`
      *,
      profiles!reviews_user_id_fkey(full_name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateReview(reviewId: string, updates: {
  rating: number;
  comment: string;
}) {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      rating: updates.rating,
      comment: updates.comment
    })
    .eq('id', reviewId)
    .select(`
      *,
      profiles!reviews_user_id_fkey(full_name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteReview(reviewId: string) {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw error;
}

// Funções de favoritos
export async function addToFavorites(userId: string, recipeId: string) {
  const { error } = await supabase
    .from('favorites')
    .insert([{
      user_id: userId,
      recipe_id: recipeId
    }]);

  // 23505 = favorito já existe (duplo clique / outra aba): tratar como sucesso
  if (error && error.code !== '23505') throw error;
}

export async function removeFromFavorites(userId: string, recipeId: string) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId);

  if (error) throw error;
}

export async function getFavorites(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map(favorite => favorite.recipe_id);
}

// Funções para recuperação de senha
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.toLowerCase().trim(),
    {
      redirectTo: `${window.location.origin}/reset-password`,
    }
  );

  if (error) {
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      throw new Error(feedback().forgotPassword.rateLimited);
    }
    throw error;
  }
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.toLowerCase().trim(),
    options: {
      emailRedirectTo: `${window.location.origin}/confirm-email`,
    },
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);

    // Pelo código do erro do Supabase Auth, não pelo texto (que muda entre versões).
    const code = error.code ?? '';
    if (code === 'same_password') throw new Error(feedback().auth.passwordSame);
    if (code === 'weak_password') throw new Error(feedback().auth.passwordWeak);
    if (code === 'session_not_found' || code === 'session_expired' || error.name === 'AuthSessionMissingError') {
      throw new Error(feedback().auth.recoverySessionExpired);
    }
    if (error.message.includes('Password should be at least')) {
      throw new Error(feedback().auth.passwordTooShort);
    }

    throw new Error(feedback().auth.updatePasswordError);
  }
}

// Função para validar token de recuperação e obter usuário
export async function validateRecoveryToken(): Promise<{ valid: boolean; user?: AuthUser }> {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    // Link expirado ou já usado: o Supabase redireciona com #error=...
    if (hashParams.get('error')) {
      return { valid: false };
    }

    if (!accessToken || type !== 'recovery') {
      // O supabase-js lê o token do link assim que o app abre e apaga o #hash da URL,
      // então quando esta página (carregada sob demanda) monta, a sessão já existe.
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        return error || !data.user ? { valid: false } : { valid: true, user: data.user };
      }

      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ? { valid: true, user: session.user } : { valid: false };
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return { valid: false };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: hashParams.get('refresh_token') || ''
    });

    if (sessionError) {
      return { valid: false };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('Error validating recovery token:', error);
    return { valid: false };
  }
}
