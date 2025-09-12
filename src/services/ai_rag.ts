// src/services/ai_rag.ts
import { supabase } from '../lib/supabase';
import { getGeminiResponse } from './gemini';
import type { Recipe } from '../types/recipe';

// ================================
// Tipos e utilidades
// ================================
type RecipeFilters = {
  ingredients: string[];
  category?: string;
  dietary?: string[];
  maxPrepTime?: number;
  difficulty?: 'easy'|'medium'|'hard';
  freeText?: string;
};

const CATEGORY_KEYWORDS = [
  'café da manhã','cafe da manha','almoço','almoco','jantar','lanche','sobremesa','snack','entrada','bebida'
];

const DIET_KEYWORDS = [
  'vegana','vegano','vegetariana','vegetariano',
  'sem glúten','sem gluten','sem lactose',
  'low carb','proteica','proteico','keto','paleo'
];

const DIFFICULTY_MAP: Record<string, 'easy'|'medium'|'hard'> = {
  'fácil':'easy','facil':'easy',
  'médio':'medium','medio':'medium',
  'difícil':'hard','dificil':'hard'
};

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
}

// ================================
// Extrator de filtros a partir da pergunta
// ================================
export function extractFilters(question: string): RecipeFilters {
  const q = normalize(question);

  // Ingredientes
  const ingredients: string[] = [];
  const ingMatch = q.match(/\b(com|contendo)\s+([a-z0-9 ,\-]+)/i);
  if (ingMatch?.[2]) {
    ingredients.push(
      ...ingMatch[2].split(/,| e /).map(s => s.trim()).filter(Boolean)
    );
  } else {
    const simples = q.match(/\bcom\s+([a-z0-9 ,\-]+)/);
    if (simples?.[1]) {
      ingredients.push(
        ...simples[1].split(/,| e /).map(s => s.trim()).filter(Boolean)
      );
    }
  }

  // Categoria
  let category: string | undefined;
  for (const c of CATEGORY_KEYWORDS) {
    if (q.includes(normalize(c))) { category = c; break; }
  }

  // Dietas/estilos
  const dietary = DIET_KEYWORDS.filter(k => q.includes(normalize(k)));

  // Tempo de preparo
  let maxPrepTime: number | undefined;
  const timeMatch = q.match(/(\d{1,3})\s*(min|mins|minutos)/);
  if (timeMatch) maxPrepTime = Number(timeMatch[1]);

  // Dificuldade
  let difficulty: 'easy'|'medium'|'hard' | undefined;
  for (const [pt, lv] of Object.entries(DIFFICULTY_MAP)) {
    if (q.includes(pt)) { difficulty = lv; break; }
  }

  return { ingredients, category, dietary, maxPrepTime, difficulty, freeText: question };
}

// ================================
// Consultas ao Supabase (principal + fallback)
// ================================
async function queryRecipes(filters: RecipeFilters, limit = 8): Promise<Recipe[]> {
  let q = supabase.from('recipes').select('*').limit(limit);

  if (filters.maxPrepTime) q = q.lte('prep_time', filters.maxPrepTime);
  if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
  if (filters.category) q = q.ilike('category', `%${filters.category}%`);

  if (filters.ingredients.length) {
    // exige TODOS os ingredientes pedidos
    for (const ing of filters.ingredients) {
      q = q.contains('ingredients', [ing]);
    }
  }

  if (filters.dietary?.length) {
    const term = filters.dietary.join(' | ');
    // abrange título/descrição e o array (via cast para texto)
    q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%,ingredients::text.ilike.%${term}%`);
  }

  if (filters.freeText) {
    const t = filters.freeText;
    q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data as any as Recipe[]) || [];
}

async function fallbackSimilarRecipes(filters: RecipeFilters, limit = 8): Promise<Recipe[]> {
  // 1) Algum dos ingredientes
  if (filters.ingredients.length) {
    const ors = filters.ingredients.map(i => `ingredients.cs.{"${i}"}`).join(',');
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .or(ors)
      .limit(limit);
    if (error) throw error;
    if (data?.length) return data as any as Recipe[];
  }

  // 2) Categoria
  if (filters.category) {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .ilike('category', `%${filters.category}%`)
      .order('rating', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (dat
