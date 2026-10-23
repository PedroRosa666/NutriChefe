import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Globe,
  GraduationCap,
  Lightbulb,
  Instagram,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  Stethoscope,
  User,
  Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fromJson, supabase } from '../lib/supabase';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { PUBLIC_PROFILE_COLUMNS } from '../lib/profile-columns';
import { instagramUrl, phoneUrl, safeWebsiteUrl, whatsappUrl } from '../lib/contact-links';
import { getSpecializationTranslation } from '../lib/i18n/translations';
import { useSettingsStore } from '../store/settings';
import { useAuthStore } from '../store/auth';
import { SMOOTH } from '../lib/motion';
import { RECIPE_PLACEHOLDER } from '../components/RecipeCard';

interface RecipePreview {
  id: string;
  title: string;
  image: string | null;
  calories: number | null;
  prepTime: number | null;
}

interface NutritionistFullProfile {
  id: string;
  full_name: string;
  crn: string | null;
  professional_bio: string;
  specializations: string[];
  years_of_experience: number;
  education: string;
  certifications: string[];
  approach: string;
  consultation_price: number;
  consultation_duration: number;
  consultation_types: Array<{ type: string; price: number }>;
  accepts_health_insurance: boolean;
  health_insurances: string[];
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  clinic_address: string;
  accepting_new_clients: boolean;
  avatar_url?: string | null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const cardClass = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

function Section({ icon: Icon, title, children, className }: { icon: typeof User; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn(cardClass, className)}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <span className="inline-flex rounded-lg bg-emerald-50 p-1.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className={cn(cardClass, 'p-0')}>
        <div className="h-28 rounded-t-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3 p-5">
          <div className="-mt-16 h-24 w-24 rounded-2xl border-4 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-700" />
          <div className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
      <div className={cn(cardClass, 'h-32')} />
    </div>
  );
}

export function NutritionistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useTranslation();
  const n = t.nutritionists;
  const pg = n.page;
  const { language } = useSettingsStore();
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const money = (v: number) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0 });
  const [profile, setProfile] = useState<NutritionistFullProfile | null>(null);
  const [recipes, setRecipes] = useState<RecipePreview[]>([]);
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [featured, setFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  // O próprio nutricionista vê a página mesmo privada ou antes do CRN aprovado (como pré-visualização).
  const isOwner = useAuthStore((s) => s.user?.id) === id;
  const [preview, setPreview] = useState<'private' | 'pending' | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const query = supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', id).eq('user_type', 'Nutritionist');
        const [{ data: profileData }, pro] = await Promise.all([
          (isOwner ? query : query.eq('profile_visibility', 'public')).maybeSingle(),
          supabase.rpc('pro_nutritionist_ids'),
        ]);

        if (cancelled) return;
        if (!profileData) {
          navigate('/nutricionistas');
          return;
        }

        setFeatured(((pro.data as string[] | null) ?? []).includes(id));
        setPreview(
          !isOwner ? null : profileData.profile_visibility === 'private' ? 'private' : profileData.crn_status !== 'approved' ? 'pending' : null
        );
        setProfile({
          id: profileData.id,
          full_name: profileData.full_name || 'Nutricionista',
          crn: profileData.crn_status === 'approved' && profileData.crn_number ? `CRN-${profileData.crn_region} ${profileData.crn_number}` : null,
          professional_bio: profileData.professional_bio || '',
          specializations: profileData.specializations || [],
          years_of_experience: profileData.years_of_experience || 0,
          education: profileData.education || '',
          certifications: profileData.certifications || [],
          approach: profileData.approach || '',
          consultation_price: Number(profileData.consultation_price) || 0,
          consultation_duration: profileData.consultation_duration || 60,
          consultation_types: fromJson<Array<{ type: string; price: number }>>(profileData.consultation_types) || [],
          accepts_health_insurance: profileData.accepts_health_insurance || false,
          health_insurances: profileData.health_insurances || [],
          phone: profileData.phone || '',
          whatsapp: profileData.whatsapp || '',
          instagram: profileData.instagram || '',
          website: profileData.website || '',
          clinic_address: profileData.clinic_address || '',
          accepting_new_clients: profileData.accepting_new_clients ?? true,
          avatar_url: profileData.avatar_url || null,
        });

        // Receitas do autor (para a contagem, a nota média e a vitrine).
        const { data: recipesData } = await supabase
          .from('recipes')
          .select('id, title, image, prep_time, nutrition_facts, reviews(rating)')
          .eq('author_id', id)
          .order('created_at', { ascending: false });

        if (cancelled || !recipesData) return;

        setRecipes(
          recipesData.map((r) => ({
            id: r.id,
            title: r.title,
            image: r.image,
            prepTime: r.prep_time ?? null,
            calories: Number((r.nutrition_facts as { calories?: number } | null)?.calories) || null,
          }))
        );
        const ratings = recipesData.flatMap((r) => (r.reviews ?? []).map((rv) => rv.rating));
        setAverageRating(ratings.length ? ratings.reduce((sum, x) => sum + x, 0) / ratings.length : 0);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, isOwner]);

  const backBar = (
    <div className="flex h-11 items-center pr-14">
      <button
        onClick={() => navigate(isOwner ? '/perfil' : '/nutricionistas')}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {isOwner ? t.common.back : pg.backToList}
      </button>
    </div>
  );

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {backBar}
        <div className="mt-2">{loading && <ProfileSkeleton />}</div>
      </div>
    );
  }

  const firstName = profile.full_name.split(' ')[0];
  const links = {
    whatsapp: whatsappUrl(profile.whatsapp, `Olá, ${profile.full_name}! Vi seu perfil no NutriChef e gostaria de agendar uma consulta.`),
    phone: phoneUrl(profile.phone),
    instagram: instagramUrl(profile.instagram),
    website: safeWebsiteUrl(profile.website),
  };
  const mapUrl = profile.clinic_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.clinic_address)}` : null;
  const hasContact = !!(links.whatsapp || links.phone || links.instagram || links.website || profile.clinic_address);
  const shownRecipes = showAllRecipes ? recipes : recipes.slice(0, 6);

  const stats = [
    profile.years_of_experience > 0 && { icon: Clock, value: String(profile.years_of_experience), label: pg.years },
    averageRating > 0 && { icon: Star, value: averageRating.toFixed(1), label: pg.rating },
    recipes.length > 0 && { icon: BookOpen, value: String(recipes.length), label: pg.recipes },
  ].filter(Boolean) as { icon: typeof Clock; value: string; label: string }[];

  const contactRow = (href: string, icon: typeof Phone, label: string, value: string, tone: string, external = true) => {
    const Icon = icon;
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5"
      >
        <span className={cn('inline-flex flex-shrink-0 rounded-lg p-2', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span>
          <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{value}</span>
        </span>
      </a>
    );
  };

  const consultationCard = (profile.consultation_price > 0 || profile.consultation_types.length > 0 || profile.health_insurances.length > 0) && (
    <Section icon={Wallet} title={pg.consultation}>
      <div className="grid grid-cols-2 gap-2">
        {profile.consultation_price > 0 && (
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">{pg.price}</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{money(profile.consultation_price)}</p>
          </div>
        )}
        {profile.consultation_duration > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">{pg.duration}</p>
            <p className="flex items-center gap-1 text-xl font-bold text-slate-900 dark:text-white">
              <CalendarClock className="h-4 w-4 text-slate-400" />
              {pg.minutes.replace('{n}', String(profile.consultation_duration))}
            </p>
          </div>
        )}
      </div>

      {profile.consultation_types.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{pg.types}</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {profile.consultation_types.map((ct, idx) => (
              <li key={idx} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{ct.type}</span>
                {Number(ct.price) > 0 && <span className="font-semibold text-slate-900 dark:text-white">{money(Number(ct.price))}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.accepts_health_insurance && profile.health_insurances.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {pg.insurance}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.health_insurances.map((insurance, idx) => (
              <span key={idx} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {insurance}
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  );

  const contactCard = (
    <Section icon={MessageCircle} title={pg.contact}>
      {!hasContact ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{pg.noContact}</p>
      ) : (
        <div className="space-y-2">
          {links.whatsapp && contactRow(links.whatsapp, MessageCircle, 'WhatsApp', profile.whatsapp, 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400')}
          {links.phone && contactRow(links.phone, Phone, n.profile.phone, profile.phone, 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400', false)}
          {links.instagram && contactRow(links.instagram, Instagram, 'Instagram', profile.instagram, 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400')}
          {links.website && contactRow(links.website, Globe, pg.site, profile.website, 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400')}
          {profile.clinic_address && (
            <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <span className="inline-flex flex-shrink-0 rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{pg.address}</span>
                  <span className="block text-sm font-medium text-slate-900 dark:text-white">{profile.clinic_address}</span>
                </span>
              </div>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  {pg.openMap}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {backBar}

        {isOwner && (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100">
            <p className="min-w-0 flex-1">{preview === 'private' ? t.profileUi.previewPrivate : preview === 'pending' ? t.profileUi.previewPending : t.profileUi.previewLive}</p>
            <Link to="/perfil?tab=professional" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
              {t.profileUi.editProfessional}
            </Link>
          </div>
        )}

        {/* Cartão principal */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SMOOTH}
          className={cn(
            'mt-2 overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-slate-900',
            featured ? 'border-amber-300 dark:border-amber-500/50' : 'border-slate-100 dark:border-slate-800'
          )}
        >
          <div className="relative h-28 overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 sm:h-36">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-14 left-1/3 h-28 w-28 rounded-full bg-white/10" />
            {featured && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-amber-950 shadow">
                <Star className="h-3 w-3 fill-current" />
                {t.nutritionistPremium.featured}
              </span>
            )}
          </div>

          <div className="px-5 pb-5 sm:px-7 sm:pb-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative -mt-12 flex-shrink-0 sm:-mt-14">
                  <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-emerald-400 to-teal-600 text-2xl font-bold text-white shadow-md dark:border-slate-900 sm:h-28 sm:w-28">
                    {initials(profile.full_name) || <User className="h-10 w-10" />}
                    {profile.avatar_url && (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="text-xl font-bold leading-tight text-slate-900 dark:text-white sm:text-2xl">{profile.full_name}</h1>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <BadgeCheck className="h-4 w-4 flex-shrink-0" />
                    {profile.crn ?? t.verification.verified}
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  'inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-semibold sm:self-auto',
                  profile.accepting_new_clients
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', profile.accepting_new_clients ? 'bg-emerald-500' : 'bg-slate-400')} />
                {profile.accepting_new_clients ? n.acceptingClients : n.notAcceptingClients}
              </span>
            </div>

            {stats.length > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
                {stats.map(({ icon: Icon, value, label }) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5 text-center dark:bg-slate-800/60">
                    <p className="flex items-center justify-center gap-1 text-lg font-bold text-slate-900 dark:text-white">
                      <Icon className={cn('h-4 w-4', Icon === Star ? 'fill-amber-400 text-amber-400' : 'text-emerald-600 dark:text-emerald-400')} />
                      {value}
                    </p>
                    <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {profile.specializations.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.specializations.map((spec) => (
                  <span key={spec} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {getSpecializationTranslation(spec, language)}
                  </span>
                ))}
              </div>
            )}

            {/* Ações */}
            {(links.whatsapp || links.phone || links.instagram) && (
              <div className="mt-5 flex gap-2">
                {links.whatsapp && profile.accepting_new_clients && (
                  <a
                    href={links.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 sm:flex-none"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {pg.whatsappCta}
                  </a>
                )}
                {links.phone && (
                  <a
                    href={links.phone}
                    aria-label={pg.call}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:px-4 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Phone className="h-4 w-4" />
                    {/* No celular só o ícone, para o botão do WhatsApp caber numa linha. */}
                    <span className="hidden sm:inline">{pg.call}</span>
                  </a>
                )}
                {links.instagram && (
                  <a
                    href={links.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3.5 py-3 text-pink-600 transition-colors hover:bg-pink-50 dark:border-slate-700 dark:text-pink-400 dark:hover:bg-pink-500/10"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
            {/* O vínculo no app é por código: quem já marcou consulta sabe o que pedir. */}
            {!isOwner && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t.profileUi.alreadyPatient}</p>
            )}
          </div>
        </motion.section>

        {/* Conteúdo: no computador, consulta e contato ficam na lateral */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {profile.professional_bio && (
              <Section icon={User} title={pg.about}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{profile.professional_bio}</p>
              </Section>
            )}

            {profile.approach && (
              <Section icon={Lightbulb} title={pg.approach}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{profile.approach}</p>
              </Section>
            )}

            {(profile.education || profile.certifications.length > 0) && (
              <Section icon={GraduationCap} title={pg.education}>
                {profile.education && <p className="text-sm text-slate-600 dark:text-slate-300">{profile.education}</p>}
                {profile.certifications.length > 0 && (
                  <ul className={cn('space-y-2', profile.education && 'mt-3')}>
                    {profile.certifications.map((cert, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {/* No celular, consulta e contato vêm antes das receitas */}
            <div className="space-y-4 lg:hidden">
              {consultationCard}
              {contactCard}
            </div>

            {recipes.length > 0 && (
              <Section icon={BookOpen} title={pg.recipesTitle.replace('{name}', firstName)}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shownRecipes.map((recipe) => (
                    <Link
                      key={recipe.id}
                      to={`/receita/${recipe.id}`}
                      className="group overflow-hidden rounded-xl border border-slate-100 transition-shadow hover:shadow-md dark:border-slate-800"
                    >
                      <div className="overflow-hidden">
                        <img
                          src={recipe.image || RECIPE_PLACEHOLDER}
                          alt=""
                          loading="lazy"
                          className="h-24 w-full bg-emerald-50 object-cover transition-transform duration-300 group-hover:scale-105 dark:bg-slate-800 sm:h-28"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.endsWith(RECIPE_PLACEHOLDER)) target.src = RECIPE_PLACEHOLDER;
                          }}
                        />
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900 dark:text-white">{recipe.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {[recipe.prepTime ? `${recipe.prepTime} min` : null, recipe.calories ? `${Math.round(recipe.calories)} kcal` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                {recipes.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRecipes((v) => !v)}
                    className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    {showAllRecipes ? t.clientPremium.showLess : `${pg.seeAll} (${recipes.length})`}
                  </button>
                )}
              </Section>
            )}

            {!profile.professional_bio && !profile.approach && !profile.education && recipes.length === 0 && (
              <div className={cn(cardClass, 'flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400')}>
                <Stethoscope className="h-5 w-5 text-emerald-500" />
                {n.noBio}
              </div>
            )}
          </div>

          <aside className="hidden space-y-4 lg:block">
            <div className="sticky top-6 space-y-4">
              {consultationCard}
              {contactCard}
              {profile.crn && (
                <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {t.verification.verified} · {profile.crn}
                  </span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
