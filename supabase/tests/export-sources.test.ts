// "Baixar meus dados": cada fonte aponta para uma tabela e colunas que existem nas migrations
// (a auditoria achou ai_conversations.user_id, coluna que não existe).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }));

const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
const sql = readdirSync(dir).map((f) => readFileSync(dir + f, 'utf8').replace(/\r/g, '')).join('\n');

/** Colunas de uma tabela: as do CREATE TABLE e as de ALTER TABLE ... ADD COLUMN. */
function columnsOf(table: string): Set<string> {
  const cols = new Set<string>();
  const create = new RegExp(String.raw`CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?${table}\s*\(([\s\S]*?)\n\);`, 'g');
  for (const m of sql.matchAll(create)) {
    for (const line of m[1].split('\n')) {
      const name = line.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+[a-z]/)?.[1];
      if (name) cols.add(name);
    }
  }
  const alter = new RegExp(String.raw`ALTER TABLE (?:IF EXISTS )?(?:public\.)?${table}[^;]*?ADD COLUMN (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)`, 'g');
  for (const m of sql.matchAll(alter)) cols.add(m[1]);
  return cols;
}

describe('fontes da exportação de dados', () => {
  it('toda tabela e coluna usada existe', async () => {
    const { EXPORT_SOURCES } = await import('../../src/services/privacy');
    const problems: string[] = [];
    for (const s of EXPORT_SOURCES) {
      const cols = columnsOf(s.table);
      if (!cols.size) problems.push(`${s.table}: tabela não encontrada`);
      for (const c of s.columns) if (cols.size && !cols.has(c)) problems.push(`${s.table}.${c}`);
    }
    expect(problems).toEqual([]);
  });
});
