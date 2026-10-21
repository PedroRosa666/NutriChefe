import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, CalendarRange, Leaf, Stethoscope } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { EASE_OUT } from '../../lib/motion';

/** Apresentação para quem ainda não tem conta. */
export function LandingHero() {
  const t = useTranslation();
  const points = [
    { icon: Leaf, text: t.landing.point1 },
    { icon: CalendarRange, text: t.landing.point2 },
    { icon: Stethoscope, text: t.landing.point3 },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="relative mb-10 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-10 shadow-sm sm:px-10 sm:py-14 dark:border-emerald-900/40 dark:from-emerald-900/30 dark:via-slate-900/60 dark:to-teal-900/20"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-teal-200/40 blur-3xl dark:bg-teal-500/10" />

      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
          <Leaf className="h-3.5 w-3.5" />
          {t.landing.badge}
        </span>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">{t.landing.title}</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">{t.landing.subtitle}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/login?modo=cadastro"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            {t.landing.ctaStart}
          </Link>
          <Link
            to="/mentoria-ia"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold text-slate-800 backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
          >
            <Bot className="h-4 w-4 text-emerald-600" />
            {t.landing.ctaAi}
          </Link>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800">
                <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}

/** Cartão vazio animado enquanto as receitas carregam (no formato do RecipeCard). */
export function RecipeCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden rounded-xl border" aria-hidden>
      <div className="h-48 animate-pulse bg-slate-200/70 dark:bg-slate-700/40" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/50" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-200/60 dark:bg-slate-700/40" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/60 dark:bg-slate-700/40" />
        <div className="flex gap-3 pt-2">
          <div className="h-4 w-14 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/40" />
          <div className="h-4 w-14 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/40" />
        </div>
      </div>
    </div>
  );
}
