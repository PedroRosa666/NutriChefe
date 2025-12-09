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
    <div className="flex flex-wrap gap-4 border-b border-gray-200 dark:border-gray-700 pb-2">
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
              "relative text-xs sm:text-sm font-medium transition-all duration-200",
              "pb-1 outline-none",
              "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100",
              isSelected && [
                "text-green-600 dark:text-green-400",
              ]
            )}
          >
            {translatedCategory}

            {/* Indicador embaixo, só quando selecionado */}
            {isSelected && (
              <span
                className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-0.5
                           rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
