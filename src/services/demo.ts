// Demonstração pública (/demo): Edge Function `demo` cria o par de contas e devolve o token de entrada.
import { supabase } from '../lib/supabase';

export type DemoRole = 'patient' | 'nutritionist';

async function enter(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; token_hash?: string; error?: string }>('demo', { body });
  if (error && !data) throw error;
  if (!data?.ok || !data.token_hash) throw new Error(data?.error ?? 'error');
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
  if (otpError) throw otpError;
}

/** Cria um par novo (paciente + nutricionista com dados) e entra no papel escolhido. */
export const startDemo = (as: DemoRole) => enter({ action: 'start', as });

/** Entra na outra conta do par (nutricionista <-> paciente). */
export const switchDemoRole = () => enter({ action: 'switch' });
