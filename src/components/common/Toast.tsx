import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

// Erro e alerta ficam mais tempo: dá para ler com calma (WCAG 2.2.1). Com o mouse em cima
// ou o foco no botão de fechar, o tempo para.
const DURATION: Record<ToastType, number> = { success: 4000, info: 4000, warning: 8000, error: 10000 };

export function Toast({ message, type, onClose, duration }: ToastProps) {
  const t = useTranslation();
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onClose, duration ?? DURATION[type]);
    return () => clearTimeout(timer);
  }, [message, type, duration, onClose, paused]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400" />,
    info: <Info className="w-5 h-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={cn(
          // No celular fica acima da barra de navegação de baixo.
          "fixed left-4 right-4 bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+0.75rem)] md:left-auto md:bottom-4 md:max-w-md flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg z-50",
          type === 'success' && "bg-emerald-50 dark:bg-emerald-900 border-2 border-emerald-500 dark:border-emerald-400",
          type === 'error' && "bg-red-50 dark:bg-red-900 border-2 border-red-500 dark:border-red-400",
          type === 'info' && "bg-blue-50 dark:bg-blue-900 border-2 border-blue-500 dark:border-blue-400",
          type === 'warning' && "bg-amber-50 dark:bg-amber-900 border-2 border-amber-500 dark:border-amber-400"
        )}
        role={type === 'error' ? 'alert' : 'status'}
      >
        {icons[type]}
        <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="-mr-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
