import { describe, expect, it } from 'vitest';
import { matchesSearch } from '../search';
import { dietConflictLines } from '../../../supabase/functions/_shared/recipe-search';

describe('busca', () => {
  it('ignora acento, maiúsculas, pontuação e ordem das palavras', () => {
    const title = 'Salmão à Toscana';
    expect(matchesSearch('salmao', title)).toBe(true);
    expect(matchesSearch('SALMÃO', title)).toBe(true);
    expect(matchesSearch('toscana salmao', title)).toBe(true);
    expect(matchesSearch('  salmão,  ', title)).toBe(true);
    expect(matchesSearch('salmao frango', title)).toBe(false);
  });

  it('procura em todos os textos informados e aceita busca vazia', () => {
    expect(matchesSearch('creme', 'Sopa', 'Um creme leve')).toBe(true);
    expect(matchesSearch('', 'qualquer')).toBe(true);
    expect(matchesSearch('cardio', 'Ana', ['Saúde Cardiovascular'])).toBe(true);
  });
});

describe('categoria de dieta x ingredientes', () => {
  it('aponta ovo e requeijão numa receita vegana', () => {
    const lines = dietConflictLines(
      { title: 'Sanduíche Vegetariano', ingredients: ['2 fatias de pão integral', '2 colheres de requeijão light', '1 ovo cozido (ou tofu)', 'alface'] },
      'vegan'
    );
    expect(lines).toEqual(['2 colheres de requeijão light', '1 ovo cozido (ou tofu)']);
  });

  it('aceita substitutos vegetais e não confunde parecidos', () => {
    expect(dietConflictLines({ title: 'Moqueca de palmito', ingredients: ['leite de coco', 'palmito', 'azeite de dendê'] }, 'vegan')).toEqual([]);
    expect(dietConflictLines({ title: 'Melão com hortelã', ingredients: ['1 melão', 'caramelo de açúcar'] }, 'vegan')).toEqual([]);
    expect(dietConflictLines({ title: 'Omelete', ingredients: ['3 ovos', 'queijo'] }, 'vegetarian')).toEqual([]);
    expect(dietConflictLines({ title: 'Strogonoff de frango', ingredients: ['frango'] }, 'vegetarian').length).toBeGreaterThan(0);
    expect(dietConflictLines({ title: 'Nhoque', ingredients: ['farinha de trigo'] }, 'glutenFree')).toEqual(['farinha de trigo']);
    expect(dietConflictLines({ title: 'Bolo', ingredients: ['farinha de trigo'] }, 'lowCarb')).toEqual([]);
  });
});
