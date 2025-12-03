import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useTranslation } from '../../hooks/useTranslation';

export function NutritionistDashboard() {
  const { user } = useAuthStore();
  const { recipes } = useRecipesStore();
  const t = useTranslation();

  if (!user || user.type !== 'Nutritionist') return null;

  const userRecipes = recipes.filter((recipe) => recipe.authorId === user.id);

  return (
    <section className="mt-10 space-y-6">
      {/* Título único da seção */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
          {t.profile.performanceSummary || 'Resumo da sua atuação'}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          Veja o desempenho das suas receitas, avaliações dos clientes e sua
          presença na plataforma.
        </p>
      </div>

      {/* Apenas minhas receitas – sem cards de métricas duplicados */}
      <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
          {t.profile.myRecipes}
        </h3>

        {userRecipes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.profile.noRecipesYet || 'Você ainda não publicou nenhuma receita.'}
          </p>
        ) : (
          <div className="space-y-3">
            {userRecipes.slice(-3).map((recipe) => (
              <div
                key={recipe.id}
                className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-800/70"
              >
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {recipe.title}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>★ {recipe.rating.toFixed(1)}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-400" />
                    <span>
                      {recipe.reviews.length} {t.recipe.reviews}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
