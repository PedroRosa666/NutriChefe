// Recursos Premium do usuário logado, decididos no banco (my_premium, 20261028120000_nutritionist_premium.sql):
// IA própria, Premium Nutricionista e IA incluída pelo nutricionista que acompanha o paciente.
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';
import { useSubscriptionStore } from './subscription';

interface PremiumState {
  loaded: boolean;
  nutritionistPro: boolean;
  /** Nutricionista Premium que paga a IA deste paciente (null = nenhum). */
  aiViaNutritionist: string | null;
  activePatients: number;
  freePatientLimit: number;
  fetch: (userId: string) => Promise<void>;
  reset: () => void;
}

const EMPTY = { loaded: false, nutritionistPro: false, aiViaNutritionist: null, activePatients: 0, freePatientLimit: 5 };

export const usePremiumStore = create<PremiumState>()((set) => ({
  ...EMPTY,
  fetch: async (userId) => {
    const { data, error } = await supabase.rpc('my_premium');
    // Resposta de outra conta (troca de usuário no meio do caminho): descarta.
    if (useAuthStore.getState().user?.id !== userId) return;
    if (error || !data) {
      console.error('my_premium failed', error);
      set({ ...EMPTY, loaded: true });
      return;
    }
    set({
      loaded: true,
      nutritionistPro: data.nutritionist_pro === true,
      aiViaNutritionist: data.ai_via_nutritionist ?? null,
      activePatients: Number(data.active_patients) || 0,
      freePatientLimit: Number(data.free_patient_limit) || 5,
    });
  },
  reset: () => set(EMPTY),
}));

/** Pode usar a IA: assinatura própria ou incluída pelo nutricionista Premium. */
export function useCanUseAI(): boolean {
  const own = useSubscriptionStore((s) => s.hasFeatureAccess('ai_mentoring'));
  const viaNutritionist = usePremiumStore((s) => s.aiViaNutritionist !== null);
  return own || viaNutritionist;
}
