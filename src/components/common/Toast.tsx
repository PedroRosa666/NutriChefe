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

// No celular fica acima da barra de navegação de baixo. Vazia, a região não ocupa espaço nem pega
// cliques; o aviso dentro dela volta a ser clicável.
const REGION =
  'pointer-events-none fixed left-4 right-4 bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-50 md:left-auto md:bottom-4 md:max-w-md';

/**
 * Onde os avisos aparecem. As duas regiões ficam sempre na página, vazias: leitores de tela só
 * anunciam com segurança o texto que entra numa região que já existia (uma região criada junto com
 * o texto muitas vezes passa calada). Erro interrompe a leitura (alert); o resto espera a vez (status).
 */
export function ToastRegion({ message, type, onClose }: { message: string | null; type: ToastType; onClose: () => void }) {
  const urgent = type === 'error';
  return (
    <>
      <div role="status" aria-live="polite" className={REGION}>
        <AnimatePresence>{message && !urgent && <Toast key="toast" message={message} type={type} onClose={onClose} />}</AnimatePresence>
      </div>
      <div role="alert" aria-live="assertive" className={REGION}>
        <AnimatePresence>{message && urgent && <Toast key="toast" message={message} type={type} onClose={onClose} />}</AnimatePresence>
      </div>
    </>
  );
}

function Toast({ message, type, onClose, duration }: ToastProps) {
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
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg',
        type === 'success' && "bg-emerald-50 dark:bg-emerald-900 border-2 border-emerald-500 dark:border-emerald-400",
        type === 'error' && "bg-red-50 dark:bg-red-900 border-2 border-red-500 dark:border-red-400",
        type === 'info' && "bg-blue-50 dark:bg-blue-900 border-2 border-blue-500 dark:border-blue-400",
        type === 'warning' && "bg-amber-50 dark:bg-amber-900 border-2 border-amber-500 dark:border-amber-400"
      )}
    >
      {icons[type]}
      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="-mr-1 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </button>
    </motion.div>
  );
}
