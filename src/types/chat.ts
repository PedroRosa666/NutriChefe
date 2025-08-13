export interface MentoringRelationship {
  id: string;
  nutritionist_id: string;
  client_id: string;
  status: 'pending' | 'active' | 'paused' | 'ended';
  started_at?: string;
  ended_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  nutritionist?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  client?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface Conversation {
  id: string;
  mentoring_relationship_id: string;
  title?: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  mentoring_relationship?: MentoringRelationship;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  read_at?: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface ClientGoal {
  id: string;
  client_id: string;
  nutritionist_id?: string;
  goal_type: 'weight_loss' | 'weight_gain' | 'muscle_gain' | 'health_improvement' | 'nutrition_education' | 'custom';
  title: string;
  description?: string;
  target_value?: number;
  current_value: number;
  unit?: string;
  target_date?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  progress_percentage?: number;
  recent_progress?: GoalProgress[];
}

export interface GoalProgress {
  id: string;
  goal_id: string;
  recorded_by: string;
  value: number;
  notes?: string;
  recorded_at: string;
  created_at: string;
  recorder?: {
    id: string;
    full_name: string;
  };
}

export interface MentoringSession {
  id: string;
  mentoring_relationship_id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  meeting_link?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}