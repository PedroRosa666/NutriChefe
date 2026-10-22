// Avisos dentro do app. São criados só por gatilhos do banco
// (supabase/migrations/20261023120000_notifications.sql); aqui o app lê, marca como lido e apaga.
import { supabase } from '../lib/supabase';

export type NotificationKind =
  | 'swap_requested'
  | 'swap_answered'
  | 'patient_joined'
  | 'link_ended'
  | 'plan_updated'
  | 'goals_updated'
  | 'message';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  ref_id: string | null;
  data: {
    name?: string;
    client_id?: string;
    item?: string;
    status?: 'approved' | 'rejected';
    offered?: boolean;
    title?: string;
    new?: boolean;
    preview?: string;
    from_nutritionist?: boolean;
  };
  read_at: string | null;
  created_at: string;
}

const COLUMNS = 'id, kind, ref_id, data, read_at, created_at';

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AppNotification[];
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

/** Escuta avisos novos ou atualizados do usuário. Devolve a função que para de escutar. */
export function subscribeNotifications(userId: string, onChange: (n: AppNotification) => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return;
        onChange(payload.new as AppNotification);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Para onde o aviso leva ao ser aberto. */
export function notificationTarget(n: AppNotification): string {
  switch (n.kind) {
    case 'swap_requested':
    case 'patient_joined':
      return n.data.client_id ? `/perfil?tab=patients&paciente=${n.data.client_id}` : '/perfil?tab=patients';
    case 'swap_answered':
    case 'plan_updated':
      return '/perfil?tab=plan';
    case 'goals_updated':
      return '/perfil?tab=nutrition';
    case 'message':
      // Mensagem do nutricionista: o paciente abre a aba Mensagens; do paciente: o nutricionista abre a conversa dele.
      return n.data.from_nutritionist ? '/perfil?tab=messages' : `/perfil?tab=patients&paciente=${n.data.client_id ?? ''}&chat=1`;
    default:
      return '/perfil';
  }
}
