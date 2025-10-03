/*
  # Permitir Acesso Público às Receitas

  1. Alterações
    - Remover política antiga que requer autenticação para ver receitas
    - Adicionar nova política que permite acesso anônimo para visualizar receitas
  
  2. Funcionalidades
    - Usuários não autenticados podem visualizar receitas (acesso limitado)
    - Usuários autenticados têm acesso completo (criar, editar, avaliar, favoritar)
  
  3. Segurança
    - Apenas visualização é permitida sem autenticação
    - Todas as operações de escrita requerem autenticação
*/

-- Remover política antiga que requer autenticação
DROP POLICY IF EXISTS "Todos podem ver receitas" ON recipes;
DROP POLICY IF EXISTS "Usuários autenticados podem ver receitas" ON recipes;

-- Criar nova política permitindo acesso público para leitura
CREATE POLICY "Qualquer pessoa pode visualizar receitas"
  ON recipes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Garantir que criação ainda requer autenticação
DROP POLICY IF EXISTS "Usuários autenticados podem criar receitas" ON recipes;

CREATE POLICY "Usuários autenticados podem criar receitas"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Garantir que atualização ainda requer ser o autor
DROP POLICY IF EXISTS "Autores podem atualizar suas receitas" ON recipes;

CREATE POLICY "Autores podem atualizar suas receitas"
  ON recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Garantir que deleção ainda requer ser o autor
DROP POLICY IF EXISTS "Autores podem deletar suas receitas" ON recipes;

CREATE POLICY "Autores podem deletar suas receitas"
  ON recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Também permitir acesso público para visualizar avaliações
DROP POLICY IF EXISTS "Todos podem ver avaliações" ON reviews;

CREATE POLICY "Qualquer pessoa pode visualizar avaliações"
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Também permitir acesso público para visualizar perfis (nomes dos autores)
DROP POLICY IF EXISTS "Usuários podem ver todos os perfis" ON profiles;

CREATE POLICY "Qualquer pessoa pode visualizar perfis públicos"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);
