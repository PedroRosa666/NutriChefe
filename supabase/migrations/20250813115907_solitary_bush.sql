/*
  # Sistema de Chat e Mentoria em Tempo Real

  1. Novas Tabelas
    - `mentoring_relationships` - Relacionamentos de mentoria entre nutricionistas e clientes
    - `conversations` - Conversas entre usuários
    - `messages` - Mensagens das conversas
    - `client_goals` - Metas específicas dos clientes
    - `goal_progress` - Progresso das metas ao longo do tempo
    - `mentoring_sessions` - Sessões de mentoria agendadas

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas para garantir privacidade das conversas
    - Controle de acesso baseado em relacionamentos de mentoria

  3. Funcionalidades
    - Chat em tempo real
    - Acompanhamento de metas
    - Histórico de progresso
    - Sessões de mentoria
*/

-- Criar tabela de relacionamentos de mentoria
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

-- Criar tabela de conversas
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentoring_relationship_id uuid NOT NULL REFERENCES mentoring_relationships(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de metas dos clientes
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

-- Criar tabela de progresso das metas
CREATE TABLE IF NOT EXISTS goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES client_goals(id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de sessões de mentoria
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

-- Habilitar Row Level Security
ALTER TABLE mentoring_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para mentoring_relationships
CREATE POLICY "Usuários podem ver relacionamentos onde participam"
  ON mentoring_relationships FOR SELECT
  TO authenticated
  USING (auth.uid() = nutritionist_id OR auth.uid() = client_id);

CREATE POLICY "Nutricionistas podem criar relacionamentos"
  ON mentoring_relationships FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = nutritionist_id AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'Nutritionist')
  );

CREATE POLICY "Participantes podem atualizar relacionamentos"
  ON mentoring_relationships FOR UPDATE
  TO authenticated
  USING (auth.uid() = nutritionist_id OR auth.uid() = client_id);

-- Políticas para conversations
CREATE POLICY "Usuários podem ver conversas de seus relacionamentos"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

CREATE POLICY "Participantes podem criar conversas"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- Políticas para messages
CREATE POLICY "Usuários podem ver mensagens de suas conversas"
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

CREATE POLICY "Participantes podem enviar mensagens"
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

CREATE POLICY "Usuários podem marcar mensagens como lidas"
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
CREATE POLICY "Clientes podem ver suas próprias metas"
  ON client_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = nutritionist_id);

CREATE POLICY "Clientes podem criar suas metas"
  ON client_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clientes e nutricionistas podem atualizar metas"
  ON client_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = nutritionist_id);

-- Políticas para goal_progress
CREATE POLICY "Usuários podem ver progresso de metas relacionadas"
  ON goal_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_goals cg 
      WHERE cg.id = goal_id 
      AND (cg.client_id = auth.uid() OR cg.nutritionist_id = auth.uid())
    )
  );

CREATE POLICY "Usuários podem registrar progresso"
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
CREATE POLICY "Participantes podem ver sessões de mentoria"
  ON mentoring_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

CREATE POLICY "Nutricionistas podem criar sessões"
  ON mentoring_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND mr.nutritionist_id = auth.uid()
    )
  );

CREATE POLICY "Participantes podem atualizar sessões"
  ON mentoring_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_relationships mr 
      WHERE mr.id = mentoring_relationship_id 
      AND (mr.nutritionist_id = auth.uid() OR mr.client_id = auth.uid())
    )
  );

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_nutritionist ON mentoring_relationships(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_relationships_client ON mentoring_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_relationship ON conversations(mentoring_relationship_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_client_goals_client ON client_goals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_nutritionist ON client_goals(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_sessions_relationship ON mentoring_sessions(mentoring_relationship_id);

-- Triggers para updated_at
CREATE TRIGGER update_mentoring_relationships_updated_at
  BEFORE UPDATE ON mentoring_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_goals_updated_at
  BEFORE UPDATE ON client_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentoring_sessions_updated_at
  BEFORE UPDATE ON mentoring_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar last_message_at em conversations
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar last_message_at
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
CREATE TRIGGER update_goal_current_value_trigger
  AFTER INSERT ON goal_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();