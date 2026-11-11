import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { CLIENT_CONTRACT } from './src/lib/client-contract.ts';
import { SECURITY_HEADERS } from './worker/security-headers.ts';

// Arquivo _headers do build (Cloudflare): cache dos arquivos estáticos + as proteções de
// worker/security-headers.ts em todas as respostas.
const HEADERS_FILE = `# Gerado no build por vite.config.ts. Não edite em dist: mude lá ou em worker/security-headers.ts.

# Arquivos do build têm hash no nome: podem ficar no cache do navegador por 1 ano.
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# O service worker precisa ser conferido a cada visita, senão atualizações do app demoram a chegar.
/sw.js
  Cache-Control: no-cache

# Contrato do site no ar, lido pelo aviso de atualização: sempre o do último deploy.
/version.json
  Cache-Control: no-cache

/*
${Object.entries(SECURITY_HEADERS).map(([name, value]) => `  ${name}: ${value}`).join('\n')}
`;

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
        this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS_FILE });
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
  // Os testes de tela locais rodam com a mesma política de conteúdo do site publicado.
  preview: { headers: SECURITY_HEADERS },
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
