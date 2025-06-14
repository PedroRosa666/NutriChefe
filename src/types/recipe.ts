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
    id: number;
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    date: string;
  }[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
}
