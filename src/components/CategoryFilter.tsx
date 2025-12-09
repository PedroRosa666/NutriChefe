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
        "inline-flex items-center flex-wrap gap-2",
        "rounded-full border border-gray-200 bg-white/90 px-4 py-2",
        "shadow-sm backdrop-blur-sm",
        "dark:border-gray-700 dark:bg-gray-900/80"
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
              "relative px-4 py-2",
              "rounded-full",
              "text-base md:text-lg font-medium",
              "transition-all duration-150 outline-none",
              "text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white",
              isSelected && [
                "text-emerald-700 dark:text-emerald-300",
                "bg-emerald-50/90 dark:bg-emerald-500/10",
              ]
            )}
          >
            {translatedCategory}

            {isSelected && (
              <span
                className={cn(
                  "pointer-events-none absolute left-4 right-4 -bottom-1",
                  "h-1 rounded-full",
                  "bg-gradient-to-r from-emerald-400 to-green-500"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
