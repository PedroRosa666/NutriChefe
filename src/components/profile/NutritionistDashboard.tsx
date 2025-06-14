import { Award, Users, BookOpen, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';

export function NutritionistDashboard() {
  const { user } = useAuthStore();
  const { recipes } = useRecipesStore();
  const t = useTranslation();

  if (!user || user.type !== 'Nutritionist') return null;

  const profile = user.profile || {};
  const userRecipes = recipes.filter(recipe => recipe.authorId === user.id);
  const totalReviews = userRecipes.reduce((acc, recipe) => acc + recipe.reviews.length, 0);
  const averageRating = userRecipes.reduce((acc, recipe) => acc + recipe.rating, 0) / userRecipes.length || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{t.profile.personalInfo}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t.profile.name}</label>
            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t.profile.email}</label>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <label className="text-sm text-gray-500 dark:text-gray-400">{t.profile.accountType}</label>
            <p className="font-medium capitalize text-gray-900 dark:text-white">{t.profile.nutricionist}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.publishedRecipes}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{userRecipes.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.totalReviews}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalReviews}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.averageRating}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{averageRating.toFixed(1)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t.profile.experience}</h3>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{profile.experience || 'N/A'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">{t.profile.myRecipes}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userRecipes.slice(-3).map(recipe => (
            <div key={recipe.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{recipe.title}</h4>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>★ {recipe.rating.toFixed(1)}</span>
                  <span>•</span>
                  <span>{recipe.reviews.length} {t.recipe.reviews}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}