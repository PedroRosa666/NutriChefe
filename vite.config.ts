import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { CLIENT_CONTRACT } from './src/lib/client-contract.ts';

// Cabeçalhos de produção (bloco "/*" de public/_headers) também no "vite preview": os testes de tela
// rodam com a política de conteúdo valendo, e o que ela bloquear aparece antes do deploy.
function productionHeaders(): Record<string, string> {
  const lines = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trimEnd());
  const headers: Record<string, string> = {};
  for (const line of lines.slice(lines.indexOf('/*') + 1)) {
    // O bloco acaba na primeira linha sem recuo.
    if (!line.startsWith('  ')) break;
    const colon = line.indexOf(':');
    headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return headers;
}

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
  preview: { headers: productionHeaders() },
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
