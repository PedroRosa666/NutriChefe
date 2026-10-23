import { motion } from 'framer-motion';
import { Salad, Flame, Dumbbell, WheatOff, Leaf, UtensilsCrossed } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (categoryKey: string) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  all: UtensilsCrossed,
  vegan: Leaf,
  lowCarb: Flame,
  highProtein: Dumbbell,
  glutenFree: WheatOff,
  vegetarian: Salad,
};

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  const t = useTranslation();
  const categoryTranslations = t.categories;

  return (
    <>
      {categories.map((categoryKey) => {
        const translatedCategory = categoryTranslations[categoryKey as keyof typeof categoryTranslations] || categoryKey;
        const Icon = categoryIcons[categoryKey] || UtensilsCrossed;
        const isSelected = selectedCategory === categoryKey;

        return (
          <motion.button
            key={categoryKey}
            onClick={() => onSelectCategory(categoryKey)}
            className={cn(
              "group relative px-2.5 sm:px-4 py-2.5 rounded-full text-[13px] sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap border",
              "flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 min-w-0",
              isSelected
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:border-emerald-500"
                : "bg-white border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:bg-slate-700/60 dark:border-slate-600 dark:text-slate-100 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Icon
              className={cn(
                "w-4 h-4 flex-shrink-0 transition-colors duration-200 max-[379px]:hidden",
                isSelected
                  ? "text-white"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            />
            <span className="truncate">{translatedCategory}</span>
          </motion.button>
        );
      })}
    </>
  );
}