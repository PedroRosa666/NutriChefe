import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (categoryKey: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  const t = useTranslation();

  const categoryTranslations = t.categories;

  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-2 p-1",
        "rounded-2xl border bg-white/80 shadow-sm",
        "dark:bg-gray-900/80 dark:border-gray-700"
      )}
    >
      {categories.map((categoryKey) => {
        const translatedCategory =
          categoryTranslations[categoryKey as keyof typeof categoryTranslations] ||
          categoryKey;

        const isSelected = selectedCategory === categoryKey;

        return (
          <button
            key={categoryKey}
            type="button"
            onClick={() => onSelectCategory(categoryKey)}
            aria-pressed={isSelected}
            className={cn(
              "relative px-3 sm:px-4 py-1.5",
              "rounded-full text-xs sm:text-sm font-medium",
              "transition-all duration-200 whitespace-nowrap",
              "border backdrop-blur-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              "focus-visible:ring-green-500/70 focus-visible:ring-offset-white",
              "dark:focus-visible:ring-offset-gray-900",
              isSelected
                ? [
                    "border-transparent text-white shadow-md",
                    "bg-gradient-to-r from-green-500 to-emerald-500"
                  ]
                : [
                    "border-gray-200/80 bg-gray-50/80 text-gray-700",
                    "hover:bg-gray-100",
                    "dark:border-gray-700 dark:bg-gray-800/80",
                    "dark:text-gray-200 dark:hover:bg-gray-700",
                  ]
            )}
          >
            {translatedCategory}
          </button>
        );
      })}
    </div>
  );
}
