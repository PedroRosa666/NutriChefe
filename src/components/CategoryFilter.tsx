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
        "rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-2",
        "dark:border-gray-700 dark:bg-gray-900/80"
      )}
    >
      <div className="flex flex-wrap gap-2">
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
                "px-3 py-1.5",
                "rounded-md",
                "text-sm md:text-[15px] font-medium",
                "transition-colors duration-150",
                "outline-none",
                // estado padrão
                "text-gray-600 hover:bg-gray-200/60",
                "dark:text-gray-200 dark:hover:bg-gray-700/60",
                // estado selecionado (só muda cor de fundo/texto)
                isSelected && [
                  "bg-gray-900 text-white",
                  "dark:bg-white dark:text-gray-900"
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
