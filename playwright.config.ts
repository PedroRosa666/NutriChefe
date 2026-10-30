import { defineConfig } from '@playwright/test';

// Testes de tela (e2e). Padrão: build local servido em http://localhost:4173 (mesmo Supabase do
// site, pela demonstração). E2E_BASE_URL=https://nutrichef.app.br testa o site publicado.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const local = baseURL.startsWith('http://localhost');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Uma demonstração por rodada (o site limita quantas começam do mesmo lugar): tudo em sequência.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  globalSetup: './e2e/global-setup.ts',
  outputDir: 'e2e-results',
  use: {
    baseURL,
    // Edge já instalado no Windows: sem baixar navegador. Sempre escondido (sem janela).
    channel: 'msedge',
    headless: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: local
    ? { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: baseURL, reuseExistingServer: true, timeout: 180_000 }
    : undefined,
});
