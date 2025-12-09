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
        "inline-flex items-center flex-wrap gap-1",
        "rounded-full border border-gray-200 bg-white/80 px-2 py-1",
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
              "relative px-3 py-1",
              "text-sm md:text-[15px] font-medium",
              "transition-all duration-150 outline-none",
              "text-gray-600 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white",
              // tira qualquer borda/forma forte, só texto
              // estado selecionado: highlight verde suave
              isSelected && [
                "text-emerald-700 dark:text-emerald-300",
                "bg-emerald-50/80 dark:bg-emerald-500/10",
                "rounded-full",
              ]
            )}
          >
            {translatedCategory}

            {isSelected && (
              <span
                className={cn(
                  "pointer-events-none absolute left-2 right-2 -bottom-0.5",
                  "h-0.5 rounded-full",
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
