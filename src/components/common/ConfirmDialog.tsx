import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useConfirmStore } from '../../store/confirm';
import { useTranslation } from '../../hooks/useTranslation';

/** Mostra a pergunta de confirmDialog(). Montado uma vez, no layout. */
export function ConfirmDialog() {
  const { request, answer } = useConfirmStore();
  const t = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, answer]);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-message"
      onClick={(e) => e.target === e.currentTarget && answer(false)}
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p id="confirm-dialog-message" className="pt-1.5 text-sm text-slate-800 dark:text-slate-100">
            {request.message}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t.common.cancel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => answer(true)}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
