/*
  # Fix AI Conversations RLS Policy

  1. Policy Changes
    - Update the INSERT policy for ai_conversations table
    - Allow both nutritionists and premium clients to create conversations
    - Nutritionists can create conversations regardless of subscription
    - Clients need active premium subscription with ai_mentoring feature

  2. Security
    - Maintain RLS protection
    - Ensure users can only create conversations where they are the client
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Premium clients can create AI conversations" ON ai_conversations;

-- Create new policy that allows both nutritionists and premium clients
CREATE POLICY "Users can create AI conversations"
  ON ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.user_type = 'Nutritionist'
      )
      OR
      EXISTS (
        SELECT 1 FROM user_subscriptions us
        JOIN subscription_plans sp ON sp.id = us.plan_id
        WHERE us.user_id = auth.uid()
          AND us.status = 'active'
          AND sp.features ? 'ai_mentoring'
      )
    )
  );