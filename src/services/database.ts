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
      userId: review.id,
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
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking email:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking email existence:', error);
    return false;
  }
}

// Funções para recuperação de senha
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Error updating password:', error);
    throw error;
  }
}

export async function verifyPasswordResetToken(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return false;
    }

    // Verificar se é uma sessão de recuperação de senha
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    return type === 'recovery';
  } catch (error) {
    console.error('Error verifying password reset token:', error);
    return false;
  }
}