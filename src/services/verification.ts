// Verificação do CRN (supabase/migrations/20261027130000_nutritionist_verification.sql).
// O nutricionista envia a foto da carteira e uma selfie segurando a carteira para o bucket privado;
// um administrador confere e aprova ou recusa.
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/image-utils';

const BUCKET = 'nutritionist-docs';

export type CrnStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface CrnVerification {
  user_id: string;
  full_name: string;
  crn_region: number;
  crn_number: string;
  card_path: string;
  selfie_path: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string;
  created_at: string;
}

const COLUMNS = 'user_id, full_name, crn_region, crn_number, card_path, selfie_path, status, reject_reason, created_at';

/** Regionais do CFN (CRN-1 a CRN-11). */
export const CRN_REGIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export async function getMyCrnStatus(userId: string): Promise<{ status: CrnStatus; region: number | null; number: string | null }> {
  const { data, error } = await supabase.from('profiles').select('crn_status, crn_region, crn_number').eq('id', userId).maybeSingle();
  if (error) throw error;
  return { status: (data?.crn_status ?? 'none') as CrnStatus, region: data?.crn_region ?? null, number: data?.crn_number ?? null };
}

export async function getMyVerification(userId: string): Promise<CrnVerification | null> {
  const { data, error } = await supabase.from('nutritionist_verifications').select(COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as CrnVerification | null;
}

async function uploadDoc(userId: string, kind: 'card' | 'selfie', file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not_image');
  // 1600px basta para ler o número da carteira e comparar o rosto.
  const blob = await compressImage(file, 1600, 0.85);
  const path = `${userId}/${kind}-${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp' });
  if (error) throw error;
  return path;
}

export async function submitVerification(input: {
  userId: string;
  fullName: string;
  region: number;
  number: string;
  card: File;
  selfie: File;
}): Promise<void> {
  const [cardPath, selfiePath] = await Promise.all([
    uploadDoc(input.userId, 'card', input.card),
    uploadDoc(input.userId, 'selfie', input.selfie),
  ]);
  const { error } = await supabase.rpc('submit_crn_verification', {
    p_full_name: input.fullName.trim(),
    p_crn_region: input.region,
    p_crn_number: input.number,
    p_card_path: cardPath,
    p_selfie_path: selfiePath,
  });
  if (error) {
    // O pedido não foi gravado: não deixa as fotos soltas no bucket.
    await supabase.storage.from(BUCKET).remove([cardPath, selfiePath]);
    throw error;
  }
}

// ---------------------------------------------------------------- administrador

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

export async function listPendingVerifications(): Promise<CrnVerification[]> {
  const { data, error } = await supabase
    .from('nutritionist_verifications')
    .select(COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CrnVerification[];
}

/** Links temporários (10 min) para o administrador ver as fotos. */
export async function docUrls(v: CrnVerification): Promise<{ card: string | null; selfie: string | null }> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls([v.card_path, v.selfie_path], 600);
  return { card: data?.[0]?.signedUrl ?? null, selfie: data?.[1]?.signedUrl ?? null };
}

export async function reviewVerification(v: CrnVerification, approve: boolean, reason: string): Promise<void> {
  const { error } = await supabase.rpc('review_crn_verification', { p_user: v.user_id, p_approve: approve, p_reason: reason });
  if (error) throw error;
  // Depois de analisadas, as fotos não são mais necessárias (LGPD: guardar só o que precisa).
  await supabase.storage.from(BUCKET).remove([v.card_path, v.selfie_path]);
}
