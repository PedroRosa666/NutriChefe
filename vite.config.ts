import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Testes nunca falam com o Supabase de verdade: valores fictícios, mesmo sem .env.
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_ANON_KEY: 'test-placeholder' },
    // Os testes de banco sobem um Postgres em memória por arquivo: com a máquina ocupada, 5 s não bastam.
    testTimeout: 20_000,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em arquivos separados: mudam pouco, então o navegador
        // reaproveita o cache entre deploys do app.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
