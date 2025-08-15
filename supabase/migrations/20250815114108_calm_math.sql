/*
  # Create Mentoring System Tables

  This migration creates all the necessary tables for the mentoring system:
  
  1. New Tables
    - `mentoring_relationships` - Relationships between nutritionists and clients
    - `conversations` - Chat conversations within mentoring relationships
    - `messages` - Individual messages in conversations
    - `client_goals` - Goals set for clients
    - `goal_progress` - Progress tracking for goals
    - `mentoring_sessions` - Scheduled mentoring sessions

  2. Security
    - Enable RLS on all tables
    - Create appropriate policies for data access
    - Ensure users can only access their own data

  3. Indexes and Triggers
    - Performance indexes on frequently queried columns
    - Automatic timestamp updates
    - Conversation last message tracking
*/

-- Create mentoring_relationships table
CREATE TABLE IF NOT EXISTS mentoring_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nutritionist_id, client_id)
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentoring_relationship_id uuid NOT NULL REFERENCES mentoring_relationships(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create client_goals table
CREATE TABLE IF NOT EXISTS client_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nutritionist_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('weight_loss', 'weight_gain', 'muscle_gain', 'health_improvement', 'nutrition_education', 'custom')),
  title text NOT NULL,
  description text,
  target_value numeric,
  current_value numeric DEFAULT 0,
  unit text,
  target_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create goal_progress table
CREATE TABLE IF NOT EXISTS goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES client_goals(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create mentoring_sessions table
CREATE TABLE IF NOT EXISTS mentoring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentoring_relationship_id uuid NOT NULL REFERENCES mentoring_relationships(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  meeting_link text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE mentoring_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mentoring_relationships
DROP POLICY IF EXISTS "Users can view their mentoring relationships" ON mentoring_relationships;
CREATE POLICY "Users can view their mentoring relationships"
  ON mentoring_relationships FOR SELECT
  TO authenticated
  USING (auth.uid() = nutritionist_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "Nutritionists can create relationships" ON mentoring_relationships;
CREATE POLICY "Nutritionists can create relationships"
  ON mentoring_relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = nutritionist_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Nutritionist')
  );

DROP POLICY IF EXISTS "Participants can update relationships" ON mentoring_relationships;
CREATE POLICY "Participants can update relationships"
  ON mentoring_relationships FOR UPDATE
  TO authenticated
  USING (auth.uid() = nutritionist_id OR auth.uid() = client_id);

-- RLS Policies for conversations
DROP POLICY IF EXISTS "Users can view conversations from their relationships" ON conversations;
CREATE POLICY "Users can view conversations from their relationships"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can create conversations" ON conversations;
CREATE POLICY "Participants can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- RLS Policies for messages
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;
CREATE POLICY "Users can view messages from their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
      WHERE c.id = conversation_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
      WHERE c.id = conversation_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can mark messages as read" ON messages;
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
      WHERE c.id = conversation_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- RLS Policies for client_goals
DROP POLICY IF EXISTS "Users can view related goals" ON client_goals;
CREATE POLICY "Users can view related goals"
  ON client_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = nutritionist_id);

DROP POLICY IF EXISTS "Clients can create their goals" ON client_goals;
CREATE POLICY "Clients can create their goals"
  ON client_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Authorized users can update goals" ON client_goals;
CREATE POLICY "Authorized users can update goals"
  ON client_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = nutritionist_id);

-- RLS Policies for goal_progress
DROP POLICY IF EXISTS "Users can view progress of related goals" ON goal_progress;
CREATE POLICY "Users can view progress of related goals"
  ON goal_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_goals cg 
      WHERE cg.id = goal_id 
      AND (cg.client_id = auth.uid() OR cg.nutritionist_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authorized users can record progress" ON goal_progress;
CREATE POLICY "Authorized users can record progress"
  ON goal_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = recorded_by AND
    EXISTS (
      SELECT 1 FROM client_goals cg 
      WHERE cg.id = goal_id 
      AND (cg.client_id = auth.uid() OR cg.nutritionist_id = auth.uid())
    )
  );

-- RLS Policies for mentoring_sessions
DROP POLICY IF EXISTS "Participants can view mentoring sessions" ON mentoring_sessions;
CREATE POLICY "Participants can view mentoring sessions"
  ON mentoring_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Nutritionists can create sessions" ON mentoring_sessions;
CREATE POLICY "Nutritionists can create sessions"
  ON mentoring_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND mr.nutritionist_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can update sessions" ON mentoring_sessions;
CREATE POLICY "Participants can update sessions"
  ON mentoring_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_nutritionist ON mentoring_relationships(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_client ON mentoring_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_relationship ON conversations(mentoring_relationship_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_client_goals_client ON client_goals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_nutritionist ON client_goals(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_sessions_relationship ON mentoring_sessions(mentoring_relationship_id);

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_mentoring_relationships_updated_at ON mentoring_relationships;
CREATE TRIGGER update_mentoring_relationships_updated_at
  BEFORE UPDATE ON mentoring_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_goals_updated_at ON client_goals;
CREATE TRIGGER update_client_goals_updated_at
  BEFORE UPDATE ON client_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mentoring_sessions_updated_at ON mentoring_sessions;
CREATE TRIGGER update_mentoring_sessions_updated_at
  BEFORE UPDATE ON mentoring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_message_at in conversations
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update last_message_at
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Function to update current_value in client_goals
CREATE OR REPLACE FUNCTION update_goal_current_value()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE client_goals 
  SET current_value = NEW.value,
      updated_at = now()
  WHERE id = NEW.goal_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update current_value
DROP TRIGGER IF EXISTS update_goal_current_value_trigger ON goal_progress;
CREATE TRIGGER update_goal_current_value_trigger
  AFTER INSERT ON goal_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();