import { useTranslation } from '../../hooks/useTranslation';

interface RecipeInstructionsProps {
  instructions: string[];
}

export function RecipeInstructions({ instructions }: RecipeInstructionsProps) {
  const t = useTranslation();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-5">
        {t.recipe.instructions}
      </h3>

      <div className="space-y-0">
        {instructions.map((step, i) => (
          <div key={i} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-800">
                {i + 1}
              </div>
              {i < instructions.length - 1 && (
                <div className="w-0.5 flex-1 bg-emerald-100 dark:bg-emerald-900/20 my-1" />
              )}
            </div>
            <div className={i < instructions.length - 1 ? 'pb-5' : ''}>
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed pt-1">
                {step}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
