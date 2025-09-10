/*
  # Fix AI Messages RLS Policy

  1. Policy Changes
    - Update the INSERT policy for ai_messages to properly check user permissions
    - Allow both nutritionists and premium clients to send messages
    - Ensure proper validation of conversation ownership

  2. Security
    - Maintain RLS protection
    - Verify user has access to the conversation before allowing message creation
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Premium clients can send messages" ON ai_messages;

-- Create a new policy that allows both nutritionists and premium clients
CREATE POLICY "Users can send messages to their AI conversations"
  ON ai_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM ai_conversations ac
      WHERE ac.id = ai_messages.conversation_id
      AND (
        -- User is the client in the conversation
        ac.client_id = auth.uid()
        OR
        -- User is the nutritionist in the conversation
        ac.nutritionist_id = auth.uid()
      )
    )
  );