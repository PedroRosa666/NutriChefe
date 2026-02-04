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
    <div className="flex flex-wrap gap-2.5">
      {categories.map((categoryKey) => {
        const translatedCategory = categoryTranslations[categoryKey as keyof typeof categoryTranslations] || categoryKey;
        const Icon = categoryIcons[categoryKey] || UtensilsCrossed;
        const isSelected = selectedCategory === categoryKey;

        return (
          <motion.button
            key={categoryKey}
            onClick={() => onSelectCategory(categoryKey)}
            className={cn(
              "group relative px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap shadow-sm",
              "flex items-center gap-2",
              isSelected
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md"
            )}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Icon
              className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-300",
                isSelected
                  ? "text-white"
                  : "text-emerald-500 dark:text-emerald-400 group-hover:scale-110"
              )}
            />
            <span>{translatedCategory}</span>
            {isSelected && (
              <motion.div
                layoutId="categoryIndicator"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}