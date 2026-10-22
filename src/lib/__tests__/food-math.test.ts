import { describe, expect, it } from 'vitest';
import { nutrientsFor, quantityLabel, searchFoods } from '../food-math';
import { cleanExtraNutrients, scaleExtraNutrients } from '../nutrients';
import type { Food } from '../../services/foods';

const food = (over: Partial<Food>): Food => ({
  id: 'x',
  taco_id: 1,
  owner_id: null,
  name: 'Arroz, integral, cozido',
  category: 'Cereais e derivados',
  kcal: 124,
  protein: 2.6,
  carbs: 25.8,
  fat: 1,
  fiber: 2.7,
  sodium: 1,
  nutrients: {},
  measures: [],
  ...over,
});

describe('nutrientsFor', () => {
  it('usa os valores da TACO por 100 g', () => {
    expect(nutrientsFor(food({}), 100)).toEqual({ calories: 124, protein: 2.6, carbs: 25.8, fat: 1, fiber: 2.7 });
  });

  it('escala proporcionalmente à quantidade', () => {
    // 2 colheres de sopa de arroz integral (50 g)
    expect(nutrientsFor(food({}), 50)).toEqual({ calories: 62, protein: 1.3, carbs: 12.9, fat: 0.5, fiber: 1.4 });
    // 1 concha de feijão carioca cozido (140 g): 76 kcal, 4,8 g de proteína por 100 g
    expect(nutrientsFor(food({ kcal: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5 }), 140)).toEqual({
      calories: 106, protein: 6.7, carbs: 19, fat: 0.7, fiber: 11.9,
    });
  });
});

describe('quantityLabel', () => {
  it('mostra a medida caseira com o peso total', () => {
    expect(quantityLabel(1, { label: '1 fatia', grams: 25 })).toBe('1 fatia (25 g)');
    expect(quantityLabel(2, { label: '1 fatia', grams: 25 })).toBe('2 × 1 fatia (50 g)');
    expect(quantityLabel(150, null)).toBe('150 g');
  });
});

describe('searchFoods', () => {
  const foods = [
    food({ id: 'a', name: 'Frango, peito, sem pele, grelhado' }),
    food({ id: 'b', name: 'Frango, coração, grelhado' }),
    food({ id: 'c', name: 'Pão, trigo, francês' }),
    food({ id: 'd', taco_id: null, owner_id: 'n1', name: 'Frango desfiado temperado da casa' }),
  ];

  it('acha por palavras em qualquer ordem e sem acento', () => {
    expect(searchFoods(foods, 'peito frango').map((f) => f.id)).toEqual(['a']);
    expect(searchFoods(foods, 'pao frances').map((f) => f.id)).toEqual(['c']);
  });

  it('mostra primeiro os alimentos do nutricionista', () => {
    expect(searchFoods(foods, 'frango')[0].id).toBe('d');
  });
});

describe('nutrientes completos', () => {
  it('descarta chaves desconhecidas e valores não analisados', () => {
    expect(cleanExtraNutrients({ calcium: 8, iron: '', vitaminC: null, foo: 3, zinc: '1.4' })).toEqual({ calcium: 8, zinc: 1.4 });
  });

  it('escala minerais e vitaminas mantendo a precisão', () => {
    expect(scaleExtraNutrients({ calcium: 8, iron: 0.3, thiamin: 0.08 }, 150)).toEqual({ calcium: 12, iron: 0.45, thiamin: 0.12 });
  });
});
