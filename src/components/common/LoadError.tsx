import { RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

/** Falha ao carregar: diz que deu erro (em vez de parecer lista vazia) e oferece tentar de novo. */
export function LoadError({ onRetry, message, className }: { onRetry: () => void; message?: string; className?: string }) {
  const t = useTranslation();
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700', className)}>
      <WifiOff className="h-8 w-8 text-slate-400" />
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{message ?? t.common.loadFailed}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <RefreshCw className="h-4 w-4" />
        {t.common.retry}
      </button>
    </div>
  );
}
