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

  // Obtenha o objeto de tradução de categorias
  const categoryTranslations = t.categories;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((categoryKey) => {
        // Obtenha a tradução da categoria
        const translatedCategory = categoryTranslations[categoryKey as keyof typeof categoryTranslations] || categoryKey;

        return (
          <button
            key={categoryKey}
            onClick={() => onSelectCategory(categoryKey)}
            className={cn(
              "px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap",
              selectedCategory === categoryKey
                ? "bg-green-500 text-white shadow-md transform scale-105"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"
            )}
          >
            {translatedCategory}
          </button>
        );
      })}
    </div>
  );
}