import { supabase } from '../lib/supabase';
import type { MentoringRelationship, Conversation, Message, ClientGoal, GoalProgress, MentoringSession } from '../types/chat';

// Relacionamentos de Mentoria
export async function createMentoringRelationship(nutritionistId: string, clientId: string, notes?: string): Promise<MentoringRelationship> {
  const { data, error } = await supabase
    .from('mentoring_relationships')
    .insert([{
      nutritionist_id: nutritionistId,
      client_id: clientId,
      notes,
      status: 'pending'
    }])
    .select(`
      *,
      nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
      client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getMentoringRelationships(userId: string): Promise<MentoringRelationship[]> {
  const { data, error } = await supabase
    .from('mentoring_relationships')
    .select(`
      *,
      nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
      client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
    `)
    .or(`nutritionist_id.eq.${userId},client_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateMentoringRelationship(id: string, updates: Partial<MentoringRelationship>): Promise<MentoringRelationship> {
  const { data, error } = await supabase
    .from('mentoring_relationships')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
      client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

// Conversas
export async function getConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      mentoring_relationship:mentoring_relationships(
        *,
        nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
        client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
      )
    `)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createConversation(mentoringRelationshipId: string, title?: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert([{
      mentoring_relationship_id: mentoringRelationshipId,
      title
    }])
    .select(`
      *,
      mentoring_relationship:mentoring_relationships(
        *,
        nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
        client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

// Mensagens
export async function getMessages(conversationId: string, limit = 50): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).reverse();
}

export async function sendMessage(conversationId: string, senderId: string, content: string, messageType: Message['message_type'] = 'text'): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType
    }])
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) throw error;
}

// Metas dos Clientes
export async function getClientGoals(clientId: string, nutritionistId?: string): Promise<ClientGoal[]> {
  let query = supabase
    .from('client_goals')
    .select(`
      *,
      recent_progress:goal_progress(
        *,
        recorder:profiles!goal_progress_recorded_by_fkey(id, full_name)
      )
    `)
    .eq('client_id', clientId);

  if (nutritionistId) {
    query = query.eq('nutritionist_id', nutritionistId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(goal => ({
    ...goal,
    progress_percentage: goal.target_value ? Math.min(100, (goal.current_value / goal.target_value) * 100) : 0,
    recent_progress: (goal.recent_progress || []).slice(0, 10)
  }));
}

export async function createClientGoal(goalData: Omit<ClientGoal, 'id' | 'created_at' | 'updated_at' | 'current_value'>): Promise<ClientGoal> {
  const { data, error } = await supabase
    .from('client_goals')
    .insert([{
      ...goalData,
      current_value: 0
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClientGoal(id: string, updates: Partial<ClientGoal>): Promise<ClientGoal> {
  const { data, error } = await supabase
    .from('client_goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Progresso das Metas
export async function addGoalProgress(goalId: string, recordedBy: string, value: number, notes?: string): Promise<GoalProgress> {
  const { data, error } = await supabase
    .from('goal_progress')
    .insert([{
      goal_id: goalId,
      recorded_by: recordedBy,
      value,
      notes
    }])
    .select(`
      *,
      recorder:profiles!goal_progress_recorded_by_fkey(id, full_name)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function getGoalProgress(goalId: string): Promise<GoalProgress[]> {
  const { data, error } = await supabase
    .from('goal_progress')
    .select(`
      *,
      recorder:profiles!goal_progress_recorded_by_fkey(id, full_name)
    `)
    .eq('goal_id', goalId)
    .order('recorded_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Sessões de Mentoria
export async function getMentoringSessions(mentoringRelationshipId: string): Promise<MentoringSession[]> {
  const { data, error } = await supabase
    .from('mentoring_sessions')
    .select('*')
    .eq('mentoring_relationship_id', mentoringRelationshipId)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createMentoringSession(sessionData: Omit<MentoringSession, 'id' | 'created_at' | 'updated_at'>): Promise<MentoringSession> {
  const { data, error } = await supabase
    .from('mentoring_sessions')
    .insert([sessionData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMentoringSession(id: string, updates: Partial<MentoringSession>): Promise<MentoringSession> {
  const { data, error } = await supabase
    .from('mentoring_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Buscar clientes disponíveis para mentoria
export async function getAvailableClients(): Promise<Array<{ id: string; full_name: string; email: string; avatar_url?: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('user_type', 'Client')
    .order('full_name');

  if (error) throw error;
  return data || [];
}

// Subscrição em tempo real para mensagens
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
      async (payload) => {
        // Buscar dados completos da mensagem
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();
        
        if (data) {
          callback(data);
        }
      }
    )
    .subscribe();
}

// Subscrição para conversas
export function subscribeToConversations(userId: string, callback: (conversation: Conversation) => void) {
  return supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations'
      },
      async (payload) => {
        // Verificar se o usuário tem acesso a esta conversa
        const { data } = await supabase
          .from('conversations')
          .select(`
            *,
            mentoring_relationship:mentoring_relationships(
              *,
              nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
              client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
            )
          `)
          .eq('id', payload.new?.id || payload.old?.id)
          .single();
        
        if (data && 
            (data.mentoring_relationship.nutritionist_id === userId || 
             data.mentoring_relationship.client_id === userId)) {
          callback(data);
        }
      }
    )
    .subscribe();
}