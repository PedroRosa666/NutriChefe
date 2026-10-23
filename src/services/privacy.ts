// Direitos do titular (LGPD): baixar uma cópia dos próprios dados e apagar a conta.
import { supabase } from '../lib/supabase';

// Tabelas com dados do usuário e a coluna que aponta para ele. Só dados do próprio usuário:
// planos que um nutricionista fez para pacientes ficam de fora (são dados dos pacientes).
const SOURCES: { key: string; table: string; column: string; select?: string }[] = [
  { key: 'profile', table: 'profiles', column: 'id' },
  { key: 'health_profile', table: 'client_health_profiles', column: 'user_id' },
  { key: 'nutrition_goals', table: 'nutrition_goals', column: 'user_id' },
  { key: 'diary', table: 'nutrition_log_entries', column: 'user_id' },
  { key: 'weight_logs', table: 'weight_logs', column: 'user_id' },
  { key: 'meal_plans', table: 'meal_plans', column: 'client_id', select: '*, meal_plan_items(*)' },
  { key: 'shopping_list', table: 'shopping_lists', column: 'user_id' },
  { key: 'favorites', table: 'favorites', column: 'user_id' },
  { key: 'reviews', table: 'reviews', column: 'user_id' },
  { key: 'swap_requests', table: 'food_swap_requests', column: 'client_id' },
  { key: 'notifications', table: 'notifications', column: 'user_id' },
  { key: 'nutritionist_links', table: 'nutritionist_clients', column: 'client_id' },
  { key: 'my_recipes', table: 'recipes', column: 'author_id' },
  { key: 'my_foods', table: 'foods', column: 'owner_id' },
  { key: 'plan_templates', table: 'meal_plan_templates', column: 'owner_id' },
  { key: 'ai_conversations', table: 'ai_conversations', column: 'user_id', select: '*, ai_messages(*)' },
  { key: 'subscriptions', table: 'user_subscriptions', column: 'user_id' },
];

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

/** Reúne os dados do usuário num JSON e faz o navegador baixar o arquivo. */
export async function downloadMyData(userId: string, email: string): Promise<void> {
  const data: Record<string, unknown> = {};
  const unavailable: string[] = [];
  await Promise.all(
    SOURCES.map(async (s) => {
      const { data: rows, error } = await supabase.from(s.table).select(s.select ?? '*').eq(s.column, userId);
      if (error) unavailable.push(s.key);
      else data[s.key] = rows;
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
