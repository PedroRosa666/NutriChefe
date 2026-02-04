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
          "group flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl border transition-all duration-300 whitespace-nowrap text-sm font-semibold shadow-sm",
          hasActiveFilters
            ? "bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-300 text-emerald-700 shadow-lg shadow-emerald-500/20 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:border-emerald-600 dark:text-emerald-300"
            : "bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:shadow-md dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:border-emerald-600"
        )}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Filter className={cn(
          "w-4 h-4 flex-shrink-0 transition-transform duration-300",
          hasActiveFilters ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400 group-hover:rotate-12"
        )} />
        <span className="hidden sm:inline">{t.filters.advanced}</span>
        <span className="sm:hidden">Filtros</span>
        {hasActiveFilters && (
          <motion.span
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0 font-bold shadow-md"
          >
            {[difficulty, prepTimeRange, minRating].filter(Boolean).length}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "absolute top-full mt-3 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6 z-50 max-h-[80vh] overflow-y-auto backdrop-blur-sm",
              "right-0",
              dropdownPosition === 'left' && "sm:right-0 sm:left-auto",
              dropdownPosition === 'right' && "sm:left-0 sm:right-auto",
              "w-72 sm:w-80"
            )}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                  {t.filters.advanced}
                </h3>
              </div>
              <motion.button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="space-y-6">
              {/* Difficulty Filter */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <ChefHat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  {t.recipe.difficulty}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setDifficulty(difficulty === option.value ? null : option.value)}
                      className={cn(
                        "px-2 sm:px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 text-center shadow-sm",
                        difficulty === option.value
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-2 border-emerald-400"
                          : "bg-slate-50 text-slate-700 border-2 border-slate-200 hover:border-emerald-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 dark:hover:border-emerald-600"
                      )}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Prep Time Filter */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  {t.recipe.prepTime}
                </label>
                <div className="space-y-2">
                  {prepTimeOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setPrepTimeRange(prepTimeRange === option.value ? null : option.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 text-left shadow-sm relative overflow-hidden",
                        prepTimeRange === option.value
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-2 border-emerald-400"
                          : "bg-slate-50 text-slate-700 border-2 border-slate-200 hover:border-emerald-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 dark:hover:border-emerald-600"
                      )}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="relative z-10">{option.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Rating Filter */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <Star className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400" />
                  </div>
                  {t.filters.minRating}
                </label>
                <div className="space-y-2">
                  {ratingOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setMinRating(minRating === option.value ? null : option.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 text-left shadow-sm relative overflow-hidden",
                        minRating === option.value
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-2 border-emerald-400"
                          : "bg-slate-50 text-slate-700 border-2 border-slate-200 hover:border-emerald-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-700 dark:hover:border-emerald-600"
                      )}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="relative z-10">{option.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-2 border-t border-slate-200 dark:border-slate-700"
                >
                  <motion.button
                    onClick={() => {
                      resetFilters();
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 rounded-xl hover:from-slate-200 hover:to-slate-300 transition-all duration-300 dark:from-slate-800 dark:to-slate-700 dark:text-slate-300 dark:hover:from-slate-700 dark:hover:to-slate-600 text-sm font-semibold shadow-sm border-2 border-slate-300 dark:border-slate-600"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
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