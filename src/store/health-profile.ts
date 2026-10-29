import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';
import { toISODate } from './nutrition-tracking';
import type { ActivityLevel, BodyGoal, Sex } from '../lib/nutrition-calculator';
import { feedback } from '../lib/i18n/current';

export interface HealthProfile {
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal: BodyGoal | null;
  dietary_preferences: string[];
  allergies: string[];
  notes: string;
}

export interface WeightLog {
  id: string;
  logged_on: string;
  weight_kg: number;
}

interface HealthProfileState {
  profile: HealthProfile;
  weightLogs: WeightLog[];
  loaded: boolean;
  /** A leitura falhou: o formulário não pode salvar por cima com campos vazios. */
  loadError: boolean;
  fetchHealthProfile: (userId: string) => Promise<void>;
  saveHealthProfile: (updates: Partial<HealthProfile>) => Promise<void>;
  logWeight: (weightKg: number, date?: string) => Promise<void>;
  reset: () => void;
}

const EMPTY_HEALTH_PROFILE: HealthProfile = {
  birth_date: null,
  sex: null,
  height_cm: null,
  weight_kg: null,
  target_weight_kg: null,
  activity_level: null,
  goal: null,
  dietary_preferences: [],
  allergies: [],
  notes: '',
};

const requireUserId = () => {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error(feedback().loginRequired.healthProfile);
  return userId;
};

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export const useHealthProfileStore = create<HealthProfileState>()((set, get) => ({
  profile: EMPTY_HEALTH_PROFILE,
  weightLogs: [],
  loaded: false,
  loadError: false,

  fetchHealthProfile: async (userId) => {
    const [profileRes, weightRes] = await Promise.all([
      supabase.from('client_health_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('weight_logs')
        .select('id, logged_on, weight_kg')
        .eq('user_id', userId)
        // Os 180 mais recentes (crescente com o limite pegava os 180 mais antigos).
        .order('logged_on', { ascending: false })
        .limit(180),
    ]);

    // Resposta de outra conta (troca de usuário no meio do caminho): descarta. Sem isso, a próxima
    // gravação levaria o perfil da conta antiga para a nova.
    if (useAuthStore.getState().user?.id !== userId) return;

    if (profileRes.error) console.error('Error fetching health profile:', profileRes.error);
    if (weightRes.error) console.error('Error fetching weight logs:', weightRes.error);
    if (profileRes.error || weightRes.error) {
      set({ loadError: true });
      return;
    }

    const row = profileRes.data;
    set({
      profile: row
        ? {
            birth_date: row.birth_date ?? null,
            // Valores guardados pelo próprio app (o banco confere com CHECK).
            sex: (row.sex ?? null) as HealthProfile['sex'],
            height_cm: num(row.height_cm),
            weight_kg: num(row.weight_kg),
            target_weight_kg: num(row.target_weight_kg),
            activity_level: (row.activity_level ?? null) as HealthProfile['activity_level'],
            goal: (row.goal ?? null) as HealthProfile['goal'],
            dietary_preferences: row.dietary_preferences ?? [],
            allergies: row.allergies ?? [],
            notes: row.notes ?? '',
          }
        : EMPTY_HEALTH_PROFILE,
      weightLogs: (weightRes.data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) })).reverse(),
      loaded: true,
      loadError: false,
    });
  },

  saveHealthProfile: async (updates) => {
    const userId = requireUserId();
    if (!get().loaded) throw new Error('health_profile_not_loaded');
    const next = { ...get().profile, ...updates };
    const { error } = await supabase
      .from('client_health_profiles')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    set({ profile: next });

    // Peso novo também entra no histórico do dia.
    if (updates.weight_kg && updates.weight_kg !== get().weightLogs.at(-1)?.weight_kg) {
      await get().logWeight(updates.weight_kg).catch((e) => console.error('Error logging weight:', e));
    }
  },

  logWeight: async (weightKg, date) => {
    const userId = requireUserId();
    const loggedOn = date ?? toISODate(new Date());
    const { data, error } = await supabase
      .from('weight_logs')
      .upsert({ user_id: userId, logged_on: loggedOn, weight_kg: weightKg }, { onConflict: 'user_id,logged_on' })
      .select('id, logged_on, weight_kg')
      .single();
    if (error) throw error;
    set((state) => ({
      weightLogs: [
        ...state.weightLogs.filter((w) => w.logged_on !== loggedOn),
        { ...data, weight_kg: Number(data.weight_kg) },
      ].sort((a, b) => a.logged_on.localeCompare(b.logged_on)),
    }));
  },

  reset: () => set({ profile: EMPTY_HEALTH_PROFILE, weightLogs: [], loaded: false, loadError: false }),
}));
