import { motion } from 'framer-motion';
import { Salad, Wheat, Flame, ShieldCheck, Leaf, UtensilsCrossed } from 'lucide-react';
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
  highProtein: Flame,
  glutenFree: ShieldCheck,
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
              "group relative px-4 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap",
              "flex items-center gap-2",
              isSelected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Icon
              className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors duration-200",
                isSelected
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 dark:text-slate-500"
              )}
            />
            <span>{translatedCategory}</span>
          </motion.button>
        );
      })}
    </>
  );
}