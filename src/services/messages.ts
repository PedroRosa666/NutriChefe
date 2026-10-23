// Mensagens entre nutricionista e paciente (supabase/migrations/20261026130000_care_messages.sql).
// Só funcionam com o acompanhamento ativo; a regra fica no banco.
import { supabase } from '../lib/supabase';

export interface CareMessage {
  id: string;
  nutritionist_id: string;
  client_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const COLUMNS = 'id, nutritionist_id, client_id, sender_id, body, read_at, created_at';

/** Últimas mensagens da conversa, da mais antiga para a mais nova. */
export async function listMessages(nutritionistId: string, clientId: string, limit = 200): Promise<CareMessage[]> {
  const { data, error } = await supabase
    .from('care_messages')
    .select(COLUMNS)
    .eq('nutritionist_id', nutritionistId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as CareMessage[]).reverse();
}

export async function sendMessage(input: { nutritionistId: string; clientId: string; senderId: string; body: string }): Promise<CareMessage> {
  const { data, error } = await supabase
    .from('care_messages')
    .insert({
      nutritionist_id: input.nutritionistId,
      client_id: input.clientId,
      sender_id: input.senderId,
      body: input.body.trim().slice(0, 2000),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as CareMessage;
}

export async function markMessagesRead(nutritionistId: string, clientId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', { p_nutritionist: nutritionistId, p_client: clientId });
  if (error) throw error;
}

/** Mensagens não lidas recebidas pelo nutricionista, por paciente. */
export async function unreadByPatient(nutritionistId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('care_messages')
    .select('client_id')
    .eq('nutritionist_id', nutritionistId)
    .neq('sender_id', nutritionistId)
    .is('read_at', null);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { client_id: string }[]) counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1);
  return counts;
}

/** Total de mensagens recebidas não lidas, em todas as conversas da pessoa (o RLS limita às dela). */
export async function countUnreadMessages(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('care_messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export interface ThreadSummary {
  clientId: string;
  last: CareMessage;
  unread: number;
}

/** Conversas do nutricionista: a última mensagem e as não lidas de cada paciente, mais recente primeiro. */
export async function listThreads(nutritionistId: string): Promise<ThreadSummary[]> {
  const { data, error } = await supabase
    .from('care_messages')
    .select(COLUMNS)
    .eq('nutritionist_id', nutritionistId)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  const threads = new Map<string, ThreadSummary>();
  for (const m of (data ?? []) as CareMessage[]) {
    const thread = threads.get(m.client_id) ?? { clientId: m.client_id, last: m, unread: 0 };
    if (m.sender_id !== nutritionistId && !m.read_at) thread.unread += 1;
    threads.set(m.client_id, thread);
  }
  return [...threads.values()];
}

/** Escuta mensagens novas da conversa. Devolve a função que para de escutar. */
export function subscribeMessages(nutritionistId: string, clientId: string, onInsert: (m: CareMessage) => void): () => void {
  const channel = supabase
    .channel(`care_messages:${nutritionistId}:${clientId}`)
    .on(
      'postgres_changes',
      // O filtro do Realtime aceita uma coluna só: o resto é conferido aqui.
      { event: 'INSERT', schema: 'public', table: 'care_messages', filter: `client_id=eq.${clientId}` },
      (payload) => {
        const m = payload.new as CareMessage;
        if (m.nutritionist_id === nutritionistId) onInsert(m);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
