import { Sun, Moon } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import { useTranslation } from '../../hooks/useTranslation';

export function ThemeSwitch() {
  const { theme, setTheme } = useSettingsStore();
  const t = useTranslation();

  const themes = [
    { id: 'light', icon: Sun, label: t.common.theme.light },
    { id: 'dark', icon: Moon, label: t.common.theme.dark },
  ] as const;

  return (
    <div className="flex items-center gap-2">
      {themes.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className={`p-2 rounded-lg transition-colors ${
            theme === id
              ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}
          title={label}
        >
          <Icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}