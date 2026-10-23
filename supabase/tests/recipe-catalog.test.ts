// Catálogo paginado (20261103120000_recipe_catalog.sql): contador de avaliações mantido pelo
// banco e busca/filtros no servidor, respeitando quem pode ver cada receita.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './harness';

const AUTHOR = '00000000-0000-4000-8000-00000000005a';
const READER = '00000000-0000-4000-8000-00000000005b';
let db: PGlite;

const asAnon = <T,>(fn: (tx: import('@electric-sql/pglite').Transaction) => Promise<T>) =>
  db.transaction(async (tx) => {
    await tx.exec('SET LOCAL ROLE anon');
    return fn(tx);
  });

const search = (args: string) =>
  asAnon((tx) => tx.query<{ title: string }>(`SELECT title FROM search_recipes(${args})`)).then((r) => r.rows.map((x) => x.title));

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${AUTHOR}'), ('${READER}');
    INSERT INTO profiles (id, full_name, user_type) VALUES ('${AUTHOR}', 'Chef', 'Nutritionist'), ('${READER}', 'Leitor', 'Client');
    INSERT INTO recipes (title, author_id, description, category, difficulty, prep_time, created_at) VALUES
      ('Salmão à Toscana', '${AUTHOR}', 'Peixe com molho', 'highProtein', 'hard', 30, now() - interval '3 days'),
      ('Salada de grão-de-bico', '${AUTHOR}', 'Leve e rápida', 'vegan', 'easy', 10, now() - interval '2 days'),
      ('Bolo de cenoura', '${AUTHOR}', 'Lanche da tarde', 'vegetarian', 'medium', 50, now() - interval '1 day');
  `);
});

describe('busca do catálogo no servidor', () => {
  it('sem acento, por categoria, dificuldade e tempo; mais nova primeiro', async () => {
    expect(await search(`'salmao'`)).toEqual(['Salmão à Toscana']);
    expect(await search(`'', 'vegan'`)).toEqual(['Salada de grão-de-bico']);
    expect(await search(`'', 'all', 'medium'`)).toEqual(['Bolo de cenoura']);
    expect(await search(`p_prep => 'quick'`)).toEqual(['Salada de grão-de-bico']);
    expect(await search(`''`)).toEqual(['Bolo de cenoura', 'Salada de grão-de-bico', 'Salmão à Toscana']);
  });

  it('receita escondida não aparece para visitantes', async () => {
    await db.query(`UPDATE recipes SET hidden_at = now() WHERE title = 'Bolo de cenoura'`);
    expect(await search(`''`)).not.toContain('Bolo de cenoura');
    await db.query(`UPDATE recipes SET hidden_at = NULL WHERE title = 'Bolo de cenoura'`);
  });
});

describe('contador de avaliações', () => {
  it('acompanha cada avaliação criada e apagada', async () => {
    const id = (await db.query<{ id: string }>(`SELECT id FROM recipes WHERE title = 'Bolo de cenoura'`)).rows[0].id;
    await db.query(`INSERT INTO reviews (recipe_id, user_id, rating) VALUES ($1, $2, 4), ($1, $3, 5)`, [id, READER, AUTHOR]);
    const row = async () => (await db.query<{ review_count: number; rating: string }>(`SELECT review_count, rating FROM recipes WHERE id = $1`, [id])).rows[0];
    expect(await row()).toMatchObject({ review_count: 2 });
    expect(Number((await row()).rating)).toBe(4.5);
    await db.query(`DELETE FROM reviews WHERE recipe_id = $1 AND user_id = $2`, [id, AUTHOR]);
    expect(await row()).toMatchObject({ review_count: 1 });
  });
});
