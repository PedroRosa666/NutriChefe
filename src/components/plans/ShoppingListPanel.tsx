import { useEffect, useState } from 'react';
import { Check, Copy, Plus, Share2, ShoppingCart, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/auth';
import { useShoppingListStore } from '../../store/shopping-list';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { QUICK } from '../../lib/motion';
import { cn } from '../../lib/utils';
import type { ShoppingItem } from '../../lib/ingredients';

export function ShoppingListPanel() {
  const user = useAuthStore((s) => s.user);
  const { items, loaded, fetch, addCustom, toggle, remove, clearChecked, clearAll } = useShoppingListStore();
  const { showToast } = useToastStore();
  const t = useTranslation();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (user && !loaded) fetch(user.id);
  }, [user, loaded, fetch]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      console.error('Shopping list error:', error);
      showToast(t.shopping.error, 'error');
    }
  };

  const pending = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  const asText = () =>
    `${t.shopping.title}\n` + pending.map((i) => `• ${i.name}${i.quantity ? ` — ${i.quantity}` : ''}`).join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      showToast(t.shopping.copied, 'success');
    } catch {
      showToast(t.shopping.error, 'error');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t.shopping.title, text: asText() });
      } catch {
        /* cancelado */
      }
    } else copy();
  };

  const row = (item: ShoppingItem) => (
    <motion.li
      key={item.id}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={QUICK}
      className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
    >
      <button
        type="button"
        onClick={() => run(() => toggle(item.id))}
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
          item.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400 dark:border-slate-600'
        )}
        aria-label={item.name}
        aria-pressed={item.checked}
      >
        {item.checked && <Check className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', item.checked ? 'text-slate-400 line-through' : 'font-medium text-slate-900 dark:text-white')}>
          {item.name}
          {item.quantity && <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">{item.quantity}</span>}
        </p>
        {item.recipes.length > 0 && !item.checked && (
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
            {t.shopping.from}: {item.recipes.join(', ')}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => run(() => remove(item.id))}
        className="rounded-md p-1.5 text-slate-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 focus:opacity-100 dark:text-slate-600"
        aria-label={t.profile.remove}
      >
        <X className="h-4 w-4" />
      </button>
    </motion.li>
  );

  if (!user) return <p className="text-sm text-slate-500">{t.shopping.loginRequired}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t.shopping.title}</h3>
          {pending.length > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {pending.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {'share' in navigator ? <Share2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {'share' in navigator ? t.shopping.share : t.shopping.copy}
            </button>
            {done.length > 0 && (
              <button type="button" onClick={() => run(clearChecked)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                <Check className="h-3.5 w-3.5" />
                {t.shopping.clearChecked}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.confirm(t.shopping.clearAllConfirm) && run(clearAll)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.shopping.clearAll}
            </button>
          </div>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = draft;
          setDraft('');
          run(() => addCustom(name));
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.shopping.addPlaceholder}
          maxLength={120}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button type="submit" disabled={!draft.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {t.shopping.add}
        </button>
      </form>

      {!items.length ? (
        <div className="py-8 text-center">
          <p className="font-medium text-slate-700 dark:text-slate-200">{t.shopping.empty}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{t.shopping.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.shopping.toBuy}</p>
              <ul>
                <AnimatePresence initial={false}>{pending.map(row)}</AnimatePresence>
              </ul>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.shopping.inCart}</p>
              <ul>
                <AnimatePresence initial={false}>{done.map(row)}</AnimatePresence>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
