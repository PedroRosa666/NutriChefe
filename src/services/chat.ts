import { supabase } from '../lib/supabase';
import type { Conversation, Message } from '../types/chat';

export async function getMentoringRelationships(userId: string) {
  const { data, error } = await supabase
    .from('mentoring_relationships')
    .select(`
      *,
      nutritionist:nutritionist_id(id, full_name, avatar_url, specialization),
      client:client_id(id, full_name, avatar_url)
    `)
    .or(`nutritionist_id.eq.${userId},client_id.eq.${userId}`)
    .eq('status', 'active');

  if (error) throw error;
  return data;
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      mentoring_relationship:mentoring_relationship_id(
        id,
        nutritionist:nutritionist_id(id, full_name, avatar_url, specialization),
        client:client_id(id, full_name, avatar_url)
      ),
      last_message:messages(content, created_at, sender_id)
    `)
    .eq('mentoring_relationships.status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMessages(conversationId: string, limit = 50, offset = 0): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' = 'text'
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType
    })
    .select()
    .single();

  if (error) throw error;

  // Atualizar timestamp da conversa
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
}

export function subscribeToMessages(conversationId: string, callback: (message: Message) => void) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

export async function createConversation(mentoringRelationshipId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      mentoring_relationship_id: mentoringRelationshipId
    })
    .select(`
      *,
      mentoring_relationship:mentoring_relationship_id(
        id,
        nutritionist:nutritionist_id(id, full_name, avatar_url, specialization),
        client:client_id(id, full_name, avatar_url)
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count || 0;
}

export async function getAvailableClients(nutritionistId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('user_type', 'Client')
    .neq('id', nutritionistId);

  if (error) throw error;
  return data || [];
}