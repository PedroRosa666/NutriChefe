// Banco de produção pela Supabase CLI (projeto já ligado em supabase/.temp).
//   npm run db:status               -> mostra as migrations que faltam rodar (não muda nada)
//   npm run db:push                 -> roda as migrations novas
//   npm run db:query -- arquivo.sql -> executa um arquivo SQL (carga de dados, conferência). Mudança
//                                      de estrutura continua sendo migration, nunca por aqui.
// A senha do banco vem da variável SUPABASE_DB_PASSWORD (no Windows, também a da conta do usuário,
// para valer sem reabrir o terminal). Ela nunca é impressa.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CLI = 'supabase@3.1.0';
const [mode, file] = process.argv.slice(2);
if (!['status', 'push', 'query'].includes(mode) || (mode === 'query' && !file)) {
  console.error('Uso: node scripts/db.mjs status|push|query <arquivo.sql>');
  process.exit(2);
}
if (mode === 'query' && !existsSync(file)) {
  console.error(`Arquivo não encontrado: ${file}`);
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

const windows = process.platform === 'win32';
// Com shell (Windows), caminho com espaço precisa ir entre aspas.
const quoted = (value) => (windows ? `"${value}"` : value);
const args =
  mode === 'query'
    ? ['-y', CLI, 'db', 'query', '--remote', '--file', quoted(file), '--yes']
    : ['-y', CLI, 'db', 'push', '--linked', mode === 'status' ? '--dry-run' : '--yes'];
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: windows,
  env: { ...process.env, SUPABASE_DB_PASSWORD: password },
});
process.exit(result.status ?? 1);
