/*
  # Registro de erros do app

  Quando uma tela quebra no navegador de alguém, o app grava aqui a mensagem, onde aconteceu
  e o navegador. Ninguém lê pelo app: consulte no Supabase (Table Editor > client_errors ou SQL).

  - Qualquer visitante pode gravar (erros também acontecem antes do login), mas não pode ler.
  - Limites de tamanho em cada campo; o app manda no máximo 10 erros por visita.
  - Faxina automática: erros com mais de 30 dias são apagados.
*/

CREATE TABLE IF NOT EXISTS client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  message text NOT NULL CHECK (char_length(message) <= 500),
  stack text NOT NULL DEFAULT '' CHECK (char_length(stack) <= 4000),
  url text NOT NULL DEFAULT '' CHECK (char_length(url) <= 500),
  user_agent text NOT NULL DEFAULT '' CHECK (char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors(created_at DESC);

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reports errors" ON client_errors;
CREATE POLICY "Anyone reports errors"
  ON client_errors FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

REVOKE SELECT, UPDATE, DELETE ON client_errors FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prune_client_errors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM client_errors WHERE created_at < now() - interval '30 days';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_client_errors ON client_errors;
CREATE TRIGGER trg_prune_client_errors
  AFTER INSERT ON client_errors
  FOR EACH STATEMENT EXECUTE FUNCTION public.prune_client_errors();
