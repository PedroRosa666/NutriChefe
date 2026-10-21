// Alimentos comuns para registrar no diário sem precisar de uma receita.
// Valores aproximados por porção, baseados na Tabela TACO (UNICAMP) e em
// rótulos médios. Servem para acompanhamento, não para prescrição.

export interface CommonFood {
  id: string;
  pt: string;
  en: string;
  /** Porção de referência mostrada ao lado do nome. */
  portionPt: string;
  portionEn: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

const f = (
  id: string, pt: string, en: string, portionPt: string, portionEn: string,
  calories: number, protein: number, carbs: number, fat: number, fiber: number,
): CommonFood => ({ id, pt, en, portionPt, portionEn, calories, protein, carbs, fat, fiber });

export const COMMON_FOODS: CommonFood[] = [
  f('arroz-branco', 'Arroz branco cozido', 'White rice, cooked', '4 colheres (100 g)', '4 tbsp (100 g)', 128, 2.5, 28.1, 0.2, 1.6),
  f('arroz-integral', 'Arroz integral cozido', 'Brown rice, cooked', '4 colheres (100 g)', '4 tbsp (100 g)', 124, 2.6, 25.8, 1, 2.7),
  f('feijao', 'Feijão carioca cozido', 'Pinto beans, cooked', '1 concha (140 g)', '1 ladle (140 g)', 106, 6.7, 19, 0.7, 11.9),
  f('macarrao', 'Macarrão cozido', 'Pasta, cooked', '1 prato raso (150 g)', '1 plate (150 g)', 237, 8.7, 46, 1.4, 2.7),
  f('batata-doce', 'Batata-doce cozida', 'Sweet potato, boiled', '150 g', '150 g', 116, 0.9, 27.6, 0.2, 3.6),
  f('batata', 'Batata inglesa cozida', 'Potato, boiled', '150 g', '150 g', 78, 1.8, 17.7, 0, 1.9),
  f('cuscuz', 'Cuscuz de milho', 'Corn couscous', '100 g', '100 g', 113, 2.2, 25.3, 0.7, 2.1),
  f('tapioca', 'Tapioca (só a massa)', 'Tapioca crepe (plain)', '1 unidade (60 g de goma)', '1 crepe (60 g)', 145, 0, 36, 0, 0.3),
  f('pao-frances', 'Pão francês', 'French bread roll', '1 unidade (50 g)', '1 roll (50 g)', 150, 4, 29, 1.5, 1.2),
  f('pao-integral', 'Pão integral', 'Whole wheat bread', '2 fatias (50 g)', '2 slices (50 g)', 127, 4.7, 24.8, 1.7, 3.4),
  f('pao-de-queijo', 'Pão de queijo', 'Cheese bread', '2 unidades (40 g)', '2 pieces (40 g)', 145, 2.1, 13.7, 9.1, 0.3),
  f('aveia', 'Aveia em flocos', 'Rolled oats', '2 colheres de sopa (30 g)', '2 tbsp (30 g)', 118, 4.4, 20, 2.6, 2.9),
  f('granola', 'Granola', 'Granola', '40 g', '40 g', 170, 4, 27, 5.5, 3.2),
  f('ovo-cozido', 'Ovo cozido', 'Boiled egg', '1 unidade (50 g)', '1 egg (50 g)', 73, 6.7, 0.3, 4.8, 0),
  f('ovo-frito', 'Ovo frito', 'Fried egg', '1 unidade', '1 egg', 120, 7.8, 0.6, 9.7, 0),
  f('frango', 'Peito de frango grelhado', 'Grilled chicken breast', '100 g', '100 g', 159, 32, 0, 2.5, 0),
  f('carne', 'Carne bovina magra grelhada', 'Lean beef, grilled', '100 g', '100 g', 219, 35.9, 0, 7.3, 0),
  f('peixe', 'Filé de peixe grelhado', 'Grilled fish fillet', '100 g', '100 g', 128, 26, 0, 2.7, 0),
  f('salada', 'Salada de folhas', 'Leafy green salad', '1 prato (50 g)', '1 plate (50 g)', 8, 0.7, 1.2, 0.1, 1),
  f('tomate', 'Tomate', 'Tomato', '1 unidade (100 g)', '1 tomato (100 g)', 15, 1.1, 3.1, 0.2, 1.2),
  f('brocolis', 'Brócolis cozido', 'Broccoli, cooked', '100 g', '100 g', 25, 2.1, 4.4, 0.5, 3.4),
  f('cenoura', 'Cenoura crua', 'Raw carrot', '1 unidade (70 g)', '1 carrot (70 g)', 24, 0.9, 5.4, 0.1, 2.2),
  f('banana', 'Banana prata', 'Banana', '1 unidade (70 g)', '1 banana (70 g)', 69, 0.9, 18.2, 0.1, 1.4),
  f('maca', 'Maçã', 'Apple', '1 unidade (130 g)', '1 apple (130 g)', 73, 0.4, 19.9, 0.1, 1.7),
  f('mamao', 'Mamão papaia', 'Papaya', '½ unidade (150 g)', '½ papaya (150 g)', 60, 0.8, 15.6, 0.2, 1.5),
  f('laranja', 'Laranja', 'Orange', '1 unidade (180 g)', '1 orange (180 g)', 67, 1.8, 16.5, 0.2, 1.4),
  f('morango', 'Morango', 'Strawberries', '10 unidades (120 g)', '10 berries (120 g)', 36, 1.1, 8.2, 0.4, 2),
  f('abacate', 'Abacate', 'Avocado', '2 colheres de sopa (60 g)', '2 tbsp (60 g)', 58, 0.7, 3.6, 5, 3.8),
  f('leite-integral', 'Leite integral', 'Whole milk', '1 copo (200 ml)', '1 glass (200 ml)', 122, 6.2, 9.4, 6.6, 0),
  f('leite-desnatado', 'Leite desnatado', 'Skim milk', '1 copo (200 ml)', '1 glass (200 ml)', 70, 6.8, 9.8, 0.2, 0),
  f('iogurte', 'Iogurte natural', 'Plain yogurt', '1 pote (170 g)', '1 cup (170 g)', 104, 6.5, 7.8, 5.1, 0),
  f('queijo-minas', 'Queijo minas frescal', 'Fresh white cheese', '1 fatia (30 g)', '1 slice (30 g)', 79, 5.2, 1, 6, 0),
  f('mussarela', 'Queijo muçarela', 'Mozzarella', '2 fatias (30 g)', '2 slices (30 g)', 99, 6.8, 0.9, 7.6, 0),
  f('requeijao', 'Requeijão', 'Cream cheese spread', '1 colher de sopa (30 g)', '1 tbsp (30 g)', 79, 2.9, 0.7, 7.2, 0),
  f('manteiga', 'Manteiga', 'Butter', '1 colher de chá (10 g)', '1 tsp (10 g)', 73, 0, 0, 8.2, 0),
  f('azeite', 'Azeite de oliva', 'Olive oil', '1 colher de sopa (13 ml)', '1 tbsp (13 ml)', 117, 0, 0, 13, 0),
  f('castanha', 'Castanha-do-pará', 'Brazil nuts', '3 unidades (12 g)', '3 nuts (12 g)', 77, 1.7, 1.8, 7.6, 0.9),
  f('amendoim', 'Amendoim torrado', 'Roasted peanuts', '30 g', '30 g', 163, 8.2, 6.1, 13, 2.4),
  f('whey', 'Whey protein', 'Whey protein', '1 dose (30 g)', '1 scoop (30 g)', 120, 24, 3, 1.5, 0),
  f('cafe', 'Café sem açúcar', 'Black coffee', '1 xícara (50 ml)', '1 cup (50 ml)', 2, 0.1, 0.3, 0, 0),
  f('cafe-acucar', 'Café com açúcar', 'Coffee with sugar', '1 xícara (50 ml)', '1 cup (50 ml)', 33, 0.1, 8.3, 0, 0),
  f('suco-laranja', 'Suco de laranja natural', 'Fresh orange juice', '1 copo (200 ml)', '1 glass (200 ml)', 66, 1.4, 15.2, 0.2, 0.4),
  f('refrigerante', 'Refrigerante', 'Soda', '1 lata (350 ml)', '1 can (350 ml)', 149, 0, 37, 0, 0),
  f('chocolate', 'Chocolate ao leite', 'Milk chocolate', '25 g', '25 g', 135, 1.8, 15, 7.5, 0.5),
  f('pizza', 'Pizza de muçarela', 'Cheese pizza', '1 fatia (100 g)', '1 slice (100 g)', 270, 11, 30, 11, 1.8),
];
