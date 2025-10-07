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

const unavailableTargets = new Map<string, unknown>();

function createUnavailableProxy(path: string[] = []): any {
  const cacheKey = path.join('.');
  if (unavailableTargets.has(cacheKey)) {
    return unavailableTargets.get(cacheKey);
  }

  const proxy = new Proxy(function noop() {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined;
      }

      if (prop === Symbol.toStringTag) {
        return 'SupabaseUnavailable';
      }

      return createUnavailableProxy([...path, String(prop)]);
    },
    apply() {
      const error = initializationError || new Error('Supabase client indisponível.');
      const method = path.join('.') || 'supabase';

      console.warn(`Supabase não configurado. Chamada a ${method} foi ignorada.`, error);

      if (path[path.length - 1] === 'onAuthStateChange') {
        return {
          data: {
            subscription: {
              unsubscribe() {
                /* noop */
              }
            }
          },
          error
        };
      }

      return Promise.reject(error);
    }
  });

  unavailableTargets.set(cacheKey, proxy);
  return proxy;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    if (!client) {
      return createUnavailableProxy([String(prop)]);
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