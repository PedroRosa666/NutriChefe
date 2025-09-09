type AIPersonality = 'empathetic' | 'scientific' | 'friendly' | 'professional';

export interface AIConfiguration {
  id: string;
  nutritionist_id: string;
  ai_name: string;
  personality: AIPersonality;
  custom_instructions: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIConversation {
  id: string;
  client_id: string;
  nutritionist_id?: string;
  ai_config_id?: string;
  title?: string;
  last_message_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ai_config?: AIConfiguration;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  sender_type: 'user' | 'ai';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AIResponse {
  content: string;
  recipes?: Array<{
    id: number;
    title: string;
    description: string;
    author: string;
    rating: number;
  }>;
  suggestions?: string[];
}