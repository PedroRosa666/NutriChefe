// Caminho: src/types/ai.ts

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
  metadata: {
    recipes?: AIResponse['recipes'];
    nutritionists?: AIResponse['nutritionists'];
    suggestions?: string[];
    [key: string]: unknown;
  };
  created_at: string;
}

export interface AIResponse {
  content: string;
  recipes?: Array<{
    id: string;
    title: string;
    description: string;
    author: string;
    rating: number;
    prepTime?: number;
    image?: string;
    category?: string;
    calories?: number;
    /** Ingredientes pedidos que a receita contém (mostrados no cartão). */
    matched?: string[];
  }>;
  nutritionists?: Array<{
    id: string;
    fullName: string;
    bio: string;
  }>;
  suggestions?: string[];
  /** Como a IA entendeu o pedido (intenção, ingredientes, resultado da busca). */
  meta?: Record<string, unknown>;
}