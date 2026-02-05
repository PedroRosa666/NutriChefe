import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Star, MapPin, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { getSpecializationTranslation } from '../lib/i18n/translations';
import { useSettingsStore } from '../store/settings';

interface NutritionistProfile {
  id: string;
  full_name: string;
  professional_bio: string;
  specializations: string[];
  years_of_experience: number;
  consultation_price: number;
  clinic_address: string;
  accepting_new_clients: boolean;
  published_recipes_count: number;
  average_rating: number;
}

export function NutritionistsPage() {
  const [nutritionists, setNutritionists] = useState<NutritionistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const t = useTranslation();
  const { language } = useSettingsStore();

  useEffect(() => {
    loadNutritionists();
  }, []);

  const loadNutritionists = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'Nutritionist')
        .eq('profile_visibility', 'public')
        .order('years_of_experience', { ascending: false });

      if (!profiles) {
        setNutritionists([]);
        setLoading(false);
        return;
      }

      const nutritionistsData = await Promise.all(
        profiles.map(async (profile) => {
          const { count: recipesCount } = await supabase
            .from('recipes')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', profile.id);

          const { data: reviews } = await supabase
            .from('reviews')
            .select('rating')
            .in('recipe_id',
              await supabase
                .from('recipes')
                .select('id')
                .eq('author_id', profile.id)
                .then(res => res.data?.map(r => r.id) || [])
            );

          const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

          return {
            id: profile.id,
            full_name: profile.full_name || 'Nutricionista',
            professional_bio: profile.professional_bio || '',
            specializations: profile.specializations || [],
            years_of_experience: profile.years_of_experience || 0,
            consultation_price: profile.consultation_price || 0,
            clinic_address: profile.clinic_address || '',
            accepting_new_clients: profile.accepting_new_clients ?? true,
            published_recipes_count: recipesCount || 0,
            average_rating: avgRating,
          };
        })
      );

      setNutritionists(nutritionistsData);
    } catch (error) {
      console.error('Error loading nutritionists:', error);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          {t.common.back}
        </button>

        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t.nutritionists.title}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {t.nutritionists.subtitle}
          </p>
        </div>

        {nutritionists.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t.nutritionists.noNutritionists}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nutritionists.map((nutritionist) => (
              <div
                key={nutritionist.id}
                onClick={() => navigate(`/nutricionista/${nutritionist.id}`)}
                className="group cursor-pointer bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-24"></div>

                <div className="p-6 -mt-12">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white dark:bg-gray-800 mx-auto mb-4 shadow-lg border-4 border-white dark:border-gray-800">
                    <User className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                    {nutritionist.full_name}
                  </h3>

                  <div className="flex items-center justify-center gap-4 mb-4">
                    {nutritionist.years_of_experience > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                        <Clock className="h-4 w-4" />
                        {nutritionist.years_of_experience} {language === 'pt' ? 'anos' : 'years'}
                      </div>
                    )}
                    {nutritionist.average_rating > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {nutritionist.average_rating.toFixed(1)}
                      </div>
                    )}
                  </div>

                  {nutritionist.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      {nutritionist.specializations.slice(0, 3).map((spec, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full"
                        >
                          {getSpecializationTranslation(spec, language)}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 dark:text-gray-300 text-center line-clamp-3 mb-4 min-h-[60px]">
                    {nutritionist.professional_bio || 'Profissional de nutrição'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                    {nutritionist.consultation_price > 0 && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.nutritionists.profile.price}</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          R$ {nutritionist.consultation_price.toFixed(2)}
                        </p>
                      </div>
                    )}

                    <div className={cn(
                      "flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full",
                      nutritionist.accepting_new_clients
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}>
                      {nutritionist.accepting_new_clients ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          {t.nutritionists.acceptingClients}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          {t.nutritionists.notAcceptingClients}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
