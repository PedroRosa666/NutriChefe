import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, BookOpen, ChevronRight, Clock, MapPin, Search, ShieldCheck, Star, Stethoscope, User, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { getSpecializationTranslation } from '../lib/i18n/translations';
import { normalizeText } from '../../supabase/functions/_shared/recipe-search';
import { useSettingsStore } from '../store/settings';
import { SMOOTH } from '../lib/motion';

interface NutritionistProfile {
  id: string;
  full_name: string;
  professional_bio: string;
  specializations: string[];
  years_of_experience: number;
  consultation_price: number;
  clinic_address: string;
  accepting_new_clients: boolean;
  crn: string | null;
  featured: boolean;
  published_recipes_count: number;
  average_rating: number;
  avatar_url?: string | null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-3">
        <div className="h-16 w-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
      <div className="mt-4 h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

export function NutritionistsPage() {
  const [nutritionists, setNutritionists] = useState<NutritionistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyAccepting, setOnlyAccepting] = useState(false);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const navigate = useNavigate();
  const t = useTranslation();
  const n = t.nutritionists;
  const { language } = useSettingsStore();
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const money = (v: number) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      // Uma consulta só: perfis + receitas + notas. Os nutricionistas Premium aparecem primeiro, com o selo Destaque.
      const proIds = new Set(((await supabase.rpc('pro_nutritionist_ids')).data as string[] | null) ?? []);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, professional_bio, specializations, years_of_experience, consultation_price, clinic_address, accepting_new_clients, crn_region, crn_number, recipes!recipes_author_id_fkey(id, reviews(rating))')
        .eq('user_type', 'Nutritionist')
        .eq('profile_visibility', 'public')
        .eq('crn_status', 'approved')
        .order('years_of_experience', { ascending: false });

      if (error) throw error;

      setNutritionists(
        (profiles ?? [])
          .map((profile) => {
            const authorRecipes: Array<{ reviews: { rating: number }[] | null }> = profile.recipes ?? [];
            const ratings = authorRecipes.flatMap((r) => (r.reviews ?? []).map((rv) => rv.rating));
            return {
              id: profile.id,
              full_name: profile.full_name || 'Nutricionista',
              professional_bio: profile.professional_bio || '',
              specializations: profile.specializations || [],
              years_of_experience: profile.years_of_experience || 0,
              consultation_price: Number(profile.consultation_price) || 0,
              clinic_address: profile.clinic_address || '',
              accepting_new_clients: profile.accepting_new_clients ?? true,
              crn: profile.crn_number ? `CRN-${profile.crn_region} ${profile.crn_number}` : null,
              featured: proIds.has(profile.id),
              published_recipes_count: authorRecipes.length,
              average_rating: ratings.length ? ratings.reduce((sum, x) => sum + x, 0) / ratings.length : 0,
              avatar_url: profile.avatar_url || null,
            };
          })
          .sort((a, b) => Number(b.featured) - Number(a.featured))
      );
    } catch (error) {
      console.error('Error loading nutritionists:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Especialidades presentes na lista (as mais comuns primeiro), para filtrar com um toque.
  const specialties = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of nutritionists) for (const s of p.specializations) count.set(s, (count.get(s) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  }, [nutritionists]);

  const visible = useMemo(() => {
    const q = normalizeText(query.trim());
    return nutritionists.filter((p) => {
      if (onlyAccepting && !p.accepting_new_clients) return false;
      if (specialty && !p.specializations.includes(specialty)) return false;
      if (!q) return true;
      const haystack = normalizeText(
        [p.full_name, p.professional_bio, p.clinic_address, ...p.specializations.map((s) => getSpecializationTranslation(s, language))].join(' ')
      );
      return haystack.includes(q);
    });
  }, [nutritionists, query, onlyAccepting, specialty, language]);

  const filtering = !!query.trim() || onlyAccepting || !!specialty;
  const clearFilters = () => {
    setQuery('');
    setOnlyAccepting(false);
    setSpecialty(null);
  };

  const chip = (active: boolean) =>
    cn(
      'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'border-emerald-600 bg-emerald-600 text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* Espaço à direita para o sino flutuante */}
        <div className="flex h-11 items-center pr-14">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.common.back}
          </button>
        </div>

        {/* Apresentação */}
        <section className="relative mt-2 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 px-5 py-7 text-white shadow-lg shadow-emerald-900/10 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-white/10" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            <ShieldCheck className="h-3.5 w-3.5" />
            {n.listBadge}
          </span>
          <h1 className="relative mt-3 text-2xl font-bold leading-tight sm:text-4xl">{n.title}</h1>
          <p className="relative mt-2 max-w-xl text-sm text-emerald-50 sm:text-base">{n.subtitle}</p>

          <label className="relative mt-5 block max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={n.searchPlaceholder}
              className="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none ring-emerald-300 placeholder:text-slate-400 focus:ring-2 dark:bg-slate-900 dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={n.clearFilters}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </section>

        {/* Filtros */}
        {nutritionists.length > 0 && (
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <button type="button" onClick={() => setOnlyAccepting((v) => !v)} className={chip(onlyAccepting)}>
              {n.onlyAccepting}
            </button>
            {specialties.map((s) => (
              <button key={s} type="button" onClick={() => setSpecialty((cur) => (cur === s ? null : s))} className={chip(specialty === s)}>
                {getSpecializationTranslation(s, language)}
              </button>
            ))}
          </div>
        )}

        {!loading && !failed && nutritionists.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{visible.length === 1 ? n.countOne : n.count.replace('{n}', String(visible.length))}</span>
            {filtering && (
              <button type="button" onClick={clearFilters} className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
                {n.clearFilters}
              </button>
            )}
          </div>
        )}

        <div className="mt-3">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : failed ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-300">{n.loadError}</p>
              <button type="button" onClick={load} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                {t.common.retry}
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
              <Stethoscope className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">{nutritionists.length ? n.noResults : n.noNutritionists}</p>
              {filtering && (
                <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {n.clearFilters}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SMOOTH, delay: Math.min(i, 8) * 0.04 }}
                >
                  <Link
                    to={`/nutricionista/${p.id}`}
                    className={cn(
                      'group flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900',
                      p.featured
                        ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-500/50 dark:ring-amber-500/20'
                        : 'border-slate-100 hover:border-emerald-300 dark:border-slate-800 dark:hover:border-emerald-500/40'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-lg font-bold text-white">
                          {initials(p.full_name) || <User className="h-7 w-7" />}
                          {/* A foto cobre as iniciais; se não carregar, some e as iniciais aparecem. */}
                          {p.avatar_url && (
                            <img
                              src={p.avatar_url}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900',
                            p.accepting_new_clients ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                          )}
                          title={p.accepting_new_clients ? n.acceptingClients : n.notAcceptingClients}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 dark:text-white">{p.full_name}</h3>
                          {p.featured && (
                            <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                              <Star className="h-3 w-3 fill-current" />
                              {t.nutritionistPremium.featured}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{p.crn ?? t.verification.verified}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {p.years_of_experience > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {n.yearsShort.replace('{n}', String(p.years_of_experience))}
                            </span>
                          )}
                          {p.average_rating > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {p.average_rating.toFixed(1)}
                            </span>
                          )}
                          {p.published_recipes_count > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              {(p.published_recipes_count === 1 ? n.recipesOne : n.recipesCount).replace('{n}', String(p.published_recipes_count))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {p.specializations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.specializations.slice(0, 3).map((spec) => (
                          <span key={spec} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            {getSpecializationTranslation(spec, language)}
                          </span>
                        ))}
                        {p.specializations.length > 3 && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            +{p.specializations.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p.professional_bio || n.noBio}</p>

                    {p.clinic_address && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{p.clinic_address}</span>
                      </p>
                    )}

                    {/* Empurra o rodapé para baixo: cartões da mesma linha ficam alinhados. */}
                    <div className="flex-1" />
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div>
                        {p.consultation_price > 0 ? (
                          <>
                            <p className="text-base font-bold text-slate-900 dark:text-white">{money(p.consultation_price)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{n.perConsultation}</p>
                          </>
                        ) : (
                          <p className={cn('text-xs font-medium', p.accepting_new_clients ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500')}>
                            {p.accepting_new_clients ? n.acceptingClients : n.notAcceptingClients}
                          </p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-500/10 dark:text-emerald-300">
                        {n.viewProfile}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
