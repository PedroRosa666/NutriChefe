import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Star, Clock, ChefHat } from 'lucide-react';
import { useFiltersStore } from '../../store/filters';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

export function AdvancedFilters() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'left' | 'right'>('right');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    difficulty,
    prepTimeRange,
    minRating,
    setDifficulty,
    setPrepTimeRange,
    setMinRating,
    resetFilters
  } = useFiltersStore();
  const t = useTranslation();

  const prepTimeOptions = [
    { value: 'quick', label: t.filters.prepTime.quick, max: 15 },
    { value: 'medium', label: t.filters.prepTime.medium, max: 30 },
    { value: 'long', label: t.filters.prepTime.long, max: null }
  ];

  const difficultyOptions = [
    { value: 'easy', label: t.recipe.difficultyLevels.easy },
    { value: 'medium', label: t.recipe.difficultyLevels.medium },
    { value: 'hard', label: t.recipe.difficultyLevels.hard }
  ];

  const ratingOptions = [
    { value: 4, label: '4+ ⭐' },
    { value: 4.5, label: '4.5+ ⭐' },
    { value: 5, label: '5 ⭐' }
  ];

  const hasActiveFilters = difficulty || prepTimeRange || minRating;

  // Calcular posição do dropdown baseado no espaço disponível
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const dropdownWidth = 320; // largura aproximada do dropdown
      const margin = 16; // margem de segurança
      
      // Se não há espaço suficiente à direita, posicionar à esquerda
      if (buttonRect.right + dropdownWidth + margin > viewportWidth) {
        setDropdownPosition('left');
      } else {
        setDropdownPosition('right');
      }
    }
  }, [isOpen]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Fechar dropdown ao pressionar ESC
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap text-sm font-medium",
          hasActiveFilters
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
            : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-700/50"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <Filter className={cn(
          "w-4 h-4 flex-shrink-0 transition-colors duration-200",
          hasActiveFilters ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
        )} />
        <span className="hidden sm:inline">{t.filters.advanced}</span>
        <span className="sm:hidden">Filtros</span>
        {hasActiveFilters && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-emerald-600 dark:bg-emerald-500 text-white text-xs rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center flex-shrink-0 font-medium"
          >
            {[difficulty, prepTimeRange, minRating].filter(Boolean).length}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-5 z-50 max-h-[80vh] overflow-y-auto",
              "right-0",
              dropdownPosition === 'left' && "sm:right-0 sm:left-auto",
              dropdownPosition === 'right' && "sm:left-0 sm:right-auto",
              "w-72 sm:w-80"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                {t.filters.advanced}
              </h3>
              <motion.button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="space-y-5">
              {/* Difficulty Filter */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <ChefHat className="w-3.5 h-3.5 text-slate-400" />
                  {t.recipe.difficulty}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setDifficulty(difficulty === option.value ? null : option.value)}
                      className={cn(
                        "px-2 sm:px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 text-center",
                        difficulty === option.value
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700/50"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Prep Time Filter */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {t.recipe.prepTime}
                </label>
                <div className="space-y-1.5">
                  {prepTimeOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setPrepTimeRange(prepTimeRange === option.value ? null : option.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 text-left",
                        prepTimeRange === option.value
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700/50"
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Rating Filter */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <Star className="w-3.5 h-3.5 text-slate-400" />
                  {t.filters.minRating}
                </label>
                <div className="space-y-1.5">
                  {ratingOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setMinRating(minRating === option.value ? null : option.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 text-left",
                        minRating === option.value
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700/50"
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-3 border-t border-slate-100 dark:border-slate-800"
                >
                  <motion.button
                    onClick={() => {
                      resetFilters();
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors duration-150 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-700/50 text-xs font-medium"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {t.filters.clearAll}
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}