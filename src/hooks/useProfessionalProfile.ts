import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ProfessionalProfile {
  professional_bio: string;
  specializations: string[];
  years_of_experience: number;
  education: string;
  consultation_price: number;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  clinic_address: string;
  profile_visibility: 'public' | 'private';
  accepting_new_clients: boolean;
  avatar_url: string | null;
}

/** Dados profissionais do nutricionista (colunas extras de `profiles`). */
export function useProfessionalProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('profiles')
      .select(
        'professional_bio, specializations, years_of_experience, education, consultation_price, phone, whatsapp, instagram, website, clinic_address, profile_visibility, accepting_new_clients, avatar_url'
      )
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Error loading professional profile:', error);
        setProfile(data as ProfessionalProfile | null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading };
}

/** Itens que deixam o perfil público completo, na ordem de importância. */
export function professionalChecklist(p: ProfessionalProfile | null) {
  return [
    { key: 'photo', done: Boolean(p?.avatar_url) },
    { key: 'bio', done: (p?.professional_bio?.trim().length ?? 0) >= 80 },
    { key: 'specializations', done: (p?.specializations?.length ?? 0) > 0 },
    { key: 'education', done: Boolean(p?.education?.trim()) },
    { key: 'experience', done: (p?.years_of_experience ?? 0) > 0 },
    { key: 'price', done: (p?.consultation_price ?? 0) > 0 },
    { key: 'contact', done: Boolean(p?.whatsapp?.trim() || p?.phone?.trim()) },
    { key: 'address', done: Boolean(p?.clinic_address?.trim()) },
  ] as const;
}
