import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { CLIENT_CONTRACT } from './src/lib/client-contract.ts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      // /version.json diz qual contrato o site no ar entende: o aviso de atualização só aparece
      // quando recarregar resolve (src/components/common/UpdateBanner.tsx).
      name: 'nutrichef-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ contract: CLIENT_CONTRACT }) });
      },
    },
  ],
  test: {
    // Testes nunca falam com o Supabase de verdade: valores fictícios, mesmo sem .env.
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_ANON_KEY: 'test-placeholder' },
    // Os testes de banco sobem um Postgres em memória por arquivo e aplicam todas as migrations no
    // beforeAll: com a máquina ocupada (arquivos em paralelo), 5 s por teste e 10 s por preparo não bastam.
    testTimeout: 20_000,
    hookTimeout: 60_000,
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
