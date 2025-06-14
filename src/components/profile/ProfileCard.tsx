import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';

export function ProfileCard() {
  const { user } = useAuthStore();
  const { recipes } = useRecipesStore();
  
  const userRecipes = recipes.filter((recipe: { authorId: any; }) => recipe.authorId === user?.id);
  
  if (!user) return null;
}