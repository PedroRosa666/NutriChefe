/*
  # Sistema Completo de Mentorias - Implementação Final

  1. Novas Tabelas
    - `mentoring_relationships` - Relacionamentos entre nutricionistas e clientes
    - `conversations` - Conversas de mentoria
    - `messages` - Mensagens do chat em tempo real
    - `client_goals` - Metas dos clientes
    - `goal_progress` - Progresso das metas
    - `mentoring_sessions` - Sessões agendadas
    - `nutritionist_services` - Configurações de serviços dos nutricionistas
    - `message_attachments` - Anexos das mensagens

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas de acesso baseadas em relacionamentos
    - Proteção de dados sensíveis

  3. Performance
    - Índices otimizados para queries frequentes
    - Triggers automáticos para atualizações
    - Funções para cálculos em tempo real
*/

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de relacionamentos de mentoria
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

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentoring_relationship_id uuid NOT NULL REFERENCES mentoring_relationships(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tabela de metas dos clientes
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

-- Tabela de progresso das metas
CREATE TABLE IF NOT EXISTS goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES client_goals(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tabela de sessões de mentoria
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

-- Tabela de serviços dos nutricionistas
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

-- Tabela de anexos das mensagens
CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  file_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Adicionar colunas necessárias ao profiles se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_seen timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Habilitar Row Level Security
ALTER TABLE mentoring_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutritionist_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas para mentoring_relationships
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

-- Políticas para conversations
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

DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- Políticas para messages
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

-- Políticas para client_goals
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

-- Políticas para goal_progress
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

-- Políticas para mentoring_sessions
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

-- Políticas para nutritionist_services
DROP POLICY IF EXISTS "Nutritionists can manage their services" ON nutritionist_services;
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

DROP POLICY IF EXISTS "Clients can view available services" ON nutritionist_services;
CREATE POLICY "Clients can view available services"
  ON nutritionist_services
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Políticas para message_attachments
DROP POLICY IF EXISTS "Users can view attachments from their conversations" ON message_attachments;
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

DROP POLICY IF EXISTS "Users can add attachments to their messages" ON message_attachments;
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_nutritionist ON mentoring_relationships(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_client ON mentoring_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_status ON mentoring_relationships(status);
CREATE INDEX IF NOT EXISTS idx_conversations_relationship ON conversations(mentoring_relationship_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
CREATE INDEX IF NOT EXISTS idx_client_goals_client ON client_goals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_nutritionist ON client_goals(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_status ON client_goals(status);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_recorded_at ON goal_progress(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentoring_sessions_relationship ON mentoring_sessions(mentoring_relationship_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_sessions_scheduled ON mentoring_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_nutritionist_services_nutritionist ON nutritionist_services(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_nutritionist_services_available ON nutritionist_services(is_available);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
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

DROP TRIGGER IF EXISTS update_nutritionist_services_updated_at ON nutritionist_services;
CREATE TRIGGER update_nutritionist_services_updated_at
  BEFORE UPDATE ON nutritionist_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar last_message_at em conversations
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar last_message_at
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Função para atualizar current_value em client_goals
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

-- Trigger para atualizar current_value
DROP TRIGGER IF EXISTS update_goal_current_value_trigger ON goal_progress;
CREATE TRIGGER update_goal_current_value_trigger
  AFTER INSERT ON goal_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();

-- Função para calcular estatísticas em tempo real
CREATE OR REPLACE FUNCTION get_nutritionist_stats(nutritionist_uuid uuid)
RETURNS TABLE (
  total_clients bigint,
  active_clients bigint,
  total_reviews bigint,
  average_rating numeric,
  total_sessions bigint,
  completed_goals bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(COUNT(DISTINCT mr.client_id), 0) as total_clients,
    COALESCE(COUNT(DISTINCT CASE WHEN mr.status = 'active' THEN mr.client_id END), 0) as active_clients,
    COALESCE(COUNT(DISTINCT r.id), 0) as total_reviews,
    COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating,
    COALESCE(COUNT(DISTINCT ms.id), 0) as total_sessions,
    COALESCE(COUNT(DISTINCT CASE WHEN cg.status = 'completed' THEN cg.id END), 0) as completed_goals
  FROM profiles p
  LEFT JOIN mentoring_relationships mr ON mr.nutritionist_id = p.id
  LEFT JOIN recipes rec ON rec.author_id = p.id
  LEFT JOIN reviews r ON r.recipe_id = rec.id
  LEFT JOIN mentoring_sessions ms ON ms.mentoring_relationship_id = mr.id
  LEFT JOIN client_goals cg ON cg.nutritionist_id = p.id
  WHERE p.id = nutritionist_uuid
  GROUP BY p.id;
END;
$$ language 'plpgsql';

-- Função para obter mensagens não lidas
CREATE OR REPLACE FUNCTION get_unread_messages_count(user_uuid uuid, conversation_uuid uuid)
RETURNS bigint AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM messages m
    WHERE m.conversation_id = conversation_uuid
    AND m.sender_id != user_uuid
    AND m.read_at IS NULL
  );
END;
$$ language 'plpgsql';

-- View para conversas com informações enriquecidas
CREATE OR REPLACE VIEW conversation_details AS
SELECT 
  c.*,
  mr.nutritionist_id,
  mr.client_id,
  mr.status as relationship_status,
  np.full_name as nutritionist_name,
  np.avatar_url as nutritionist_avatar,
  cp.full_name as client_name,
  cp.avatar_url as client_avatar,
  lm.content as last_message_content,
  lm.message_type as last_message_type,
  lm.sender_id as last_message_sender
FROM conversations c
JOIN mentoring_relationships mr ON mr.id = c.mentoring_relationship_id
LEFT JOIN profiles np ON np.id = mr.nutritionist_id
LEFT JOIN profiles cp ON cp.id = mr.client_id
LEFT JOIN LATERAL (
  SELECT content, message_type, sender_id
  FROM messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
) lm ON true;

-- Inserir dados iniciais para nutricionistas (serviços padrão)
INSERT INTO nutritionist_services (nutritionist_id, service_price, description, specializations, response_time, requirements, availability_notes, is_available)
SELECT 
  p.id,
  120.00,
  'Mentoria nutricional personalizada com acompanhamento completo e orientação profissional para alcançar seus objetivos de saúde.',
  '["Emagrecimento", "Nutrição Clínica", "Nutrição Esportiva"]'::jsonb,
  '24 horas',
  'Disponibilidade para consultas semanais e compromisso com o plano alimentar proposto.',
  'Disponível de segunda a sexta, das 8h às 18h. Atendimento de emergência aos finais de semana.',
  true
FROM profiles p
WHERE p.user_type = 'Nutritionist'
AND NOT EXISTS (
  SELECT 1 FROM nutritionist_services ns WHERE ns.nutritionist_id = p.id
);