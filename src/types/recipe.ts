import type { MealSlot } from '../services/care';
import type { DeclaredNutrition, NutrientKey, NutritionBasis, NutritionSource, NutritionStatus } from '../lib/recipe-nutrition';

/** Linha de ingrediente (recipe_ingredients): texto do autor e, se houver, o alimento do catálogo. */
export interface RecipeIngredient {
  id?: string;
  text: string;
  foodId: string | null;
  /** Nome do alimento ligado (só quando quem lê pode ver o alimento). */
  foodName?: string | null;
  quantity: number | null;
  unit: string | null;
  note: string;
  /** Gramas equivalentes (para o cálculo); null = não informado. */
  grams?: number | null;
  /** Medida caseira do alimento usada para chegar aos gramas. */
  measureLabel?: string | null;
  /** O autor decidiu que a linha não entra no cálculo ("sal a gosto"). */
  excluded?: boolean;
  /** O que a linha somou no último cálculo salvo. */
  lineNutrients?: DeclaredNutrition | null;
}

export interface Recipe {
  id: string; // UUID da receita no Supabase
  title: string;
  description: string;
  image: string;
  prepTime: number;
  difficulty: 'easy' | 'medium' | 'hard'; // Armazenado no formato original
  rating: number;
  /** Quantas avaliações (vem pronto do banco; `reviews` só é carregado na receita completa). */
  reviewCount: number;
  /**
   * true quando veio completa (modo de preparo e avaliações). Cartões da grade e do índice
   * trazem `instructions` e `reviews` vazios.
   */
  full?: boolean;
  category: string;
  /** Refeições em que a receita serve, marcadas pelo autor (vazio = não informado). */
  mealTypes?: MealSlot[];
  ingredients: string[];
  instructions: string[];
  /** Valores de UMA porção (já convertidos pelo banco). Desconhecido aparece como 0 aqui e em `unknownNutrients`. */
  nutritionFacts: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  /** Nutrientes que o autor não informou (não são zero). */
  unknownNutrients?: NutrientKey[];
  /** Como o autor escreveu os nutrientes, na base `nutritionBasis`. */
  nutritionDeclared?: DeclaredNutrition;
  nutritionBasis?: NutritionBasis;
  nutritionStatus?: NutritionStatus;
  /** De onde vêm os valores: à mão, calculados pelos ingredientes ou receita antiga. */
  nutritionSource?: NutritionSource;
  /** Valores à mão e ingredientes ou rendimento mudaram depois: o autor precisa revisar. */
  nutritionNeedsReview?: boolean;
  /** Só na gravação: o autor confirmou que os valores à mão continuam certos. */
  confirmManual?: boolean;
  /** Quantas porções o preparo rende; null = não informado. */
  yieldServings?: number | null;
  /** O que é uma porção ("1 fatia"). */
  servingLabel?: string;
  servingWeightG?: number | null;
  finalWeightG?: number | null;
  recipeVersion?: number;
  /** Ingredientes estruturados (só na receita completa). */
  ingredientRows?: RecipeIngredient[];
  reviews: {
    id: string; // Mudado para string para manter UUID original
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    date: string;
  }[];
  authorId: string;
  authorName?: string;
  authorType?: 'Nutritionist' | 'Client';
  authorAvatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Exclusiva do Premium (20261030120000_client_premium.sql). */
  premiumOnly?: boolean;
}