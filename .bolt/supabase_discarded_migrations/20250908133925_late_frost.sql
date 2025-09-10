/*
  # Create AI Mentoring System Tables

  1. New Tables
    - `ai_configurations`
      - `id` (uuid, primary key)
      - `nutritionist_id` (uuid, foreign key to profiles)
      - `ai_name` (text, default 'NutriBot')
      - `personality` (text, enum: empathetic, scientific, friendly, professional)
      - `custom_instructions` (text, nullable)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `ai_conversations`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to profiles)
      - `nutritionist_id` (uuid, foreign key to profiles, nullable)
      - `ai_config_id` (uuid, foreign key to ai_configurations, nullable)
      - `title` (text, nullable)
      - `last_message_at` (timestamp)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `ai_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key to ai_conversations)
      - `sender_type` (text, enum: user, ai)
      - `content` (text)
      - `metadata` (jsonb, for storing recipes, suggestions, etc.)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for nutritionists to manage their AI configurations
    - Add policies for premium clients to access AI conversations
    - Add policies for participants to manage their conversations and messages

  3. Indexes
    - Add indexes for performance optimization on foreign keys and frequently queried columns

  4. Triggers
    - Add updated_at triggers for ai_configurations and ai_conversations
    - Add trigger to update last_message_at in ai_conversations when new message is added
*/

-- Create ai_configurations table
CREATE TABLE IF NOT EXISTS ai_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ai_name text NOT NULL DEFAULT 'NutriBot',
  personality text NOT NULL DEFAULT 'empathetic',
  custom_instructions text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT ai_configurations_personality_check 
    CHECK (personality IN ('empathetic', 'scientific', 'friendly', 'professional')),
  CONSTRAINT ai_configurations_nutritionist_unique 
    UNIQUE (nutritionist_id)
);

-- Create ai_conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nutritionist_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ai_config_id uuid REFERENCES ai_configurations(id) ON DELETE SET NULL,
  title text,
  last_message_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ai_messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT ai_messages_sender_type_check 
    CHECK (sender_type IN ('user', 'ai'))
);

-- Enable RLS
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Policies for ai_configurations
CREATE POLICY "Nutritionists can manage their AI config"
  ON ai_configurations
  FOR ALL
  TO authenticated
  USING (
    nutritionist_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'Nutritionist'
    )
  )
  WITH CHECK (
    nutritionist_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND user_type = 'Nutritionist'
    )
  );

CREATE POLICY "Premium clients can view AI configs"
  ON ai_configurations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.user_id = auth.uid() 
        AND us.status = 'active'
        AND sp.features ? 'ai_mentoring'
    )
  );

-- Policies for ai_conversations
CREATE POLICY "Premium clients can create AI conversations"
  ON ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.user_id = auth.uid() 
        AND us.status = 'active'
        AND sp.features ? 'ai_mentoring'
    )
  );

CREATE POLICY "Users can view their own AI conversations"
  ON ai_conversations
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR nutritionist_id = auth.uid());

CREATE POLICY "Users can update their AI conversations"
  ON ai_conversations
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid() OR nutritionist_id = auth.uid());

-- Policies for ai_messages
CREATE POLICY "Premium clients can send messages"
  ON ai_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      JOIN user_subscriptions us ON us.user_id = ac.client_id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE ac.id = ai_messages.conversation_id
        AND ac.client_id = auth.uid()
        AND us.status = 'active'
        AND sp.features ? 'ai_mentoring'
    )
  );

CREATE POLICY "Users can view messages from their conversations"
  ON ai_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id
        AND (ac.client_id = auth.uid() OR ac.nutritionist_id = auth.uid())
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_configurations_nutritionist 
  ON ai_configurations(nutritionist_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_client 
  ON ai_conversations(client_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_nutritionist 
  ON ai_conversations(nutritionist_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_message 
  ON ai_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation 
  ON ai_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at 
  ON ai_messages(created_at);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ai_configurations_updated_at'
  ) THEN
    CREATE TRIGGER update_ai_configurations_updated_at
      BEFORE UPDATE ON ai_configurations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ai_conversations_updated_at'
  ) THEN
    CREATE TRIGGER update_ai_conversations_updated_at
      BEFORE UPDATE ON ai_conversations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create trigger to update last_message_at in ai_conversations
CREATE OR REPLACE FUNCTION update_ai_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ai_conversation_last_message_trigger'
  ) THEN
    CREATE TRIGGER update_ai_conversation_last_message_trigger
      AFTER INSERT ON ai_messages
      FOR EACH ROW EXECUTE FUNCTION update_ai_conversation_last_message();
  END IF;
END $$;