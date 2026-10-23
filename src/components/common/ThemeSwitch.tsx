import { Sun, Moon } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

/** Tema em claro ou escuro. Um botão só: o ícone mostra para qual modo o toque leva. */
export function ThemeSwitch() {
  const { theme, setTheme } = useSettingsStore();
  const t = useTranslation();
  const isDark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'));

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
      title={t.profileUi.toggleTheme}
      aria-label={t.profileUi.toggleTheme}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

/** Tema e idioma no menu do celular: escolhas lado a lado, sem abrir outro menu. */
export function AppearanceSettings() {
  const { theme, setTheme, language, setLanguage } = useSettingsStore();
  const u = useTranslation().profileUi;
  const isDark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'));
  const segment = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'
    );

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{u.appearance}</p>
      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
        <button type="button" onClick={() => setTheme('light')} className={segment(!isDark)} aria-pressed={!isDark}>
          <Sun className="h-4 w-4" />
          {u.light}
        </button>
        <button type="button" onClick={() => setTheme('dark')} className={segment(isDark)} aria-pressed={isDark}>
          <Moon className="h-4 w-4" />
          {u.dark}
        </button>
      </div>
      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900" role="group" aria-label={u.language}>
        <button type="button" onClick={() => setLanguage('pt')} className={segment(language === 'pt')} aria-pressed={language === 'pt'}>
          Português
        </button>
        <button type="button" onClick={() => setLanguage('en')} className={segment(language === 'en')} aria-pressed={language === 'en'}>
          English
        </button>
      </div>
    </div>
  );
}
