/*
  # Sistema de Mentoria IA

  1. Novas Tabelas
    - `subscription_plans` - Planos de assinatura disponíveis
    - `user_subscriptions` - Assinaturas ativas dos usuários
    - `ai_configurations` - Configurações da IA por nutricionista
    - `ai_conversations` - Conversas com a IA
    - `ai_messages` - Mensagens das conversas com IA

  2. Segurança
    - Enable RLS em todas as tabelas
    - Políticas para controle de acesso baseado em assinatura
    - Políticas para nutricionistas gerenciarem suas configurações de IA

  3. Funcionalidades
    - Sistema de assinatura premium
    - Configuração personalizada da IA por nutricionista
    - Histórico de conversas com IA
    - Controle de acesso baseado em plano
*/

-- Tabela de planos de assinatura
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  billing_period text NOT NULL DEFAULT 'monthly',
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de assinaturas dos usuários
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  auto_renew boolean DEFAULT true,
  payment_method text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_subscriptions_status_check CHECK (status IN ('active', 'cancelled', 'expired', 'pending'))
);

-- Tabela de configurações da IA por nutricionista
CREATE TABLE IF NOT EXISTS ai_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ai_name text NOT NULL DEFAULT 'NutriBot',
  personality text NOT NULL DEFAULT 'empathetic',
  custom_instructions text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ai_configurations_personality_check CHECK (personality IN ('empathetic', 'scientific', 'friendly', 'professional')),
  CONSTRAINT ai_configurations_nutritionist_unique UNIQUE (nutritionist_id)
);

-- Tabela de conversas com IA
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

-- Tabela de mensagens da IA
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ai_messages_sender_type_check CHECK (sender_type IN ('user', 'ai'))
);

-- Inserir planos padrão
INSERT INTO subscription_plans (name, description, price, features) VALUES
('Básico', 'Acesso básico às receitas e funcionalidades essenciais', 0.00, '["recipe_access", "favorites", "basic_profile"]'::jsonb),
('Premium', 'Acesso completo incluindo Mentoria IA e funcionalidades avançadas', 19.90, '["recipe_access", "favorites", "advanced_profile", "ai_mentoring", "priority_support", "advanced_analytics"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Dar assinatura básica para todos os usuários existentes
INSERT INTO user_subscriptions (user_id, plan_id, status)
SELECT 
  p.id,
  (SELECT id FROM subscription_plans WHERE name = 'Básico' LIMIT 1),
  'active'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_subscriptions us WHERE us.user_id = p.id
);

-- Criar configuração padrão da IA para todos os nutricionistas
INSERT INTO ai_configurations (nutritionist_id, ai_name, personality, custom_instructions)
SELECT 
  p.id,
  'NutriBot',
  'empathetic',
  'Sempre seja prestativo e incentive hábitos alimentares saudáveis. Lembre o cliente de consultar seu nutricionista para planos alimentares personalizados.'
FROM profiles p
WHERE p.user_type = 'Nutritionist'
AND NOT EXISTS (
  SELECT 1 FROM ai_configurations ac WHERE ac.nutritionist_id = p.id
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_configurations_nutritionist ON ai_configurations(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_client ON ai_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_nutritionist ON ai_conversations(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_last_message ON ai_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- Habilitar RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para subscription_plans
CREATE POLICY "Anyone can view active plans"
  ON subscription_plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Políticas para user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Políticas para ai_configurations
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

-- Políticas para ai_conversations
CREATE POLICY "Users can view their own AI conversations"
  ON ai_conversations
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR 
    nutritionist_id = auth.uid()
  );

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

CREATE POLICY "Users can update their AI conversations"
  ON ai_conversations
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid() OR nutritionist_id = auth.uid());

-- Políticas para ai_messages
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

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_configurations_updated_at
  BEFORE UPDATE ON ai_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar last_message_at nas conversas
CREATE OR REPLACE FUNCTION update_ai_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_conversation_last_message_trigger
  AFTER INSERT ON ai_messages
  FOR EACH ROW EXECUTE FUNCTION update_ai_conversation_last_message();