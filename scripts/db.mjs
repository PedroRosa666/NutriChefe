// Migrations no banco de produção pela Supabase CLI (projeto já ligado em supabase/.temp).
//   npm run db:status  -> mostra o que falta rodar (não muda nada)
//   npm run db:push    -> roda as migrations novas
// A senha do banco vem da variável SUPABASE_DB_PASSWORD (no Windows, também a da conta do usuário,
// para valer sem reabrir o terminal). Ela nunca é impressa.
import { execFileSync, spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (mode !== 'status' && mode !== 'push') {
  console.error('Uso: node scripts/db.mjs status|push');
  process.exit(2);
}

let password = process.env.SUPABASE_DB_PASSWORD;
if (!password && process.platform === 'win32') {
  password = execFileSync(
    'powershell',
    ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('SUPABASE_DB_PASSWORD','User')"],
    { encoding: 'utf8' },
  ).trim();
}
if (!password) {
  console.error('Defina a variável SUPABASE_DB_PASSWORD com a senha do banco.');
  process.exit(1);
}

const args = ['-y', 'supabase@latest', 'db', 'push', '--linked', mode === 'status' ? '--dry-run' : '--yes'];
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, SUPABASE_DB_PASSWORD: password },
});
process.exit(result.status ?? 1);
