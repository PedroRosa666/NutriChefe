import { Lightbulb, Wine, Salad, Flame } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettingsStore } from '../../store/settings';

interface RecipeTipsProps {
  category: string;
  difficulty: string;
}

interface TipData {
  drink: string;
  side: string;
  tip: string;
}

const tipsEN: Record<string, TipData> = {
  vegan: {
    drink: 'Green detox juice or iced hibiscus tea',
    side: 'Leafy salad with citrus vinaigrette',
    tip: 'Fresh herbs like basil and cilantro elevate the flavor naturally',
  },
  lowCarb: {
    drink: 'Sparkling water with lemon or unsweetened iced tea',
    side: 'Mixed greens with olive oil and seeds',
    tip: 'Extra virgin olive oil is your best friend for healthy fats',
  },
  highProtein: {
    drink: 'Coconut water or a fresh fruit smoothie',
    side: 'Brown rice, quinoa, or roasted sweet potato',
    tip: 'Pair with complex carbs for better nutrient absorption',
  },
  glutenFree: {
    drink: 'Fresh fruit juice or kombucha',
    side: 'Roasted sweet potato or cassava',
    tip: 'Almond flour and rice flour are great substitutes for baking',
  },
  vegetarian: {
    drink: 'Light white wine or mint lemonade',
    side: 'Herb focaccia or a warm soup',
    tip: 'Smoked tofu or chickpeas add extra satiety and protein',
  },
};

const tipsPT: Record<string, TipData> = {
  vegan: {
    drink: 'Suco verde detox ou cha de hibisco gelado',
    side: 'Salada de folhas com vinagrete citrico',
    tip: 'Ervas frescas como manjericao e coentro realcam o sabor',
  },
  lowCarb: {
    drink: 'Agua com gas e limao ou cha gelado sem acucar',
    side: 'Mix de folhas verdes com azeite e sementes',
    tip: 'Azeite extra virgem e gordura saudavel ideal para essa dieta',
  },
  highProtein: {
    drink: 'Agua de coco ou smoothie de frutas',
    side: 'Arroz integral, quinoa ou batata doce assada',
    tip: 'Combine com carboidratos complexos para melhor absorcao',
  },
  glutenFree: {
    drink: 'Suco natural de frutas ou kombucha',
    side: 'Batata doce assada ou mandioca',
    tip: 'Farinha de amendoas ou de arroz substituem bem na cozinha',
  },
  vegetarian: {
    drink: 'Vinho branco leve ou limonada com hortela',
    side: 'Focaccia com ervas ou uma sopa quente',
    tip: 'Tofu defumado ou grao-de-bico dao saciedade e proteina extra',
  },
};

const defaultEN: TipData = {
  drink: 'Fresh lemonade or sparkling water with herbs',
  side: 'A light seasonal salad',
  tip: 'Taste and adjust seasoning before serving for the best result',
};

const defaultPT: TipData = {
  drink: 'Limonada fresca ou agua com gas e ervas',
  side: 'Uma salada leve da estacao',
  tip: 'Prove e ajuste os temperos antes de servir para o melhor resultado',
};

function normalizeCategory(category: string): string {
  const map: Record<string, string> = {
    vegan: 'vegan',
    lowcarb: 'lowCarb',
    'low carb': 'lowCarb',
    highprotein: 'highProtein',
    'high protein': 'highProtein',
    glutenfree: 'glutenFree',
    'gluten free': 'glutenFree',
    vegetarian: 'vegetarian',
  };
  return map[category.toLowerCase().replace(/\s+/g, '')] || category;
}

export function RecipeTips({ category, difficulty }: RecipeTipsProps) {
  const t = useTranslation();
  const { language } = useSettingsStore();
  const isEN = language === 'en';

  const normalized = normalizeCategory(category);
  const tipsMap = isEN ? tipsEN : tipsPT;
  const fallback = isEN ? defaultEN : defaultPT;
  const tips = tipsMap[normalized] || fallback;

  const items = [
    {
      icon: Wine,
      label: t.recipe.pairingDrink,
      text: tips.drink,
      color: 'text-rose-500 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-100 dark:border-rose-800/30',
    },
    {
      icon: Salad,
      label: t.recipe.pairingSide,
      text: tips.side,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-100 dark:border-emerald-800/30',
    },
    {
      icon: Lightbulb,
      label: t.recipe.chefTip,
      text: tips.tip,
      color: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-100 dark:border-amber-800/30',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30">
          <Lightbulb className="w-4 h-4 text-amber-500 dark:text-amber-400" />
        </div>
        {t.recipe.tipsAndPairings}
      </h3>

      <div className="space-y-3">
        {items.map(({ icon: Icon, label, text, color, bg, border }) => (
          <div
            key={label}
            className={`flex items-start gap-3 rounded-lg ${bg} border ${border} p-3`}
          >
            <div className={`flex-shrink-0 mt-0.5 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                {label}
              </span>
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                {text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
