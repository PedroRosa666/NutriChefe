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
        "w-full max-w-xs",
        "rounded-2xl border border-gray-200 bg-white/90",
        "p-3 sm:p-4",
        "shadow-sm",
        "dark:border-gray-700 dark:bg-gray-900/90"
      )}
    >
      {/* Cabeçalho opcional do bloco de filtros */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Filtros
        </h3>
        {/* pode remover essa badge se não curtir */}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Categorias
        </span>
      </div>

      <div className="space-y-1">
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
                "flex w-full items-center gap-2 rounded-xl px-2.5 py-2",
                "text-sm md:text-[15px] font-medium",
                "transition-colors duration-150 outline-none",
                // estado base
                "text-gray-600 hover:bg-gray-100",
                "dark:text-gray-200 dark:hover:bg-gray-800",
                // selecionado
                isSelected && [
                  "bg-gray-900/90 text-white shadow-sm",
                  "dark:bg-gray-100 dark:text-gray-900"
                ]
              )}
            >
              {/* Indicador lateral */}
              <span
                className={cn(
                  "h-6 w-1 rounded-full bg-transparent",
                  isSelected && "bg-emerald-400"
                )}
              />

              <span className="flex-1 text-left">
                {translatedCategory}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
