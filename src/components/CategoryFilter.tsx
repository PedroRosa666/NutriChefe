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
        "w-full",
        "rounded-2xl border border-gray-200/70 bg-gray-50/80",
        "px-4 py-3",
        "dark:border-gray-700 dark:bg-gray-900/80"
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
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
                "relative outline-none",
                "text-sm md:text-base font-medium",
                "px-1.5 py-0.5",
                "transition-colors duration-150",
                // estado normal: só texto
                "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white",
                // seleção: só um highlight leve, sem borda forte
                isSelected && [
                  "text-green-700 dark:text-green-300",
                  "bg-green-500/10 dark:bg-green-500/15",
                  "rounded-md"
                ]
              )}
            >
              {translatedCategory}
            </button>
          );
        })}
      </div>
    </div>
  );
}
