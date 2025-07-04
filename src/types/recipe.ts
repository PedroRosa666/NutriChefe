export interface Recipe {
  id: number;
  title: string;
  description: string;
  image: string;
  prepTime: number;
  difficulty: 'easy' | 'medium' | 'hard'; // Armazenado no formato original
  rating: number;
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
  createdAt: string;
  updatedAt: string;
}