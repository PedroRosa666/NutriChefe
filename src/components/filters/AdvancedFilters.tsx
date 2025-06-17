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
          "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border transition-all duration-200 whitespace-nowrap text-sm font-medium",
          hasActiveFilters
            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Filter className="w-4 h-4 flex-shrink-0" />
        <span className="hidden sm:inline">{t.filters.advanced}</span>
        <span className="sm:hidden">Filtros</span>
        {hasActiveFilters && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
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
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 z-50 max-h-[80vh] overflow-y-auto",
              // Posicionamento responsivo - sempre à esquerda no mobile
              "right-0 sm:right-0",
              dropdownPosition === 'left' && "sm:right-0 sm:left-auto",
              dropdownPosition === 'right' && "sm:left-0 sm:right-auto",
              // Largura responsiva
              "w-80 sm:w-80"
            )}
            style={{
              // Garantir que não vaze da tela no mobile
              maxWidth: 'calc(100vw - 2rem)',
              minWidth: '280px'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                {t.filters.advanced}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Difficulty Filter */}
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <ChefHat className="w-4 h-4 flex-shrink-0" />
                  {t.recipe.difficulty}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {difficultyOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setDifficulty(difficulty === option.value ? null : option.value)}
                      className={cn(
                        "px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 text-center",
                        difficulty === option.value
                          ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600"
                          : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:border-gray-600"
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
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  {t.recipe.prepTime}
                </label>
                <div className="space-y-2">
                  {prepTimeOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setPrepTimeRange(prepTimeRange === option.value ? null : option.value)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 text-left",
                        prepTimeRange === option.value
                          ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600"
                          : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:border-gray-600"
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
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <Star className="w-4 h-4 flex-shrink-0" />
                  {t.filters.minRating}
                </label>
                <div className="space-y-2">
                  {ratingOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      onClick={() => setMinRating(minRating === option.value ? null : option.value)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 text-left",
                        minRating === option.value
                          ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600"
                          : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:border-gray-600"
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
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    resetFilters();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {t.filters.clearAll}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}