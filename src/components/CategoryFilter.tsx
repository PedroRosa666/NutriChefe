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
        "rounded-xl border bg-white/80 px-4 py-3 shadow-sm",
        "backdrop-blur-sm",
        "dark:bg-gray-900/80 dark:border-gray-700"
      )}
    >
      <div className="flex flex-wrap gap-4">
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
                "relative pb-1.5 outline-none",
                "text-sm md:text-base font-medium tracking-tight",
                "transition-all duration-200",
                "border-b-2 border-transparent",
                "text-gray-600 hover:text-gray-900 hover:border-gray-300",
                "dark:text-gray-300 dark:hover:text-gray-50 dark:hover:border-gray-500",
                isSelected && [
                  "text-green-600 dark:text-green-400",
                  "border-green-500"
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
