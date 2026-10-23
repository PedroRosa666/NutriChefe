import { useCallback, useEffect, useState } from 'react';
import { Crown, Eye, EyeOff, MessageSquare, Search, Trash2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useToastStore } from '../../store/toast';
import { confirmDialog } from '../../store/confirm';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { adminRecipes, adminReviews, deleteReview, setRecipeHidden, setRecipePremium, type AdminRecipe, type AdminReview } from '../../services/admin';
import { adminErrorText } from './errors';

function Reviews({ recipeId }: { recipeId: string }) {
  const t = useTranslation();
  const a = t.adminPanel;
  const showToast = useToastStore((s) => s.showToast);
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const load = useCallback(() => adminReviews(recipeId).then(setRows).catch(() => setRows([])), [recipeId]);
  useEffect(() => {
    load();
  }, [load]);

  if (!rows) return <LoadingSpinner size="sm" />;
  if (!rows.length) return <p className="text-xs text-slate-500">{a.noReviews}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800">
          <span className="flex-1 text-slate-700 dark:text-slate-200">
            <strong>{r.user_name || '—'}</strong> · {'★'.repeat(r.rating)} {r.comment && <span className="block text-xs">{r.comment}</span>}
          </span>
          <button
            type="button"
            aria-label={a.deleteReview}
            onClick={async () => {
              if (!(await confirmDialog(a.deleteReviewConfirm))) return;
              try {
                await deleteReview(r.id);
                showToast(a.saved, 'success');
                load();
              } catch (error) {
                showToast(adminErrorText(error, a), 'error');
              }
            }}
            className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AdminModeration() {
  const t = useTranslation();
  const a = t.adminPanel;
  const showToast = useToastStore((s) => s.showToast);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminRecipe[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback((q: string) => adminRecipes(q).then(setRows).catch(() => setRows([])), []);
  useEffect(() => {
    const timer = window.setTimeout(() => load(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const toggle = async (r: AdminRecipe) => {
    try {
      await setRecipeHidden(r.id, !r.hidden_at);
      showToast(r.hidden_at ? a.recipeShown : a.recipeHidden, 'success');
      load(query);
    } catch (error) {
      showToast(adminErrorText(error, a), 'error');
    }
  };

  const togglePremium = async (r: AdminRecipe) => {
    try {
      await setRecipePremium(r.id, !r.premium_only);
      showToast(r.premium_only ? t.clientPremium.exclusiveOff : t.clientPremium.exclusiveOn, 'success');
      load(query);
    } catch (error) {
      showToast(adminErrorText(error, a), 'error');
    }
  };

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={a.searchRecipes}
        />
      </label>
      {rows === null ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-2xl border bg-white p-3 dark:bg-slate-900 ${r.hidden_at ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{r.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.author_name || '—'} · ★ {Number(r.rating).toFixed(1)} · {a.reviewsCount.replace('{n}', String(r.reviews))}
                    {r.hidden_at && <span className="ml-1 font-semibold text-rose-600">· {a.hidden}</span>}
                    {r.premium_only && <span className="ml-1 font-semibold text-amber-600">· {t.clientPremium.badge}</span>}
                  </p>
                </div>
                {r.reviews > 0 && (
                  <button type="button" aria-label={a.reviews} onClick={() => setOpen(open === r.id ? null : r.id)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => togglePremium(r)}
                  aria-label={r.premium_only ? t.clientPremium.unmarkExclusive : t.clientPremium.markExclusive}
                  title={r.premium_only ? t.clientPremium.unmarkExclusive : t.clientPremium.markExclusive}
                  className={`rounded-lg border p-1.5 ${r.premium_only ? 'border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-300'}`}
                >
                  <Crown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  {r.hidden_at ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {r.hidden_at ? a.show : a.hide}
                </button>
              </div>
              {open === r.id && (
                <div className="mt-2">
                  <Reviews recipeId={r.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
