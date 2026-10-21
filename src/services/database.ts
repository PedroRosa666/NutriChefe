import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Recipe } from '../types/recipe';
import { PUBLIC_PROFILE_COLUMNS } from '../lib/profile-columns';

// Tipos para o banco de dados
interface DatabaseRecipe {
  id: string;
  title: string;
  description: string;
  image: string;
  prep_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rating: number;
  category: string;
  ingredients: string[] | null;
  instructions: string[] | null;
  nutrition_facts: Partial<Recipe['nutritionFacts']> | null;
  author_id: string;
  created_at: string;
  updated_at: string;
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

// Select padrão de receita com autor e avaliações
const RECIPE_SELECT = `
  *,
  profiles!recipes_author_id_fkey(full_name, user_type, avatar_url),
  reviews(
    id,
    rating,
    comment,
    created_at,
    user_id,
    profiles!reviews_user_id_fkey(full_name)
  )
`;

type RecipeInput = Omit<Recipe, 'id' | 'rating' | 'reviews' | 'createdAt' | 'updatedAt'>;

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
  const reviews = dbRecipe.reviews || [];
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return {
    id: dbRecipe.id,
    title: dbRecipe.title,
    description: dbRecipe.description,
    image: dbRecipe.image,
    prepTime: dbRecipe.prep_time,
    difficulty: dbRecipe.difficulty,
    rating: Number(averageRating.toFixed(1)),
    category: dbRecipe.category,
    ingredients: dbRecipe.ingredients ?? [],
    instructions: dbRecipe.instructions ?? [],
    nutritionFacts: toNutritionFacts(dbRecipe.nutrition_facts),
    reviews: reviews
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(review => ({
        id: review.id,
        userId: review.user_id,
        userName: review.profiles?.full_name ?? '',
        rating: review.rating,
        comment: review.comment || '',
        date: new Date(review.created_at).toISOString().split('T')[0]
      })),
    authorId: dbRecipe.author_id,
    authorName: dbRecipe.profiles?.full_name,
    authorType: dbRecipe.profiles?.user_type as 'Nutritionist' | 'Client',
    authorAvatarUrl: dbRecipe.profiles?.avatar_url || null,
    createdAt: dbRecipe.created_at,
    updatedAt: dbRecipe.updated_at
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
export async function createRecipe(recipe: RecipeInput) {
  const { data, error } = await supabase
    .from('recipes')
    .insert([{
      title: recipe.title,
      description: recipe.description,
      image: recipe.image,
      prep_time: recipe.prepTime,
      difficulty: recipe.difficulty,
      category: recipe.category,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      nutrition_facts: toNutritionFacts(recipe.nutritionFacts),
      author_id: recipe.authorId
    }])
    .select(RECIPE_SELECT)
    .single();

  if (error) throw error;
  return convertDatabaseRecipeToAppRecipe(data);
}

export async function updateRecipe(recipeId: string, updates: Partial<Recipe>) {
  const { data, error } = await supabase
    .from('recipes')
    .update({
      title: updates.title,
      description: updates.description,
      image: updates.image,
      prep_time: updates.prepTime,
      difficulty: updates.difficulty,
      category: updates.category,
      ingredients: updates.ingredients,
      instructions: updates.instructions,
      nutrition_facts: updates.nutritionFacts ? toNutritionFacts(updates.nutritionFacts) : undefined
    })
    .eq('id', recipeId)
    .select(RECIPE_SELECT)
    .single();

  if (error) throw error;
  return convertDatabaseRecipeToAppRecipe(data);
}

export async function deleteRecipe(recipeId: string) {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId);

  if (error) throw error;
}

export async function getRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(convertDatabaseRecipeToAppRecipe);
}

export async function getRecipeById(recipeId: string) {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', recipeId)
    .maybeSingle();

  if (error) throw error;
  return data ? convertDatabaseRecipeToAppRecipe(data) : null;
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

  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);

    if (error.message.includes('session_not_found')) {
      throw new Error('Sessão expirada. Solicite um novo link de recuperação.');
    }
    if (error.message.includes('Password should be at least')) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    throw new Error('Erro ao atualizar senha. Tente novamente.');
  }
}

// Função para validar token de recuperação e obter usuário
export async function validateRecoveryToken(): Promise<{ valid: boolean; user?: AuthUser }> {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (!accessToken || type !== 'recovery') {
      return { valid: false };
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
