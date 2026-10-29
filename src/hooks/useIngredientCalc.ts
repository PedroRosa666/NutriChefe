import { useMemo } from 'react';
import { useFoodsStore } from '../store/foods';
import { calcFromIngredients, type IngredientCalc, type LineIssue } from '../lib/recipe-nutrition';
import type { RecipeIngredient } from '../types/recipe';

/** Prévia do cálculo pelos ingredientes, com o catálogo carregado (o banco refaz a conta ao salvar). */
export function useIngredientCalc(rows: RecipeIngredient[]): IngredientCalc & { issueByIndex: Map<number, LineIssue> } {
  const foods = useFoodsStore((s) => s.foods);
  return useMemo(() => {
    const calc = calcFromIngredients(rows, new Map(foods.map((f) => [f.id, f])));
    return { ...calc, issueByIndex: new Map(calc.issues.map((i) => [i.index, i.issue])) };
  }, [rows, foods]);
}
