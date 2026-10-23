// Painel do administrador: funções admin_* do banco (20261029120000_admin_panel.sql) e a
// Edge Function `admin` (suspender contas e Laboratório com as contas demo).
import { supabase } from '../lib/supabase';

type RpcName = Parameters<typeof supabase.rpc>[0];

async function rpc<T>(name: RpcName, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args as never);
  if (error) throw error;
  return data as T;
}

async function fn<T extends { ok: boolean; error?: string }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin', { body });
  if (error && !data) throw error;
  if (!data?.ok) throw new Error(data?.error ?? 'admin_failed');
  return data;
}

export interface AdminStats {
  users: number;
  clients: number;
  nutritionists: number;
  new_7d: number;
  new_30d: number;
  active_links: number;
  plans: { name: string; paid: number; courtesy: number }[];
  mrr: number;
  ai_today: Record<string, number>;
  errors_24h: number;
  crn_pending: number;
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: string;
  crn_status: string;
  is_demo: boolean;
  plan_name: string | null;
  sub_status: string | null;
  expires_at: string | null;
  courtesy: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

export interface AdminError {
  message: string;
  total: number;
  users: number;
  last_at: string;
  url: string;
  stack: string;
}

export interface AdminRecipe {
  id: string;
  title: string;
  author_name: string | null;
  rating: number;
  reviews: number;
  hidden_at: string | null;
  premium_only: boolean;
  created_at: string;
}

export interface AdminReview {
  id: string;
  user_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface AdminPlan {
  id: string;
  name: string;
  price: number;
  stripe_price_id: string | null;
  is_active: boolean;
  features: string[];
}

export const adminStats = () => rpc<AdminStats>('admin_stats');
export const adminUsers = (query: string) => rpc<AdminUser[]>('admin_users', { p_query: query, p_limit: 50 });
export const grantPremium = (userId: string, planId: string, until: string | null) =>
  rpc<void>('admin_grant_premium', { p_user: userId, p_plan: planId, p_until: until });
export const revokePremium = (userId: string) => rpc<void>('admin_revoke_premium', { p_user: userId });
export const setCrnStatus = (userId: string, status: string) => rpc<void>('admin_set_crn', { p_user: userId, p_status: status });
export const setPlan = (planId: string, price: number | null, stripePriceId: string | null, active: boolean | null) =>
  rpc<void>('admin_set_plan', { p_plan: planId, p_price: price, p_stripe_price: stripePriceId, p_active: active });
export const adminErrors = (days: number) => rpc<AdminError[]>('admin_errors', { p_days: days });
export const adminRecipes = (query: string) => rpc<AdminRecipe[]>('admin_recipes', { p_query: query });
export const setRecipeHidden = (recipeId: string, hidden: boolean) => rpc<void>('admin_set_recipe_hidden', { p_recipe: recipeId, p_hidden: hidden });
export const setRecipePremium = (recipeId: string, premium: boolean) => rpc<void>('admin_set_recipe_premium', { p_recipe: recipeId, p_premium: premium });
export const adminReviews = (recipeId: string) => rpc<AdminReview[]>('admin_reviews', { p_recipe: recipeId });
export const deleteReview = (reviewId: string) => rpc<void>('admin_delete_review', { p_review: reviewId });
export const broadcast = (audience: 'all' | 'clients' | 'nutritionists', title: string, body: string) =>
  rpc<number>('admin_broadcast', { p_audience: audience, p_title: title, p_body: body });
export const testPush = () => rpc<void>('admin_test_push');
export const runReminders = () => rpc<number>('admin_run_reminders');

export async function listPlans(): Promise<AdminPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, price, stripe_price_id, is_active, features')
    .order('price');
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, price: Number(p.price) })) as AdminPlan[];
}

export const suspendUser = (userId: string, suspend: boolean) => fn({ action: 'suspend', user_id: userId, suspend });

// ---------------------------------------------------------------- Laboratório

export interface DemoStatus {
  ok: boolean;
  exists: boolean;
  patientPremium?: boolean;
  nutritionistPremium?: boolean;
  crnPending?: boolean;
  atLimit?: boolean;
}

export const demoStatus = () => fn<DemoStatus>({ action: 'demo_status' });
export const demoReset = () => fn({ action: 'demo_reset' });
export const demoToggle = (what: 'patient_premium' | 'nutritionist_premium' | 'crn' | 'limit', on: boolean) =>
  fn({ action: 'demo_toggle', what, on });
export const simulate = (what: 'swap' | 'message') => fn({ action: 'simulate', what });

// Sessão do administrador guardada enquanto ele usa uma conta demo. Fica no localStorage (como a
// própria sessão do Supabase): no sessionStorage ela sumia ao fechar o app, e o admin ficava preso na
// conta demo. Sai no "Voltar ao admin", no "Sair" e depois de 30 dias.
const ADMIN_SESSION_KEY = 'nc-admin-session';
const ADMIN_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

interface SavedAdminSession {
  access_token: string;
  refresh_token: string;
  saved_at: number;
}

function readSavedAdminSession(): SavedAdminSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) ?? 'null') as SavedAdminSession | null;
    if (saved?.refresh_token && Date.now() - Number(saved.saved_at) < ADMIN_SESSION_MAX_AGE) return saved;
  } catch {
    /* storage indisponível ou valor inválido */
  }
  return null;
}

export function forgetSavedAdminSession() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_KEY); // versão antiga guardava aqui
  } catch {
    /* storage indisponível */
  }
}

/** Entra na conta demo guardando a sessão do administrador neste navegador, para voltar em um toque. */
export async function enterDemo(as: 'patient' | 'nutritionist'): Promise<void> {
  const { data: current } = await supabase.auth.getSession();
  const session = current.session;
  if (!session) throw new Error('unauthenticated');
  const { token_hash } = await fn<{ ok: boolean; token_hash: string }>({ action: 'demo_login', as });
  // Só o admin chega aqui (demo_login confere): a sessão atual é sempre a dele, a mais nova.
  const saved: SavedAdminSession = { access_token: session.access_token, refresh_token: session.refresh_token, saved_at: Date.now() };
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(saved));
  } catch {
    throw new Error('storage_unavailable');
  }
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
  if (error) {
    forgetSavedAdminSession();
    throw error;
  }
}

/** Volta para a conta do administrador. Sem sessão guardada (ou expirada), sai e pede login. */
export async function returnToAdmin(): Promise<boolean> {
  const saved = readSavedAdminSession();
  forgetSavedAdminSession();
  if (saved) {
    const { error } = await supabase.auth.setSession({ access_token: saved.access_token, refresh_token: saved.refresh_token });
    if (!error) return true;
  }
  await supabase.auth.signOut();
  return false;
}
