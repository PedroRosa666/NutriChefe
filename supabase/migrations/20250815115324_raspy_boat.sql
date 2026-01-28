/*
  # Add nutritionist services configuration

  1. New Tables
    - `nutritionist_services`
      - `id` (uuid, primary key)
      - `nutritionist_id` (uuid, foreign key to profiles)
      - `service_price` (decimal)
      - `description` (text)
      - `specializations` (jsonb array)
      - `response_time` (text)
      - `requirements` (text)
      - `availability_notes` (text)
      - `is_available` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `nutritionist_services` table
    - Add policies for nutritionists to manage their services
    - Add policies for clients to view available services

  3. Indexes
    - Index on nutritionist_id for faster queries
    - Index on is_available for filtering
*/

-- Create nutritionist_services table
CREATE TABLE IF NOT EXISTS nutritionist_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_price decimal(10,2) DEFAULT 100.00,
  description text DEFAULT 'Mentoria nutricional personalizada',
  specializations jsonb DEFAULT '[]'::jsonb,
  response_time text DEFAULT '24 horas',
  requirements text DEFAULT '',
  availability_notes text DEFAULT 'Disponível de segunda a sexta',
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nutritionist_id)
);

-- Enable RLS
ALTER TABLE nutritionist_services ENABLE ROW LEVEL SECURITY;

-- Policies for nutritionist_services
CREATE POLICY "Nutritionists can manage their services"
  ON nutritionist_services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type = 'Nutritionist'
      AND profiles.id = nutritionist_services.nutritionist_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type = 'Nutritionist'
      AND profiles.id = nutritionist_services.nutritionist_id
    )
  );

CREATE POLICY "Clients can view available services"
  ON nutritionist_services
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nutritionist_services_nutritionist_id 
  ON nutritionist_services(nutritionist_id);

CREATE INDEX IF NOT EXISTS idx_nutritionist_services_available 
  ON nutritionist_services(is_available);

-- Trigger for updated_at
CREATE TRIGGER update_nutritionist_services_updated_at
  BEFORE UPDATE ON nutritionist_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add bio and avatar_url columns to profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text;
  END IF;
END $$;

-- Add last_seen column to profiles for online status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_seen timestamptz DEFAULT now();
  END IF;
END $$;

-- Add message_attachments table for file uploads
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  file_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments from their conversations"
  ON message_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
      WHERE m.id = message_attachments.message_id
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

CREATE POLICY "Users can add attachments to their messages"
  ON message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
      WHERE m.id = message_attachments.message_id
      AND m.sender_id = auth.uid()
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- Index for message_attachments
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id 
  ON message_attachments(message_id);