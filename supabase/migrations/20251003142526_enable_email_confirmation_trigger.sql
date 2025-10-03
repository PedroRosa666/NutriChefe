/*
  # Configuração de Email Confirmation e Auto-criação de Profile

  1. Funções
    - `handle_new_user` - Cria automaticamente um profile quando um usuário confirma o email
  
  2. Triggers
    - Dispara após confirmação de email para criar profile automaticamente
  
  3. Segurança
    - Garante que todo usuário autenticado tenha um profile
    - Profile só é criado após confirmação de email
*/

-- Função para criar profile automaticamente após confirmação de email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir profile apenas se o email foi confirmado
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
      COALESCE(NEW.raw_user_meta_data->>'user_type', 'Client')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger para auto-criar profile após confirmação
CREATE TRIGGER on_auth_user_created
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentário explicativo
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Cria automaticamente um profile na tabela public.profiles quando um usuário confirma seu email';
