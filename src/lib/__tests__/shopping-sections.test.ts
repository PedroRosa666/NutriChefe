import { describe, expect, it } from 'vitest';
import { sectionOf } from '../shopping-sections';

describe('sectionOf', () => {
  it('separa os itens pelas seções do mercado', () => {
    expect(sectionOf('Tomates')).toBe('produce');
    expect(sectionOf('Peito de frango')).toBe('protein');
    expect(sectionOf('Ovos')).toBe('protein');
    expect(sectionOf('Leite integral')).toBe('dairy');
    expect(sectionOf('Pão de queijo')).toBe('bakery');
    expect(sectionOf('Arroz integral')).toBe('pantry');
    expect(sectionOf('Sal')).toBe('spices');
    expect(sectionOf('Detergente')).toBe('other');
  });

  it('expressões compostas vencem a palavra solta', () => {
    expect(sectionOf('Leite de coco')).toBe('pantry');
    expect(sectionOf('Creme de leite')).toBe('pantry');
    expect(sectionOf('Molho de tomate')).toBe('pantry');
    expect(sectionOf('Salmão')).toBe('protein');
    expect(sectionOf('Pimentão vermelho')).toBe('produce');
    expect(sectionOf('Melão')).toBe('produce');
  });
});
