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
  ingredients: string[];
  instructions: string[];
  nutritionFacts: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
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