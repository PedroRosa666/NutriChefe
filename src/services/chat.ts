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
      status: 'active', // Ativar imediatamente
      started_at: new Date().toISOString()
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
  // First, get the mentoring relationship IDs where the user participates
  const { data: relationships, error: relationshipsError } = await supabase
    .from('mentoring_relationships')
    .select('id')
    .or(`nutritionist_id.eq.${userId},client_id.eq.${userId}`);

  if (relationshipsError) throw relationshipsError;

  if (!relationships || relationships.length === 0) {
    return [];
  }

  const relationshipIds = relationships.map(rel => rel.id);

  // Then get conversations for those relationships
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      mentoring_relationship:mentoring_relationships(
        *,
        nutritionist:profiles!mentoring_relationships_nutritionist_id_fkey(id, full_name, avatar_url),
        client:profiles!mentoring_relationships_client_id_fkey(id, full_name, avatar_url)
      ),
      last_message:messages(
        content, 
        message_type, 
        sender_id, 
        created_at,
        profiles!messages_sender_id_fkey(full_name)
      )
    `)
    .in('mentoring_relationship_id', relationshipIds)
    .order('last_message_at', { ascending: false });

  if (error) throw error;

  // Enriquecer com contagem de mensagens não lidas
  const enrichedConversations = await Promise.all(
    (data || []).map(async (conversation) => {
      const { data: unreadCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', userId)
        .is('read_at', null);

      return {
        ...conversation,
        unread_count: unreadCount?.length || 0,
        last_message: conversation.last_message?.[0] || null
      };
    })
  );

  return enrichedConversations;
}

export async function createConversation(mentoringRelationshipId: string, title?: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert([{
      mentoring_relationship_id: mentoringRelationshipId,
      title: title || 'Mentoria Nutricional'
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
export async function getMessages(conversationId: string, limit = 50, offset = 0): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url),
      attachments:message_attachments(*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

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
      sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url),
      attachments:message_attachments(*)
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

export async function markConversationAsRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);

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
    .select(`
      *,
      recent_progress:goal_progress(
        *,
        recorder:profiles!goal_progress_recorded_by_fkey(id, full_name)
      )
    `)
    .single();

  if (error) throw error;
  return {
    ...data,
    progress_percentage: 0,
    recent_progress: []
  };
}

export async function updateClientGoal(id: string, updates: Partial<ClientGoal>): Promise<ClientGoal> {
  const { data, error } = await supabase
    .from('client_goals')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      recent_progress:goal_progress(
        *,
        recorder:profiles!goal_progress_recorded_by_fkey(id, full_name)
      )
    `)
    .single();

  if (error) throw error;
  return {
    ...data,
    progress_percentage: data.target_value ? Math.min(100, (data.current_value / data.target_value) * 100) : 0,
    recent_progress: (data.recent_progress || []).slice(0, 10)
  };
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
            sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url),
            attachments:message_attachments(*)
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

// Buscar estatísticas reais do nutricionista
export async function getNutritionistRealStats(nutritionistId: string) {
  try {
    // Usar a função SQL para obter estatísticas
    const { data, error } = await supabase
      .rpc('get_nutritionist_stats', { nutritionist_uuid: nutritionistId });

    if (error) throw error;

    return data?.[0] || {
      total_clients: 0,
      active_clients: 0,
      total_reviews: 0,
      average_rating: 0,
      total_sessions: 0,
      completed_goals: 0
    };
  } catch (error) {
    console.error('Error fetching nutritionist stats:', error);
    return {
      total_clients: 0,
      active_clients: 0,
      total_reviews: 0,
      average_rating: 0,
      total_sessions: 0,
      completed_goals: 0
    };
  }
}

// Buscar dados reais do cliente para o dashboard
export async function getClientRealStats(clientId: string) {
  try {
    // Buscar metas do cliente
    const { data: goals } = await supabase
      .from('client_goals')
      .select('id, status, current_value, target_value')
      .eq('client_id', clientId);

    // Buscar sessões do cliente
    const { data: sessions } = await supabase
      .from('mentoring_sessions')
      .select('id, status, scheduled_at')
      .in('mentoring_relationship_id', 
        await supabase
          .from('mentoring_relationships')
          .select('id')
          .eq('client_id', clientId)
          .then(({ data }) => data?.map(rel => rel.id) || [])
      );

    // Buscar mensagens não lidas
    const { data: conversations } = await supabase
      .from('conversations')
      .select(`
        id,
        mentoring_relationship:mentoring_relationships!inner(client_id)
      `)
      .eq('mentoring_relationship.client_id', clientId);

    let unreadMessages = 0;
    if (conversations) {
      for (const conv of conversations) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .eq('conversation_id', conv.id)
          .neq('sender_id', clientId)
          .is('read_at', null);
        
        unreadMessages += count || 0;
      }
    }

    const activeGoals = goals?.filter(goal => goal.status === 'active').length || 0;
    const completedGoals = goals?.filter(goal => goal.status === 'completed').length || 0;
    const upcomingSessions = sessions?.filter(session => 
      session.status === 'scheduled' && new Date(session.scheduled_at) > new Date()
    ).length || 0;

    const progressPercentage = goals && goals.length > 0 
      ? (completedGoals / goals.length) * 100 
      : 0;

    return {
      activeGoals,
      completedGoals,
      upcomingSessions,
      unreadMessages,
      progressPercentage,
      totalGoals: goals?.length || 0
    };
  } catch (error) {
    console.error('Error fetching client stats:', error);
    return {
      activeGoals: 0,
      completedGoals: 0,
      upcomingSessions: 0,
      unreadMessages: 0,
      progressPercentage: 0,
      totalGoals: 0
    };
  }
}

// Upload de anexos (simulado - seria implementado com Supabase Storage)
export async function uploadMessageAttachment(file: File, messageId: string): Promise<string> {
  // Por enquanto, simular upload retornando URL fictícia
  // Em produção, usar Supabase Storage
  const fileName = `${Date.now()}_${file.name}`;
  const fileUrl = `https://example.com/uploads/${fileName}`;
  
  // Salvar referência no banco
  const { error } = await supabase
    .from('message_attachments')
    .insert([{
      message_id: messageId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_url: fileUrl
    }]);

  if (error) throw error;
  return fileUrl;
}