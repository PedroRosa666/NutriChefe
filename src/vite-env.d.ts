/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Chave pública VAPID das notificações no celular (a privada fica só nos segredos do Supabase). */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

