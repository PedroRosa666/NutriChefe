// npm run test:e2e:prod — os mesmos testes de tela contra o site publicado.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, E2E_BASE_URL: 'https://nutrichef.app.br' },
});
process.exit(result.status ?? 1);
