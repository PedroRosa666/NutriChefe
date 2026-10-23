import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className={cn(
          "fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm z-50",
          type === 'success' && "bg-emerald-50/95 dark:bg-emerald-900/90 border-2 border-emerald-500 dark:border-emerald-400",
          type === 'error' && "bg-red-50/95 dark:bg-red-900/90 border-2 border-red-500 dark:border-red-400",
          type === 'info' && "bg-blue-50/95 dark:bg-blue-900/90 border-2 border-blue-500 dark:border-blue-400",
          type === 'warning' && "bg-amber-50/95 dark:bg-amber-900/90 border-2 border-amber-500 dark:border-amber-400"
        )}
        role={type === 'error' ? 'alert' : 'status'}
      >
        {icons[type]}
        <span className="text-sm font-medium text-gray-900 dark:text-white">{message}</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}