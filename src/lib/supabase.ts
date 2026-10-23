import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
}

// Tipos gerados do banco real (npm run db:types): consulta a tabela ou coluna que não existe
// não compila.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Argumento opcional de função do banco (RPC). O gerador de tipos marca todo argumento
 * como obrigatório e não nulo, mas as funções aceitam null.
 */
export const sqlArg = <T>(value: T | null | undefined): NonNullable<T> => value as NonNullable<T>;

/** Valor do app gravado numa coluna jsonb. */
export const toJson = (value: unknown): Json => value as Json;

/** Coluna jsonb (ou resposta jsonb de RPC) lida com o formato que o app grava nela. */
export const fromJson = <T>(value: Json | null | undefined): T => value as unknown as T;
