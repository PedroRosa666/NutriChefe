import { useEffect, useRef, useState } from 'react';
import { useDialog } from '../../hooks/useDialog';
import { Link } from 'react-router-dom';
import { Crown, Lock } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usePremiumContent, usePremiumStore } from '../../store/premium';
import { useAuthStore } from '../../store/auth';
import { getPremiumTeasers, type RecipeTeaser } from '../../services/progress';
import { RECIPE_PLACEHOLDER } from '../RecipeCard';
import { recipeImageFallback } from '../../lib/recipe-image';

/**
 * Vitrine das receitas exclusivas para quem ainda não tem Premium: foto, título e calorias,
 * com cadeado. Quem tem Premium já vê as exclusivas na lista, com o selo.
 */
export function ExclusiveShelf() {
  const t = useTranslation();
  const c = t.clientPremium;
  const userId = useAuthStore((s) => s.user?.id);
  const premiumLoaded = usePremiumStore((s) => s.loaded);
  const unlocked = usePremiumContent();
  const [teasers, setTeasers] = useState<RecipeTeaser[]>([]);

  // Espera saber se a conta tem Premium, para não piscar a vitrine para quem assina.
  const waiting = !!userId && !premiumLoaded;

  useEffect(() => {
    if (unlocked || waiting) return;
    let cancelled = false;
    getPremiumTeasers()
      .then((rows) => !cancelled && setTeasers(rows))
      .catch((error) => console.error('Error loading premium teasers:', error));
    return () => {
      cancelled = true;
    };
  }, [unlocked, waiting]);

  if (unlocked || waiting || teasers.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-white">
            <Crown className="h-4 w-4 text-amber-500" />
            {c.exclusiveTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{c.exclusiveHint}</p>
        </div>
        <Link to="/mentoria-ia" className="whitespace-nowrap text-sm font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400">
          {c.seePremium}
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {teasers.map((r) => (
          <Link
            key={r.id}
            to={`/receita/${r.id}`}
            className="group relative w-44 flex-shrink-0 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/50 dark:bg-slate-900"
          >
            <div className="relative h-28 overflow-hidden">
              <img
                src={r.image || RECIPE_PLACEHOLDER}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover blur-[2px] transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith(RECIPE_PLACEHOLDER)) target.src = RECIPE_PLACEHOLDER;
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                <Lock className="h-6 w-6 text-white drop-shadow" />
              </span>
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{r.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {[r.prep_time ? `${r.prep_time} min` : null, r.calories ? `${Math.round(r.calories)} kcal` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Tela da receita exclusiva aberta por quem não tem Premium (link direto ou vitrine). */
export function LockedRecipe({ teaser, onClose }: { teaser: RecipeTeaser; onClose: () => void }) {
  const t = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, { onClose });
  const c = t.clientPremium;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-[3px]" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="locked-recipe-title" className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <img src={teaser.image || RECIPE_PLACEHOLDER} alt="" onError={recipeImageFallback} className="h-40 w-full object-cover" />
        <div className="space-y-3 p-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            <Crown className="h-3.5 w-3.5" />
            {c.lockedTitle}
          </span>
          <h2 id="locked-recipe-title" className="text-lg font-bold text-slate-900 dark:text-white">{teaser.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{c.lockedText}</p>
          <div className="flex justify-center gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
              {c.back}
            </button>
            <Link to="/mentoria-ia" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400">
              <Crown className="h-4 w-4" />
              {c.seePremium}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
