// Recursos Premium do usuário logado, decididos no banco (my_premium, 20261028120000_nutritionist_premium.sql):
// IA própria, Premium Nutricionista e IA incluída pelo nutricionista que acompanha o paciente.
import { create } from 'zustand';
import { fromJson, supabase } from '../lib/supabase';
import { useAuthStore } from './auth';
import { useSubscriptionStore } from './subscription';

interface PremiumState {
  loaded: boolean;
  nutritionistPro: boolean;
  /** Nutricionista Premium que paga a IA deste paciente (null = nenhum). */
  aiViaNutritionist: string | null;
  activePatients: number;
  freePatientLimit: number;
  isAdmin: boolean;
  /** Conta de demonstração (Laboratório do administrador ou demonstração pública). */
  isDemo: boolean;
  /** Visitante da demonstração pública (/demo). */
  isVisitor: boolean;
  fetch: (userId: string) => Promise<void>;
  reset: () => void;
}

const EMPTY = { loaded: false, nutritionistPro: false, aiViaNutritionist: null, activePatients: 0, freePatientLimit: 5, isAdmin: false, isDemo: false, isVisitor: false };

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
    const p = fromJson<{
      nutritionist_pro?: boolean; ai_via_nutritionist?: string | null; active_patients?: number;
      free_patient_limit?: number; admin?: boolean; demo?: boolean; visitor?: boolean;
    }>(data);
    set({
      loaded: true,
      nutritionistPro: p.nutritionist_pro === true,
      aiViaNutritionist: p.ai_via_nutritionist ?? null,
      activePatients: Number(p.active_patients) || 0,
      freePatientLimit: Number(p.free_patient_limit) || 5,
      isAdmin: p.admin === true,
      isDemo: p.demo === true,
      isVisitor: p.visitor === true,
    });
  },
  reset: () => set(EMPTY),
}));

/** Assinatura Premium do próprio usuário (cardápio pela IA, relatório e desafios). */
export function useOwnPremium(): boolean {
  return useSubscriptionStore((s) => s.hasFeatureAccess('ai_mentoring'));
}

/** Vê as receitas exclusivas: mesma regra de premium_content() no banco. */
export function usePremiumContent(): boolean {
  const own = useOwnPremium();
  const viaNutritionist = usePremiumStore((s) => s.aiViaNutritionist !== null);
  const admin = usePremiumStore((s) => s.isAdmin);
  return own || viaNutritionist || admin;
}

/** Pode usar a IA: assinatura própria ou incluída pelo nutricionista Premium. */
export function useCanUseAI(): boolean {
  const own = useSubscriptionStore((s) => s.hasFeatureAccess('ai_mentoring'));
  const viaNutritionist = usePremiumStore((s) => s.aiViaNutritionist !== null);
  return own || viaNutritionist;
}
