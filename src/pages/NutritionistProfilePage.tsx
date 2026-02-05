import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Star,
  Clock,
  MapPin,
  Phone,
  Globe,
  Instagram,
  MessageCircle,
  GraduationCap,
  Award,
  Heart,
  CheckCircle,
  XCircle,
  ArrowLeft,
  DollarSign,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import type { Recipe } from '../types/recipe';
import { getSpecializationTranslation } from '../lib/i18n/translations';
import { useSettingsStore } from '../store/settings';

interface NutritionistFullProfile {
  id: string;
  full_name: string;
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

export function NutritionistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useTranslation();
  const { language } = useSettingsStore();
  const [profile, setProfile] = useState<NutritionistFullProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  const loadProfile = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('user_type', 'Nutritionist')
        .eq('profile_visibility', 'public')
        .maybeSingle();

      if (!profileData) {
        navigate('/nutricionistas');
        return;
      }

      setProfile({
        id: profileData.id,
        full_name: profileData.full_name || 'Nutricionista',
        professional_bio: profileData.professional_bio || '',
        specializations: profileData.specializations || [],
        years_of_experience: profileData.years_of_experience || 0,
        education: profileData.education || '',
        certifications: profileData.certifications || [],
        approach: profileData.approach || '',
        consultation_price: profileData.consultation_price || 0,
        consultation_duration: profileData.consultation_duration || 60,
        consultation_types: profileData.consultation_types || [],
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

      const { data: recipesData } = await supabase
        .from('recipes')
        .select('*')
        .eq('author_id', id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (recipesData) {
        setRecipes(recipesData);

        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .in('recipe_id', recipesData.map(r => r.id));

        if (reviews && reviews.length > 0) {
          const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          setAverageRating(avg);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-48"></div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 pb-12">
        <button
          onClick={() => navigate('/nutricionistas')}
          className="mb-4 flex items-center gap-2 text-white hover:text-emerald-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          {t.common.back}
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start mb-8">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg overflow-hidden">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-16 w-16 text-white" />
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {profile.full_name}
                    </h1>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {profile.years_of_experience > 0 && (
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {profile.years_of_experience} {t.nutritionists.profile.experience}
                          </span>
                        </div>
                      )}
                      {averageRating > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {averageRating.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {recipes.length > 0 && (
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Heart className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {recipes.length} {t.nutritionists.profile.publishedRecipes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold",
                    profile.accepting_new_clients
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  )}>
                    {profile.accepting_new_clients ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        {t.nutritionists.acceptingClients}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        {t.nutritionists.notAcceptingClients}
                      </>
                    )}
                  </div>
                </div>

                {profile.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {profile.specializations.map((spec, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-full"
                      >
                        {getSpecializationTranslation(spec, language)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {profile.professional_bio && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    {t.nutritionists.profile.about}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {profile.professional_bio}
                  </p>
                </div>
              )}

              {profile.education && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    {t.nutritionists.profile.education}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">{profile.education}</p>
                </div>
              )}

              {profile.certifications.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    {t.nutritionists.profile.certifications}
                  </h2>
                  <ul className="space-y-2">
                    {profile.certifications.map((cert, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        {cert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.approach && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {t.nutritionists.profile.approach}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {profile.approach}
                  </p>
                </div>
              )}

              {profile.consultation_price > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    {t.nutritionists.profile.consultationInfo}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {t.nutritionists.profile.price}
                      </p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        R$ {profile.consultation_price.toFixed(2)}
                      </p>
                    </div>
                    {profile.consultation_duration > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {t.nutritionists.profile.duration}
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {profile.consultation_duration} {t.nutritionists.profile.minutes}
                        </p>
                      </div>
                    )}
                  </div>

                  {profile.consultation_types.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t.nutritionists.profile.consultationTypes}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.consultation_types.map((ct: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-900 dark:text-white"
                          >
                            {ct.type}: R$ {ct.price}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.accepts_health_insurance && profile.health_insurances.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t.nutritionists.profile.acceptsInsurance}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.health_insurances.map((insurance, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-white dark:bg-gray-800 rounded-lg text-sm text-gray-900 dark:text-white"
                          >
                            {insurance}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {t.nutritionists.profile.contactInfo}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.whatsapp && (
                    <a
                      href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">WhatsApp</p>
                        <p className="font-medium text-gray-900 dark:text-white">{profile.whatsapp}</p>
                      </div>
                    </a>
                  )}

                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.nutritionists.profile.phone}</p>
                        <p className="font-medium text-gray-900 dark:text-white">{profile.phone}</p>
                      </div>
                    </a>
                  )}

                  {profile.instagram && (
                    <a
                      href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-pink-50 dark:bg-pink-900/20 rounded-xl hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors"
                    >
                      <Instagram className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Instagram</p>
                        <p className="font-medium text-gray-900 dark:text-white">{profile.instagram}</p>
                      </div>
                    </a>
                  )}

                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.nutritionists.profile.website}</p>
                        <p className="font-medium text-gray-900 dark:text-white truncate">{profile.website}</p>
                      </div>
                    </a>
                  )}

                  {profile.clinic_address && (
                    <div className="md:col-span-2 flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <MapPin className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t.nutritionists.profile.address}
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">{profile.clinic_address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {recipes.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    {t.nutritionists.profile.publishedRecipes}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        onClick={() => navigate(`/receita/${recipe.id}`)}
                        className="cursor-pointer group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all"
                      >
                        <img
                          src={recipe.image}
                          alt={recipe.title}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-3">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
                            {recipe.title}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
