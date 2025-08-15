import { supabase } from '../lib/supabase';

export interface NutritionistService {
  id: string;
  nutritionist_id: string;
  service_price: number;
  description: string;
  specializations: string[];
  response_time: string;
  requirements: string;
  availability_notes: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface NutritionistProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  user_type: string;
  last_seen?: string;
  created_at: string;
  service?: NutritionistService;
  stats?: {
    total_clients: number;
    active_clients: number;
    total_reviews: number;
    average_rating: number;
    total_sessions: number;
    completed_goals: number;
  };
}

// Buscar todos os nutricionistas com seus serviços
export async function getNutritionists(): Promise<NutritionistProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      service:nutritionist_services(*)
    `)
    .eq('user_type', 'Nutritionist')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Enriquecer com estatísticas reais
  const enrichedData = await Promise.all((data || []).map(async (nutritionist) => {
    const stats = await getNutritionistStats(nutritionist.id);
    return {
      ...nutritionist,
      stats
    };
  }));

  return enrichedData;
}

// Buscar estatísticas reais do nutricionista
export async function getNutritionistStats(nutritionistId: string) {
  try {
    // Buscar relacionamentos ativos
    const { data: relationships } = await supabase
      .from('mentoring_relationships')
      .select('id, status, client_id')
      .eq('nutritionist_id', nutritionistId);

    const totalClients = relationships?.length || 0;
    const activeClients = relationships?.filter(rel => rel.status === 'active').length || 0;

    // Buscar sessões
    const { data: sessions } = await supabase
      .from('mentoring_sessions')
      .select('id, status')
      .in('mentoring_relationship_id', relationships?.map(rel => rel.id) || []);

    const totalSessions = sessions?.length || 0;

    // Buscar metas concluídas
    const { data: goals } = await supabase
      .from('client_goals')
      .select('id, status')
      .eq('nutritionist_id', nutritionistId);

    const completedGoals = goals?.filter(goal => goal.status === 'completed').length || 0;

    // Buscar avaliações das receitas do nutricionista
    const { data: recipes } = await supabase
      .from('recipes')
      .select(`
        id,
        reviews(rating)
      `)
      .eq('author_id', nutritionistId);

    const allReviews = recipes?.flatMap(recipe => recipe.reviews || []) || [];
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
      : 0;

    return {
      total_clients: totalClients,
      active_clients: activeClients,
      total_reviews: totalReviews,
      average_rating: Number(averageRating.toFixed(1)),
      total_sessions: totalSessions,
      completed_goals: completedGoals
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

// Buscar ou criar serviço do nutricionista
export async function getNutritionistService(nutritionistId: string): Promise<NutritionistService | null> {
  const { data, error } = await supabase
    .from('nutritionist_services')
    .select('*')
    .eq('nutritionist_id', nutritionistId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

// Criar serviço padrão para nutricionista
export async function createNutritionistService(nutritionistId: string): Promise<NutritionistService> {
  const { data, error } = await supabase
    .from('nutritionist_services')
    .insert([{
      nutritionist_id: nutritionistId,
      service_price: 100.00,
      description: 'Mentoria nutricional personalizada com acompanhamento completo',
      specializations: ['Emagrecimento', 'Nutrição Clínica'],
      response_time: '24 horas',
      requirements: 'Disponibilidade para consultas semanais',
      availability_notes: 'Disponível de segunda a sexta, das 8h às 18h',
      is_available: true
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar serviço do nutricionista
export async function updateNutritionistService(
  nutritionistId: string, 
  updates: Partial<NutritionistService>
): Promise<NutritionistService> {
  const { data, error } = await supabase
    .from('nutritionist_services')
    .update(updates)
    .eq('nutritionist_id', nutritionistId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Atualizar última visualização do nutricionista
export async function updateLastSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('Error updating last seen:', error);
  }
}

// Buscar clientes do nutricionista com dados reais
export async function getNutritionistClients(nutritionistId: string) {
  const { data: relationships, error } = await supabase
    .from('mentoring_relationships')
    .select(`
      *,
      client:profiles!mentoring_relationships_client_id_fkey(
        id,
        full_name,
        email,
        avatar_url,
        bio,
        created_at,
        last_seen
      )
    `)
    .eq('nutritionist_id', nutritionistId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Enriquecer com dados reais de cada cliente
  const enrichedClients = await Promise.all((relationships || []).map(async (rel) => {
    const clientId = rel.client_id;

    // Buscar metas do cliente
    const { data: goals } = await supabase
      .from('client_goals')
      .select('id, status, progress_percentage:current_value, target_value')
      .eq('client_id', clientId);

    const activeGoals = goals?.filter(goal => goal.status === 'active').length || 0;
    const completedGoals = goals?.filter(goal => goal.status === 'completed').length || 0;
    const totalGoals = goals?.length || 0;
    
    // Calcular progresso médio
    const progressPercentage = totalGoals > 0 
      ? (completedGoals / totalGoals) * 100 
      : 0;

    // Buscar mensagens não lidas
    const { data: conversations } = await supabase
      .from('conversations')
      .select(`
        id,
        messages!inner(id, read_at, sender_id)
      `)
      .eq('mentoring_relationship_id', rel.id);

    const unreadMessages = conversations?.reduce((total, conv) => {
      const unread = conv.messages?.filter(msg => 
        !msg.read_at && msg.sender_id === clientId
      ).length || 0;
      return total + unread;
    }, 0) || 0;

    // Buscar próxima sessão
    const { data: nextSession } = await supabase
      .from('mentoring_sessions')
      .select('scheduled_at')
      .eq('mentoring_relationship_id', rel.id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single();

    return {
      ...rel.client,
      relationship_id: rel.id,
      active_goals: activeGoals,
      completed_goals: completedGoals,
      progress_percentage: progressPercentage,
      unread_messages: unreadMessages,
      next_session: nextSession?.scheduled_at,
      last_activity: rel.updated_at
    };
  }));

  return enrichedClients;
}