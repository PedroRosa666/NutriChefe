import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient<Database> | null = null;
let initializationError: Error | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient<Database>(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    initializationError = error instanceof Error
      ? error
      : new Error('Failed to initialize Supabase client');
    console.error(initializationError);
  }
} else {
  const missingVars = [
    !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
    !supabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null
  ].filter((value): value is string => Boolean(value));

  initializationError = new Error(
    `Supabase não configurado. Defina ${missingVars.join(' e ')} no arquivo .env.`
  );
  console.warn(initializationError.message);
}

export const isSupabaseConfigured = client !== null;

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    if (!client) {
      throw initializationError || new Error('Supabase client indisponível.');
    }

    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

export function assertSupabase() {
  if (!client) {
    throw initializationError || new Error('Supabase client indisponível.');
  }

  return client;
}