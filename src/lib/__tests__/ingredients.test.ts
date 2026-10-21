import { describe, expect, it } from 'vitest';
import {
  buildShoppingItems,
  findStepMinutes,
  formatQuantity,
  mergeShoppingItems,
  parseIngredient,
  scaleIngredient,
} from '../ingredients';

describe('parseIngredient', () => {
  it('lê quantidade, unidade e nome', () => {
    expect(parseIngredient('2 xícaras de farinha de trigo')).toMatchObject({ quantity: 2, unit: 'xícara', name: 'farinha de trigo' });
    expect(parseIngredient('200g de morango')).toMatchObject({ quantity: 200, unit: 'g', name: 'morango' });
    expect(parseIngredient('1/2 colher de sopa de azeite')).toMatchObject({ quantity: 0.5, unit: 'colher de sopa', name: 'azeite' });
    expect(parseIngredient('1 1/2 xícara de leite')).toMatchObject({ quantity: 1.5, unit: 'xícara' });
    expect(parseIngredient('½ cebola')).toMatchObject({ quantity: 0.5, unit: null, name: 'cebola' });
    expect(parseIngredient('1,5 kg de batata')).toMatchObject({ quantity: 1.5, unit: 'kg', name: 'batata' });
  });

  it('linhas sem número ficam sem quantidade', () => {
    expect(parseIngredient('Sal a gosto')).toMatchObject({ quantity: null, unit: null, name: 'Sal a gosto' });
  });
});

describe('scaleIngredient', () => {
  it('multiplica mantendo o texto', () => {
    expect(scaleIngredient('2 xícaras de farinha', 2)).toBe('4 xícaras de farinha');
    expect(scaleIngredient('200g de morango', 1.5)).toBe('300g de morango');
    expect(scaleIngredient('3 ovos', 0.5)).toBe('1 ½ ovos');
    expect(scaleIngredient('1/2 colher de sal', 3)).toBe('1 ½ colher de sal');
  });

  it('não mexe em linhas sem número nem com fator 1', () => {
    expect(scaleIngredient('Sal a gosto', 2)).toBe('Sal a gosto');
    expect(scaleIngredient('2 ovos', 1)).toBe('2 ovos');
  });
});

describe('formatQuantity', () => {
  it('usa frações comuns', () => {
    expect(formatQuantity(0.5)).toBe('½');
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(1 / 3)).toBe('⅓');
    expect(formatQuantity(2.75)).toBe('2 ¾');
    expect(formatQuantity(250)).toBe('250');
  });
});

describe('buildShoppingItems', () => {
  it('soma o mesmo ingrediente na mesma unidade e converte g/kg', () => {
    const items = buildShoppingItems([
      { title: 'Bolo', ingredients: ['2 xícaras de farinha', '3 ovos', '600 g de morangos picados'], factor: 1 },
      { title: 'Panqueca', ingredients: ['1 xícara de farinha', '2 ovos', '400 g de morango'], factor: 1 },
    ]);
    const byName = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byName['farinha'].quantity).toBe('3 xícara');
    expect(byName['ovo'].quantity).toBe('5');
    expect(byName['morango'].quantity).toBe('1 kg');
    expect(byName['morango'].recipes).toEqual(['Bolo', 'Panqueca']);
  });

  it('aplica o fator de porções', () => {
    const [item] = buildShoppingItems([{ title: 'X', ingredients: ['2 ovos'], factor: 3 }]);
    expect(item.quantity).toBe('6');
  });

  it('merge preserva itens marcados e junta quantidades', () => {
    const current = buildShoppingItems([{ title: 'A', ingredients: ['2 ovos', '1 limão'], factor: 1 }]).map((i) =>
      i.id === 'limao' ? { ...i, checked: true } : i
    );
    const merged = mergeShoppingItems(current, buildShoppingItems([{ title: 'B', ingredients: ['3 ovos'], factor: 1 }]));
    expect(merged.find((i) => i.id === 'ovo')?.quantity).toBe('2 + 3');
    expect(merged.find((i) => i.id === 'limao')?.checked).toBe(true);
  });
});

describe('findStepMinutes', () => {
  it('acha minutos e horas no passo', () => {
    expect(findStepMinutes('Asse por 25 minutos em forno médio')).toBe(25);
    expect(findStepMinutes('Cozinhe por 1 hora e 15 min')).toBe(75);
    expect(findStepMinutes('Deixe descansar de 10 a 15 minutos')).toBe(10);
    expect(findStepMinutes('Misture tudo')).toBeNull();
  });
});
