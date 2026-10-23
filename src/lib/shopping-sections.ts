// Seção do mercado de cada item da lista de compras, pelo nome (palavras comuns no Brasil).
// A primeira seção que bater ganha: a ordem importa ("leite de coco" é mercearia, não laticínio).
import { normalizeText } from '../../supabase/functions/_shared/recipe-search';

export type ShoppingSection = 'produce' | 'protein' | 'dairy' | 'bakery' | 'pantry' | 'spices' | 'other';

export const SECTION_ORDER: ShoppingSection[] = ['produce', 'protein', 'dairy', 'bakery', 'pantry', 'spices', 'other'];

const RULES: [ShoppingSection, string[]][] = [
  ['pantry', ['leite de coco', 'leite condensado', 'creme de leite', 'leite em po', 'oleo', 'azeite', 'acucar', 'mel', 'cacau', 'chocolate', 'achocolatado', 'gelatina', 'fermento', 'amido', 'maisena', 'polvilho', 'tapioca', 'farinha', 'feijao', 'lentilha', 'grao de bico', 'ervilha seca', 'arroz', 'macarrao', 'massa', 'aveia', 'granola', 'castanha', 'amendoa', 'nozes', 'amendoim', 'chia', 'linhaca', 'gergelim', 'semente', 'pasta de', 'atum', 'sardinha', 'milho em conserva', 'extrato', 'molho de tomate', 'cafe', 'cha', 'coco ralado', 'uva passa', 'whey', 'proteina em po', 'colageno']],
  ['spices', ['sal', 'pimenta', 'oregano', 'cominho', 'paprica', 'curry', 'acafrao', 'curcuma', 'canela', 'noz moscada', 'cravo', 'louro', 'alecrim', 'tomilho', 'manjericao seco', 'shoyu', 'molho ingles', 'vinagre', 'mostarda', 'ketchup', 'maionese', 'caldo', 'tempero', 'baunilha', 'essencia', 'gengibre em po', 'alho em po', 'chimichurri', 'pimentao em po']],
  ['protein', ['frango', 'peito', 'coxa', 'sobrecoxa', 'carne', 'patinho', 'alcatra', 'acem', 'file', 'musculo', 'costela', 'porco', 'lombo', 'linguica', 'bacon', 'presunto', 'peru', 'peixe', 'tilapia', 'salmao', 'bacalhau', 'camarao', 'merluza', 'ovo', 'ovos', 'clara', 'gema', 'tofu', 'carne moida', 'hamburguer']],
  ['bakery', ['pao', 'paes', 'torrada', 'bisnaguinha', 'tortilha', 'wrap', 'rap10', 'biscoito', 'bolacha', 'cereal', 'cuscuz', 'flocao']],
  ['dairy', ['leite', 'iogurte', 'queijo', 'requeijao', 'manteiga', 'creme', 'ricota', 'cottage', 'mussarela', 'parmesao', 'nata', 'kefir', 'coalhada', 'cream cheese']],
  ['produce', ['alface', 'rucula', 'agriao', 'couve', 'espinafre', 'repolho', 'brocolis', 'couve flor', 'tomate', 'cebola', 'alho', 'cenoura', 'batata', 'mandioca', 'aipim', 'inhame', 'abobora', 'abobrinha', 'berinjela', 'pepino', 'pimentao', 'chuchu', 'beterraba', 'quiabo', 'vagem', 'milho', 'ervilha', 'cogumelo', 'champignon', 'salsinha', 'cebolinha', 'coentro', 'hortela', 'manjericao', 'gengibre', 'limao', 'laranja', 'banana', 'maca', 'pera', 'uva', 'morango', 'mamao', 'manga', 'abacaxi', 'melancia', 'melao', 'abacate', 'kiwi', 'goiaba', 'maracuja', 'acerola', 'mirtilo', 'framboesa', 'amora', 'coco', 'fruta', 'legume', 'verdura', 'folhas', 'salada']],
];

const wordMatch = (text: string, word: string) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text);

export function sectionOf(name: string): ShoppingSection {
  const text = normalizeText(name);
  for (const [section, words] of RULES) {
    if (words.some((w) => wordMatch(text, w) || wordMatch(text, `${w}s`))) return section;
  }
  return 'other';
}
