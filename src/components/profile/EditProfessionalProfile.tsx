import React, { useState, useEffect } from 'react';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

const SPECIALIZATIONS_OPTIONS = [
  'sports',
  'clinical',
  'weightLoss',
  'womensHealth',
  'pediatric',
  'geriatric',
  'vegetarian',
  'diabetes',
  'cardiovascular',
  'gastrointestinal',
];

const normalizeSpecialization = (spec: string): string => {
  const specMap: Record<string, string> = {
    'sports': 'sports',
    'Sports Nutrition': 'sports',
    'Nutrição Esportiva': 'sports',
    'clinical': 'clinical',
    'Clinical Nutrition': 'clinical',
    'Nutrição Clínica': 'clinical',
    'weightLoss': 'weightLoss',
    'Weight Loss': 'weightLoss',
    'Emagrecimento': 'weightLoss',
    'womensHealth': 'womensHealth',
    'Women\'s Health': 'womensHealth',
    'Saúde da Mulher': 'womensHealth',
    'pediatric': 'pediatric',
    'Pediatric Nutrition': 'pediatric',
    'Nutrição Pediátrica': 'pediatric',
    'geriatric': 'geriatric',
    'Geriatric Nutrition': 'geriatric',
    'Nutrição Geriátrica': 'geriatric',
    'vegetarian': 'vegetarian',
    'Vegetarian/Vegan': 'vegetarian',
    'Vegetariano/Vegano': 'vegetarian',
    'diabetes': 'diabetes',
    'Diabetes Management': 'diabetes',
    'Controle de Diabetes': 'diabetes',
    'cardiovascular': 'cardiovascular',
    'Cardiovascular Health': 'cardiovascular',
    'Saúde Cardiovascular': 'cardiovascular',
    'gastrointestinal': 'gastrointestinal',
    'Gastrointestinal Health': 'gastrointestinal',
    'Saúde Gastrointestinal': 'gastrointestinal',
  };

  return specMap[spec] || spec;
};

export function EditProfessionalProfile() {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const t = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState({
    professional_bio: '',
    specializations: [] as string[],
    education: '',
    certifications: '',
    years_of_experience: 0,
    approach: '',
    consultation_price: 0,
    consultation_duration: 60,
    accepts_health_insurance: false,
    health_insurances: '',
    phone: '',
    whatsapp: '',
    instagram: '',
    website: '',
    clinic_address: '',
    profile_visibility: 'public',
    accepting_new_clients: true,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setFormData({
          professional_bio: data.professional_bio || '',
          specializations: (data.specializations || []).map(normalizeSpecialization),
          education: data.education || '',
          certifications: (data.certifications || []).join('\n'),
          years_of_experience: data.years_of_experience || 0,
          approach: data.approach || '',
          consultation_price: data.consultation_price || 0,
          consultation_duration: data.consultation_duration || 60,
          accepts_health_insurance: data.accepts_health_insurance || false,
          health_insurances: (data.health_insurances || []).join('\n'),
          phone: data.phone || '',
          whatsapp: data.whatsapp || '',
          instagram: data.instagram || '',
          website: data.website || '',
          clinic_address: data.clinic_address || '',
          profile_visibility: data.profile_visibility || 'public',
          accepting_new_clients: data.accepting_new_clients ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showToast('Erro ao carregar perfil', 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          professional_bio: formData.professional_bio,
          specializations: formData.specializations,
          education: formData.education,
          certifications: formData.certifications
            .split('\n')
            .map(c => c.trim())
            .filter(c => c),
          years_of_experience: formData.years_of_experience,
          approach: formData.approach,
          consultation_price: formData.consultation_price,
          consultation_duration: formData.consultation_duration,
          accepts_health_insurance: formData.accepts_health_insurance,
          health_insurances: formData.health_insurances
            .split('\n')
            .map(i => i.trim())
            .filter(i => i),
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          instagram: formData.instagram,
          website: formData.website,
          clinic_address: formData.clinic_address,
          profile_visibility: formData.profile_visibility,
          accepting_new_clients: formData.accepting_new_clients,
        })
        .eq('id', user.id);

      if (error) throw error;

      setHasChanges(false);
      showToast(t.nutritionists.editProfile.saved, 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast(t.nutritionists.editProfile.error, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialization = (spec: string) => {
    setFormData(prev => {
      const normalizedSpecs = prev.specializations.map(normalizeSpecialization);
      const hasSpec = normalizedSpecs.includes(spec);

      if (hasSpec) {
        return {
          ...prev,
          specializations: prev.specializations.filter(s => normalizeSpecialization(s) !== spec),
        };
      } else {
        return {
          ...prev,
          specializations: [...prev.specializations, spec],
        };
      }
    });

    setHasChanges(true);
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 relative">

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t.nutritionists.editProfile.professionalInfo}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.bio}
            </label>
            <textarea
              value={formData.professional_bio}
              onChange={(e) => handleFieldChange('professional_bio', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              placeholder={t.nutritionists.editProfile.fields.bioPlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.specializations}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SPECIALIZATIONS_OPTIONS.map((spec) => {
                const normalizedSpecs = formData.specializations.map(normalizeSpecialization);
                const isSelected = normalizedSpecs.includes(spec);

                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => toggleSpecialization(spec)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:border-gray-300"
                    )}
                  >
                    {t.nutritionists.specializations[spec as keyof typeof t.nutritionists.specializations]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.education}
            </label>
            <input
              type="text"
              value={formData.education}
              onChange={(e) => handleFieldChange('education', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              placeholder={t.nutritionists.editProfile.fields.educationPlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.certifications}
            </label>
            <textarea
              value={formData.certifications}
              onChange={(e) => handleFieldChange('certifications', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              placeholder={t.nutritionists.editProfile.fields.certificationsPlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.yearsOfExperience}
            </label>
            <input
              type="number"
              min="0"
              value={formData.years_of_experience}
              onChange={(e) => handleFieldChange('years_of_experience', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.approach}
            </label>
            <textarea
              value={formData.approach}
              onChange={(e) => handleFieldChange('approach', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              placeholder={t.nutritionists.editProfile.fields.approachPlaceholder}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t.nutritionists.editProfile.consultationSettings}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.nutritionists.editProfile.fields.consultationPrice}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.consultation_price}
                onChange={(e) => handleFieldChange('consultation_price', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.nutritionists.editProfile.fields.consultationDuration}
              </label>
              <input
                type="number"
                min="15"
                step="15"
                value={formData.consultation_duration}
                onChange={(e) => handleFieldChange('consultation_duration', parseInt(e.target.value) || 60)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="accepts_insurance"
              checked={formData.accepts_health_insurance}
              onChange={(e) => handleFieldChange('accepts_health_insurance', e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <label htmlFor="accepts_insurance" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.nutritionists.editProfile.fields.acceptsInsurance}
            </label>
          </div>

          {formData.accepts_health_insurance && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.nutritionists.editProfile.fields.insurances}
              </label>
              <textarea
                value={formData.health_insurances}
                onChange={(e) => handleFieldChange('health_insurances', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                placeholder={t.nutritionists.editProfile.fields.insurancesPlaceholder}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t.nutritionists.editProfile.contactInfo}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.phone}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.whatsapp}
            </label>
            <input
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => handleFieldChange('whatsapp', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.instagram}
            </label>
            <input
              type="text"
              value={formData.instagram}
              onChange={(e) => handleFieldChange('instagram', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              placeholder="@seuusuario"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.website}
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => handleFieldChange('website', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.fields.address}
            </label>
            <input
              type="text"
              value={formData.clinic_address}
              onChange={(e) => handleFieldChange('clinic_address', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t.common.settings}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="accepting_clients"
              checked={formData.accepting_new_clients}
              onChange={(e) => handleFieldChange('accepting_new_clients', e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <label htmlFor="accepting_clients" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.nutritionists.editProfile.fields.acceptingClients}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.nutritionists.editProfile.visibility}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={formData.profile_visibility === 'public'}
                  onChange={(e) => handleFieldChange('profile_visibility', e.target.value)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t.nutritionists.editProfile.public}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={formData.profile_visibility === 'private'}
                  onChange={(e) => handleFieldChange('profile_visibility', e.target.value)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t.nutritionists.editProfile.private}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          {t.common.cancel}
        </button>

        <button
          type="submit"
          disabled={loading || !hasChanges}
          className={cn(
            "flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors",
            loading || !hasChanges
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t.common.loading}
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              {t.nutritionists.editProfile.save}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
