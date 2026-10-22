import { describe, expect, it } from 'vitest';
import { amountForCalories, nutrientsFor, quantityLabel, searchFoods, suggestEquivalents } from '../food-math';
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

describe('amountForCalories', () => {
  it('usa a medida caseira quando fica perto', () => {
    const pao = food({ id: 'pao', kcal: 253, measures: [{ label: '1 fatia', grams: 25 }] });
    // 127 kcal = ~50 g = 2 fatias
    expect(amountForCalories(pao, 127)).toMatchObject({ grams: 50, label: '2 × 1 fatia (50 g)' });
  });
  it('sem medida, arredonda os gramas de 5 em 5', () => {
    expect(amountForCalories(food({ kcal: 124 }), 150)).toMatchObject({ grams: 120, label: '120 g' });
  });
});

describe('suggestEquivalents', () => {
  const arroz = food({ id: 'arroz' });
  const integral = food({ id: 'macarrao', name: 'Macarrão, trigo, cozido', kcal: 102, protein: 3.4, carbs: 19.9, fat: 1.2 });
  const queijo = food({ id: 'queijo', name: 'Queijo, minas', kcal: 264, protein: 17.4, carbs: 3.2, fat: 20.2 });
  const batata = food({ id: 'batata', name: 'Batata, cozida', category: 'Verduras', kcal: 52, protein: 1.2, carbs: 11.9, fat: 0 });
  it('mesmo grupo, mesmas calorias, macros mais parecidos primeiro', () => {
    const list = suggestEquivalents(arroz, 100, [arroz, queijo, integral, batata]);
    expect(list.map((p) => p.food.id)).toEqual(['macarrao', 'queijo']);
    // 124 kcal de macarrão (102 kcal/100 g) = ~122 g -> 120 g
    expect(list[0].grams).toBe(120);
  });
});
