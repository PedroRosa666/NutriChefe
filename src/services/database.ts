import { supabase } from '../lib/supabase';
import type { Recipe } from '../types/recipe';
import type { User } from '../types/user';

// Tipos para o banco de dados
export interface DatabaseRecipe {
  id: string;
  title: string;
  description: string;
  image: string;
  prep_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rating: number;
  category: string;
  ingredients: string[];
  instructions: string[];
  nutrition_facts: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    user_type: string;
  };
  reviews?: Array<{
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    user_id: string;
    profiles: {
      full_name: string;
    };
  }>;
}

// Cache para mapear UUIDs para IDs numéricos
const uuidToNumericMap = new Map<string, number>();
const numericToUuidMap = new Map<number, string>();
let nextNumericId = 1;

// Função para converter receita do banco para o formato da aplicação
function convertDatabaseRecipeToAppRecipe(dbRecipe: DatabaseRecipe): Recipe {
  // Usar cache para manter consistência dos IDs
  let numericId = uuidToNumericMap.get(dbRecipe.id);
  if (!numericId) {
    numericId = nextNumericId++;
    uuidToNumericMap.set(dbRecipe.id, numericId);
    numericToUuidMap.set(numericId, dbRecipe.id);
  }
  
  // Calcular rating médio corretamente
  const reviews = dbRecipe.reviews || [];
  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;
  
  return {
    id: numericId,
    title: dbRecipe.title,
    description: dbRecipe.description,
    image: dbRecipe.image,
    prepTime: dbRecipe.prep_time,
    difficulty: dbRecipe.difficulty,
    rating: Number(averageRating.toFixed(1)), // Garantir que seja um número com 1 casa decimal
    category: dbRecipe.category,
    ingredients: dbRecipe.ingredients,
    instructions: dbRecipe.instructions,
    nutritionFacts: {
      calories: Number(dbRecipe.nutrition_facts.calories),
      protein: Number(dbRecipe.nutrition_facts.protein),
      carbs: Number(dbRecipe.nutrition_facts.carbs),
      fat: Number(dbRecipe.nutrition_facts.fat),
      fiber: Number(dbRecipe.nutrition_facts.fiber),
    },
    reviews: reviews.map(review => ({
      id: parseInt(review.id.replace(/-/g, '').substring(0, 8), 16),
      userId: review.user_id,
      userName: review.profiles.full_name,
      rating: review.rating,
      comment: review.comment || '',
      date: new Date(review.created_at).toISOString().split('T')[0]
    })),
    authorId: dbRecipe.author_id,
    authorName: dbRecipe.profiles?.full_name,
    authorType: dbRecipe.profiles?.user_type as 'Nutritionist' | 'Client',
    createdAt: dbRecipe.created_at,
    updatedAt: dbRecipe.updated_at
  };
}

// Função para obter UUID a partir do ID numérico
function getUuidFromNumericId(numericId: number): string | null {
  return numericToUuidMap.get(numericId) || null;
}

// Funções de usuário
export async function createUserProfile(user: {
  id: string;
  email: string;
  full_name: string;
  user_type: 'Nutritionist' | 'Client';
}) {
  console.log('Creating user profile:', user);
  const { data, error } = await supabase
    .from('profiles')
    .insert([user])
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
  console.log('User profile created successfully:', data);
  return data;
}

export async function updateUserProfile(id: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: updates.name,
      user_type: updates.type,
      email: updates.email
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserProfile(id: string) {
  console.log('Getting user profile for ID:', id);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
  console.log('User profile retrieved:', data);
  return data;
}

// Funções de receitas
export async function createRecipe(recipe: Omit<Recipe, 'id' | 'rating' | 'reviews' | 'createdAt' | 'updatedAt'>) {
  console.log('Creating recipe:', recipe);
  
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
      nutrition_facts: {
        calories: Number(recipe.nutritionFacts.calories),
        protein: Number(recipe.nutritionFacts.protein),
        carbs: Number(recipe.nutritionFacts.carbs),
        fat: Number(recipe.nutritionFacts.fat),
        fiber: Number(recipe.nutritionFacts.fiber),
      },
      author_id: recipe.authorId
    }])
    .select(`
      *,
      profiles!recipes_author_id_fkey(full_name, user_type),
      reviews(
        id,
        rating,
        comment,
        created_at,
        user_id,
        profiles!reviews_user_id_fkey(full_name)
      )
    `)
    .single();

  if (error) {
    console.error('Error creating recipe:', error);
    throw error;
  }
  
  console.log('Recipe created successfully:', data);
  return convertDatabaseRecipeToAppRecipe(data);
}

export async function updateRecipe(recipeId: number, updates: Partial<Recipe>) {
  const uuid = getUuidFromNumericId(recipeId);
  if (!uuid) {
    throw new Error('Receita não encontrada');
  }

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
      nutrition_facts: updates.nutritionFacts ? {
        calories: Number(updates.nutritionFacts.calories),
        protein: Number(updates.nutritionFacts.protein),
        carbs: Number(updates.nutritionFacts.carbs),
        fat: Number(updates.nutritionFacts.fat),
        fiber: Number(updates.nutritionFacts.fiber),
      } : undefined
    })
    .eq('id', uuid)
    .select(`
      *,
      profiles!recipes_author_id_fkey(full_name, user_type),
      reviews(
        id,
        rating,
        comment,
        created_at,
        user_id,
        profiles!reviews_user_id_fkey(full_name)
      )
    `)
    .single();

  if (error) throw error;
  return convertDatabaseRecipeToAppRecipe(data);
}

export async function deleteRecipe(recipeId: number) {
  const uuid = getUuidFromNumericId(recipeId);
  if (!uuid) {
    throw new Error('Receita não encontrada');
  }

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', uuid);

  if (error) throw error;
  
  // Limpar do cache
  uuidToNumericMap.delete(uuid);
  numericToUuidMap.delete(recipeId);
}

export async function getRecipes() {
  console.log('Fetching recipes from Supabase...');
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      profiles!recipes_author_id_fkey(full_name, user_type),
      reviews(
        id,
        rating,
        comment,
        created_at,
        user_id,
        profiles!reviews_user_id_fkey(full_name)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recipes:', error);
    throw error;
  }
  
  console.log('Raw recipes from database:', data?.length || 0);
  if (!data || data.length === 0) {
    console.log('No recipes found in database');
    return [];
  }
  
  const recipes = data.map(convertDatabaseRecipeToAppRecipe);
  console.log('Converted recipes:', recipes.length);
  return recipes;
}

export async function getRecipeById(recipeId: number) {
  const uuid = getUuidFromNumericId(recipeId);
  if (!uuid) {
    throw new Error('Receita não encontrada');
  }

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      profiles!recipes_author_id_fkey(full_name, user_type),
      reviews(
        id,
        rating,
        comment,
        created_at,
        user_id,
        profiles!reviews_user_id_fkey(full_name)
      )
    `)
    .eq('id', uuid)
    .single();

  if (error) throw error;
  return convertDatabaseRecipeToAppRecipe(data);
}

// Funções de avaliações
export async function addReview(recipeId: number, review: {
  user_id: string;
  rating: number;
  comment: string;
}) {
  const uuid = getUuidFromNumericId(recipeId);
  if (!uuid) {
    throw new Error('Receita não encontrada');
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert([{
      recipe_id: uuid,
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

  if (error) {
    console.error('Error updating review:', error);
    throw error;
  }
  return data;
}

export async function deleteReview(reviewId: string) {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    console.error('Error deleting review:', error);
    throw error;
  }
}

// Funções de favoritos
export async function addToFavorites(userId: string, recipeId: number) {
  const uuid = getUuidFromNumericId(recipeId);
  if (!uuid) {
    throw new Error('Receita não encontrada');
  }

  const { error } = await supabase
    .from('favorites')
    .insert([{
      user_id: userId,
      recipe_id: uuid
    }]);

  if (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

export async function removeFromFavorites(userId: string, recipeId: number) {
  const uuid = getUuidFromNumericId(recipeId);
  if (!uuid) {
    throw new Error('Receita não encontrada');
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', uuid);

  if (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

export async function getFavorites(userId: string) {
  console.log('Fetching favorites for user:', userId);
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching favorites:', error);
    throw error;
  }
  
  console.log('Raw favorites data:', data);
  
  // Converter UUIDs para IDs numéricos
  const favoriteIds: number[] = [];
  data?.forEach(favorite => {
    const numericId = uuidToNumericMap.get(favorite.recipe_id);
    if (numericId) {
      favoriteIds.push(numericId);
    }
  });
  
  console.log('Converted favorite IDs:', favoriteIds);
  return favoriteIds;
}

// Função para verificar se email existe (para recuperação de senha)
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    console.log('Checking if email exists:', email);
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        console.log('Email not found in profiles table');
        return false;
      }
      console.error('Error checking email:', error);
      return false;
    }

    console.log('Email found in profiles table:', !!data);
    return !!data;
  } catch (error) {
    console.error('Error checking email existence:', error);
    return false;
  }
}

// Funções para recuperação de senha
export async function sendPasswordResetEmail(email: string): Promise<void> {
  console.log('Sending password reset email to:', email);
  
  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    console.error('Error sending password reset email:', error);
    
    // Mapear erros específicos para mensagens amigáveis
    if (error.message.includes('Email rate limit exceeded')) {
      throw new Error('Muitas tentativas de recuperação. Aguarde alguns minutos antes de tentar novamente.');
    } else if (error.message.includes('For security purposes')) {
      throw new Error('Por motivos de segurança, aguarde alguns minutos antes de solicitar outro email.');
    } else if (error.message.includes('Invalid email')) {
      throw new Error('Email inválido. Verifique o formato do email.');
    } else if (error.message.includes('User not found')) {
      throw new Error('Email não encontrado. Verifique se o email está correto ou crie uma conta.');
    }
    
    throw new Error('Erro ao enviar email de recuperação. Tente novamente em alguns minutos.');
  }
  
  console.log('Password reset email sent successfully');
}

export async function updatePassword(newPassword: string): Promise<void> {
  console.log('Updating user password');
  
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);
    
    if (error.message.includes('session_not_found')) {
      throw new Error('Sessão expirada. Solicite um novo link de recuperação.');
    } else if (error.message.includes('same_password')) {
      throw new Error('A nova senha deve ser diferente da senha atual.');
    } else if (error.message.includes('Password should be at least')) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }
    
    throw new Error('Erro ao atualizar senha. Tente novamente.');
  }
  
  console.log('Password updated successfully');
}

export async function verifyPasswordResetToken(): Promise<boolean> {
  try {
    console.log('Verifying password reset token');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return false;
    }

    if (!session) {
      console.log('No session found');
      return false;
    }

    // Verificar se é uma sessão de recuperação de senha
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    console.log('Token verification - type:', type, 'has access token:', !!accessToken);
    
    return type === 'recovery' && !!accessToken;
  } catch (error) {
    console.error('Error verifying password reset token:', error);
    return false;
  }
}

// Função para validar token de recuperação e obter usuário
export async function validateRecoveryToken(): Promise<{ valid: boolean; user?: any }> {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (!accessToken || type !== 'recovery') {
      return { valid: false };
    }

    // Verificar se o token é válido
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.error('Invalid recovery token:', error);
      return { valid: false };
    }

    // Definir a sessão com o token de recuperação
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: hashParams.get('refresh_token') || ''
    });

    if (sessionError) {
      console.error('Error setting session:', sessionError);
      return { valid: false };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('Error validating recovery token:', error);
    return { valid: false };
  }
}