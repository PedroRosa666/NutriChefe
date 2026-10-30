import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Eye, EyeOff, Link2, Trophy, UserCheck, UserX } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useRecipesStore } from '../../store/recipes';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { professionalChecklist, useProfessionalProfile } from '../../hooks/useProfessionalProfile';
import { getRecipeAuthorStats, type RecipeStats } from '../../services/care';
import { getMyCrnStatus, type CrnStatus } from '../../services/verification';
import { appLocale } from '../../lib/format';

// Blocos do nutricionista como autor e perfil público. Saíram do Painel (que é para os
// pacientes) e ficam onde se age sobre eles: Perfil profissional e Conteúdo › Receitas.

/** Força do perfil público, visibilidade e link para compartilhar. */
export function ProfileStrengthCard() {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();
  const { profile } = useProfessionalProfile(user?.id);
  const [copied, setCopied] = useState(false);
  const [crnStatus, setCrnStatus] = useState<CrnStatus | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    getMyCrnStatus(user.id)
      .then((r) => setCrnStatus(r.status))
      .catch((e) => console.error('Error loading CRN status:', e));
  }, [user?.id]);

  if (!user) return null;
  const checklist = professionalChecklist(profile ? { ...profile, avatar_url: user.avatar_url ?? profile.avatar_url } : null);
  const done = checklist.filter((c) => c.done).length;
  const completeness = Math.round((done / checklist.length) * 100);
  const publicUrl = `${window.location.origin}/nutricionista/${user.id}`;
  const isPublic = profile?.profile_visibility !== 'private';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      showToast(t.profile.linkCopied, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(publicUrl, 'info');
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.profile.profileStrength}</h2>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{completeness}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completeness}%` }} />
      </div>
      <ul className="space-y-1.5">
        {checklist.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
            )}
            {item.done ? (
              <span className="text-slate-500 line-through dark:text-slate-500">{t.profile.checklist[item.key]}</span>
            ) : (
              // Item pendente leva direto ao campo que falta (a foto fica na aba Conta).
              <Link
                to={item.key === 'photo' ? '/perfil?tab=account&campo=photo' : `/perfil?tab=professional&campo=${item.key}`}
                className="text-slate-700 underline-offset-2 hover:text-emerald-700 hover:underline dark:text-slate-200 dark:hover:text-emerald-400"
              >
                {t.profile.checklist[item.key]}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${isPublic ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          {isPublic ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {!isPublic
            ? t.nutritionists.editProfile.private
            : crnStatus && crnStatus !== 'approved'
              ? t.profileUi.publicAfterCrn
              : t.nutritionists.editProfile.public}
        </span>
        {/* "Aceitando pacientes" só faz sentido com o perfil visível. */}
        {isPublic && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${profile?.accepting_new_clients !== false ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
          {profile?.accepting_new_clients !== false ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
          {profile?.accepting_new_clients !== false ? t.nutritionists.acceptingClients : t.nutritionists.notAcceptingClients}
        </span>}
      </div>

      {/* O formulário de edição está logo abaixo, nesta mesma aba. Perfil privado: o motivo
          aparece escrito, em vez de um botão apagado. */}
      {isPublic ? (
        <button
          type="button"
          onClick={copyLink}
          title={publicUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Link2 className="h-4 w-4" />
          {copied ? t.profile.linkCopiedShort : t.profile.copyLink}
        </button>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.profile.privateProfileHint}</p>
      )}
    </section>
  );
}

/** Avaliações recebidas e desempenho das receitas publicadas. */
export function RecipeFeedback() {
  const t = useTranslation();
  const userRecipes = useRecipesStore((s) => s.mine);
  const [stats, setStats] = useState<RecipeStats[] | null>(null);
  useEffect(() => {
    getRecipeAuthorStats()
      .then(setStats)
      .catch((e) => {
        console.error('Error loading recipe stats:', e);
        setStats([]);
      });
  }, []);

  const recentReviews = useMemo(
    () =>
      userRecipes
        .flatMap((recipe) => recipe.reviews.map((review) => ({ ...review, recipeId: recipe.id, recipeTitle: recipe.title })))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [userRecipes],
  );
  const topRecipe = useMemo(
    () =>
      userRecipes
        .filter((r) => r.reviews.length > 0)
        .sort((a, b) => b.rating - a.rating || b.reviews.length - a.reviews.length)[0],
    [userRecipes],
  );

  if (!userRecipes.length) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.profile.recentReviews}</h2>

      {topRecipe && (
        <Link
          to={`/receita/${topRecipe.id}`}
          className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3 transition hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10"
        >
          <Trophy className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-amber-700 dark:text-amber-300">{t.profile.topRecipe}</p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{topRecipe.title}</p>
          </div>
          <span className="text-sm font-semibold text-amber-600">★ {topRecipe.rating.toFixed(1)}</span>
        </Link>
      )}

      {recentReviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t.profile.publishFirstRecipe}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {recentReviews.map((review) => (
            <li key={review.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`/receita/${review.recipeId}`}
                  className="truncate text-sm font-medium text-slate-900 hover:text-emerald-600 dark:text-white"
                >
                  {review.recipeTitle}
                </Link>
                <span className="flex-shrink-0 text-xs text-amber-500">{'★'.repeat(review.rating)}</span>
              </div>
              {review.comment && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">“{review.comment}”</p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {review.userName || t.recipe.authorFallbackName} • {new Date(`${review.date}T00:00:00`).toLocaleDateString(appLocale())}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
      <RecipeStatsTable stats={stats} recipes={userRecipes} />
    </div>
  );
}

function RecipeStatsTable({ stats, recipes }: { stats: RecipeStats[] | null; recipes: { id: string; title: string }[] }) {
  const t = useTranslation();
  if (!stats) return null;
  const byId = new Map(stats.map((s) => [s.recipe_id, s]));
  const rows = recipes
    .map((r) => ({ ...r, ...(byId.get(r.id) ?? { favorites: 0, diary_logs: 0, in_plans: 0 }) }))
    .sort((a, b) => b.favorites + b.diary_logs + b.in_plans - (a.favorites + a.diary_logs + a.in_plans));

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.stats.title}</h2>
      {!rows.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.stats.empty}</p>
      ) : (
        <>
        {/* Celular: uma linha por receita com os três números embaixo (a tabela não cabe em 360px). */}
        <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5">
              <Link to={`/receita/${r.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-emerald-600 dark:text-white">
                {r.title}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.stats.favorites}: <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.favorites}</span>
                {' · '}{t.stats.diaryLogs}: <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.diary_logs}</span>
                {' · '}{t.stats.inPlans}: <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.in_plans}</span>
              </p>
            </li>
          ))}
        </ul>
        <div className="-mx-5 hidden overflow-x-auto px-5 sm:block">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="pb-2 font-medium">{t.stats.recipe}</th>
                <th className="pb-2 text-right font-medium">{t.stats.favorites}</th>
                <th className="pb-2 text-right font-medium">{t.stats.diaryLogs}</th>
                <th className="pb-2 text-right font-medium">{t.stats.inPlans}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-[260px] truncate py-2 pr-3">
                    <Link to={`/receita/${r.id}`} className="font-medium text-slate-900 hover:text-emerald-600 dark:text-white">
                      {r.title}
                    </Link>
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.favorites}</td>
                  <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.diary_logs}</td>
                  <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.in_plans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}
