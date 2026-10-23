import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
}

// Sem o tipo `Database`: o arquivo antigo descrevia só 4 tabelas (e uma que nem existe), e a
// versão nova do supabase-js trata o que falta como `never`. Os tipos de cada consulta ficam
// nos serviços; o certo é gerar o tipo do banco (`supabase gen types`) e voltar a usá-lo aqui.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);