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
  { key: 'meal_plans', table: 'meal_plans', columns: ['client_id'], select: '*, meal_plan_meals(*), meal_plan_items(*), meal_plan_versions(*)' },
  { key: 'active_plan', table: 'client_plan_selection', columns: ['client_id'] },
  { key: 'care_history', table: 'care_events', columns: ['client_id'] },
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
  { key: 'my_recipes', table: 'recipes', columns: ['author_id'], select: '*, recipe_ingredients(*)' },
  { key: 'my_foods', table: 'foods', columns: ['owner_id'] },
  { key: 'plan_templates', table: 'meal_plan_templates', columns: ['owner_id'] },
  { key: 'ai_conversations', table: 'ai_conversations', columns: ['client_id'], select: '*, ai_messages(*)' },
  { key: 'ai_assistant_settings', table: 'ai_configurations', columns: ['nutritionist_id'] },
  { key: 'crn_verification', table: 'nutritionist_verifications', columns: ['user_id'] },
  { key: 'subscriptions', table: 'user_subscriptions', columns: ['user_id'] },
];

/**
 * Tabelas que ficam fora da exportação, cada uma com o motivo. Toda tabela das migrations precisa
 * estar em EXPORT_SOURCES (direto ou dentro de um select) ou aqui: o teste cobra, para tabela nova
 * não ficar esquecida.
 */
export const NOT_EXPORTED: Record<string, string> = {
  subscription_plans: 'catálogo de preços, sem dados de usuário',
  app_admins: 'controle interno de quem administra o app',
  admin_demo_accounts: 'contas demo do administrador',
  demo_visitors: 'contas da demonstração pública, apagadas em 24 horas',
  ai_usage: 'contador técnico de uso da IA (limite diário)',
  client_errors: 'registro técnico de erros da tela, apagado em 30 dias',
  push_subscriptions: 'endereço técnico do aparelho para notificações',
  app_operations: 'resultado técnico de gravações repetíveis, apagado em 7 dias',
  message_attachments: 'tabela antiga sem uso (schema legacy)',
  messages: 'tabela antiga sem uso (schema legacy)',
  conversations: 'tabela antiga sem uso (schema legacy)',
  mentoring_relationships: 'tabela antiga sem uso (schema legacy)',
  mentoring_sessions: 'tabela antiga sem uso (schema legacy)',
  client_goals: 'tabela antiga sem uso (schema legacy)',
  goal_progress: 'tabela antiga sem uso (schema legacy)',
  nutrition_log: 'tabela antiga sem uso (schema legacy)',
  nutritionist_services: 'tabela antiga sem uso (schema legacy)',
};

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

/**
 * Apaga a conta e todos os dados. A Edge Function delete-account chama delete_my_account e depois
 * apaga os arquivos no Storage; se ela não responder, apaga pelo banco direto (os dados saem do
 * mesmo jeito, só as fotos ficam).
 */
export async function deleteMyAccount(): Promise<void> {
  const { data, error: invokeError } = await supabase.functions.invoke<{ ok: boolean; error?: string }>('delete-account');
  if (!invokeError && data) {
    if (data.ok) return;
    throw new DeleteAccountError(data.error === 'active_subscription' ? 'active_subscription' : 'unknown');
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new DeleteAccountError(error.message.includes('active_subscription') ? 'active_subscription' : 'unknown');
}
