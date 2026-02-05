/*
  # Adicionar Perfil Profissional para Nutricionistas

  ## Descrição
  Esta migração adiciona campos específicos para nutricionistas gerenciarem seus perfis profissionais,
  permitindo que clientes visualizem informações detalhadas sobre cada profissional.

  ## Novas Colunas na Tabela `profiles`
  
  ### Informações Profissionais
  - `specializations` (text[]): Lista de especializações (ex: nutrição esportiva, clínica, emagrecimento)
  - `professional_bio` (text): Biografia/apresentação profissional
  - `years_of_experience` (integer): Anos de experiência profissional
  - `education` (text): Formação acadêmica
  - `certifications` (text[]): Certificações e cursos adicionais
  - `approach` (text): Abordagem de trabalho/filosofia profissional
  
  ### Informações de Consulta
  - `consultation_price` (decimal): Valor da consulta padrão
  - `consultation_types` (jsonb): Tipos de atendimento e valores específicos
    Exemplo: [{"type": "online", "price": 150}, {"type": "presencial", "price": 200}]
  - `consultation_duration` (integer): Duração média da consulta em minutos
  - `accepts_health_insurance` (boolean): Aceita plano de saúde
  - `health_insurances` (text[]): Lista de planos aceitos
  
  ### Informações de Contato
  - `phone` (text): Telefone para contato
  - `whatsapp` (text): WhatsApp
  - `instagram` (text): Instagram profissional
  - `website` (text): Site profissional
  - `clinic_address` (text): Endereço do consultório
  
  ### Configurações
  - `profile_visibility` (text): Visibilidade do perfil (public, private)
  - `accepting_new_clients` (boolean): Aceitando novos clientes

  ## Segurança
  - RLS já está habilitado na tabela profiles
  - Políticas existentes cobrem visualização pública e edição pelo próprio usuário
*/

-- Adicionar campos profissionais
DO $$ 
BEGIN
  -- Informações profissionais
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'specializations'
  ) THEN
    ALTER TABLE profiles ADD COLUMN specializations text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'professional_bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN professional_bio text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'years_of_experience'
  ) THEN
    ALTER TABLE profiles ADD COLUMN years_of_experience integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'education'
  ) THEN
    ALTER TABLE profiles ADD COLUMN education text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'certifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN certifications text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'approach'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approach text DEFAULT '';
  END IF;

  -- Informações de consulta
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'consultation_price'
  ) THEN
    ALTER TABLE profiles ADD COLUMN consultation_price decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'consultation_types'
  ) THEN
    ALTER TABLE profiles ADD COLUMN consultation_types jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'consultation_duration'
  ) THEN
    ALTER TABLE profiles ADD COLUMN consultation_duration integer DEFAULT 60;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'accepts_health_insurance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN accepts_health_insurance boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'health_insurances'
  ) THEN
    ALTER TABLE profiles ADD COLUMN health_insurances text[] DEFAULT '{}';
  END IF;

  -- Informações de contato
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE profiles ADD COLUMN whatsapp text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'instagram'
  ) THEN
    ALTER TABLE profiles ADD COLUMN instagram text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'website'
  ) THEN
    ALTER TABLE profiles ADD COLUMN website text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'clinic_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN clinic_address text DEFAULT '';
  END IF;

  -- Configurações
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'profile_visibility'
  ) THEN
    ALTER TABLE profiles ADD COLUMN profile_visibility text DEFAULT 'public';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'accepting_new_clients'
  ) THEN
    ALTER TABLE profiles ADD COLUMN accepting_new_clients boolean DEFAULT true;
  END IF;
END $$;