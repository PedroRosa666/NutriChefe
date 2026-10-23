import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useRecipesStore } from '../store/recipes';
import { RecipeDetails } from '../components/RecipeDetails';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { LockedRecipe } from '../components/recipes/ExclusiveShelf';
import { getPremiumTeasers, type RecipeTeaser } from '../services/progress';
import { useTranslation } from '../hooks/useTranslation';

// Renderizada dentro da home (rota filha): a receita abre como modal por cima
// da lista, que continua montada. Fechar volta para onde a pessoa estava.
export function RecipePage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { recipes, fetchRecipes } = useRecipesStore();
  const [fetchDone, setFetchDone] = useState(recipes.length > 0);

  // Acesso direto pelo link: a lista ainda não foi carregada.
  useEffect(() => {
    if (recipes.length > 0) {
      setFetchDone(true);
      return;
    }
    let cancelled = false;
    fetchRecipes().finally(() => {
      if (!cancelled) setFetchDone(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRecipes]);

  // "default" = primeira página aberta nesta aba (link direto): não há para onde voltar.
  const close = useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  }, [location.key, navigate]);

  const recipe = recipes.find(r => r.id === id);

  // Não está na lista: pode ser uma receita exclusiva (a vitrine diz qual).
  const [locked, setLocked] = useState<RecipeTeaser | null | undefined>(undefined);
  const missing = fetchDone && !recipe;
  useEffect(() => {
    if (!missing) return;
    let cancelled = false;
    getPremiumTeasers()
      .then((rows) => !cancelled && setLocked(rows.find((r) => r.id === id) ?? null))
      .catch(() => !cancelled && setLocked(null));
    return () => {
      cancelled = true;
    };
  }, [missing, id]);

  if ((!recipe && !fetchDone) || (missing && locked === undefined)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[3px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!recipe && locked) return <LockedRecipe teaser={locked} onClose={close} />;

  if (!recipe) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 backdrop-blur-[3px] p-4">
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t.feedback.recipes.notFound}
          </h1>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t.feedback.recipes.backHome}
          </button>
        </div>
      </div>
    );
  }

  return <RecipeDetails recipe={recipe} onClose={close} />;
}
