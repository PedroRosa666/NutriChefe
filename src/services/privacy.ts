// Direitos do titular (LGPD): baixar uma cópia dos próprios dados e apagar a conta.
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

import { PUBLIC_PROFILE_COLUMNS } from '../lib/profile-columns';

// Tabelas com dados do usuário e a(s) coluna(s) que apontam para ele. Só dados do próprio
// usuário: planos que um nutricionista fez para pacientes ficam de fora (são dados dos
// pacientes); conversas e consultas entram dos dois lados, porque a pessoa participa delas.
// Ao criar uma tabela com dados de usuário, acrescente-a aqui (o teste confere as colunas).
type TableName = keyof Database['public']['Tables'];

export const EXPORT_SOURCES: { key: string; table: TableName; columns: string[]; select?: string }[] = [
  { key: 'profile', table: 'profiles', columns: ['id'], select: PUBLIC_PROFILE_COLUMNS },
  { key: 'health_profile', table: 'client_health_profiles', columns: ['user_id'] },
  { key: 'nutrition_goals', table: 'nutrition_goals', columns: ['user_id'] },
  { key: 'diary', table: 'nutrition_log_entries', columns: ['user_id'] },
  { key: 'weight_logs', table: 'weight_logs', columns: ['user_id'] },
  { key: 'meal_plans', table: 'meal_plans', columns: ['client_id'], select: '*, meal_plan_items(*)' },
  { key: 'meal_checks', table: 'meal_plan_checks', columns: ['client_id'] },
  { key: 'shopping_list', table: 'shopping_lists', columns: ['user_id'] },
  { key: 'favorites', table: 'favorites', columns: ['user_id'] },
  { key: 'reviews', table: 'reviews', columns: ['user_id'] },
  { key: 'swap_requests', table: 'food_swap_requests', columns: ['client_id'] },
  { key: 'notifications', table: 'notifications', columns: ['user_id'] },
  { key: 'nutritionist_links', table: 'nutritionist_clients', columns: ['client_id', 'nutritionist_id'] },
  { key: 'invites', table: 'nutritionist_invites', columns: ['nutritionist_id'] },
  { key: 'care_messages', table: 'care_messages', columns: ['client_id', 'nutritionist_id'] },
  { key: 'appointments', table: 'appointments', columns: ['client_id', 'nutritionist_id'] },
  { key: 'my_recipes', table: 'recipes', columns: ['author_id'] },
  { key: 'my_foods', table: 'foods', columns: ['owner_id'] },
  { key: 'plan_templates', table: 'meal_plan_templates', columns: ['owner_id'] },
  { key: 'ai_conversations', table: 'ai_conversations', columns: ['client_id'], select: '*, ai_messages(*)' },
  { key: 'ai_assistant_settings', table: 'ai_configurations', columns: ['nutritionist_id'] },
  { key: 'crn_verification', table: 'nutritionist_verifications', columns: ['user_id'] },
  { key: 'subscriptions', table: 'user_subscriptions', columns: ['user_id'] },
];

const PAGE = 1000;

interface PageQuery {
  eq: (column: string, value: string) => PageQuery;
  or: (filter: string) => PageQuery;
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: Error | null }>;
}

/** Todas as linhas de uma fonte, em páginas (o servidor devolve no máximo ~1000 por vez). */
async function readAll(source: (typeof EXPORT_SOURCES)[number], userId: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    // Tabela escolhida em tempo de execução: o tipo da consulta fica genérico.
    let query = supabase.from(source.table).select(source.select ?? '*') as unknown as PageQuery;
    query = source.columns.length === 1
      ? query.eq(source.columns[0], userId)
      : query.or(source.columns.map((c) => `${c}.eq.${userId}`).join(','));
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Planos de nutricionistas que não acompanham mais o usuário (não aparecem no app). */
export async function countArchivedPlans(): Promise<number> {
  const { data, error } = await supabase.rpc('my_archived_plans');
  if (error) throw error;
  return Number(data) || 0;
}

export async function deleteArchivedPlans(): Promise<number> {
  const { data, error } = await supabase.rpc('delete_my_archived_plans');
  if (error) throw error;
  return Number(data) || 0;
}

/**
 * Reúne os dados do usuário num JSON e faz o navegador baixar o arquivo. Devolve as partes
 * que não puderam ser lidas (a tela avisa: a cópia não sai incompleta em silêncio).
 */
export async function downloadMyData(userId: string, email: string): Promise<string[]> {
  const data: Record<string, unknown> = {};
  const unavailable: string[] = [];
  await Promise.all(
    EXPORT_SOURCES.map(async (s) => {
      try {
        data[s.key] = await readAll(s, userId);
      } catch (error) {
        console.error('Export failed for', s.key, error);
        unavailable.push(s.key);
      }
    })
  );
  const file = {
    exported_at: new Date().toISOString(),
    account: { id: userId, email },
    ...data,
    ...(unavailable.length ? { not_exported: unavailable } : {}),
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutrichef-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return unavailable;
}

export class DeleteAccountError extends Error {
  constructor(public code: 'active_subscription' | 'unknown') {
    super(code);
  }
}

/** Apaga a conta e todos os dados (função delete_my_account no banco). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new DeleteAccountError(error.message.includes('active_subscription') ? 'active_subscription' : 'unknown');
}
