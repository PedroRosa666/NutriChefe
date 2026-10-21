// Leitura de quantidades nas linhas de ingredientes ("2 xícaras de farinha",
// "1/2 colher de sal", "200g de morango", "Sal a gosto"): usada para ajustar
// porções e somar a lista de compras.

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125,
};

// Unidades reconhecidas (forma normalizada -> variações). A ordem importa: mais longas primeiro.
const UNITS: [string, RegExp][] = [
  ['kg', /^(kg|quilos?|kilos?)\b\.?/i],
  ['g', /^(g|gr|gramas?)\b\.?/i],
  ['ml', /^(ml|mililitros?)\b\.?/i],
  ['l', /^(l|litros?)\b\.?/i],
  ['xícara', /^(x[ií]caras?|xic\.?|cups?)\b/i],
  ['colher de sopa', /^(colher(es)?\s+de\s+sopa|colher(es)?\s*\(sopa\)|c\.?\s*s\.?|tbsp)\b/i],
  ['colher de chá', /^(colher(es)?\s+de\s+ch[aá]|colher(es)?\s*\(ch[aá]\)|c\.?\s*c\.?|tsp)\b/i],
  ['colher', /^colher(es)?\b/i],
  ['copo', /^copos?\b/i],
  ['lata', /^latas?\b/i],
  ['pitada', /^pitadas?\b/i],
  ['dente', /^dentes?\b/i],
  ['fatia', /^fatias?\b/i],
  ['unidade', /^(unidades?|un\.?)\b/i],
  ['maço', /^ma[cç]os?\b/i],
  ['pacote', /^pacotes?\b/i],
];

export interface ParsedIngredient {
  /** Quantidade no início da linha; null quando não há ("Sal a gosto"). */
  quantity: number | null;
  unit: string | null;
  /** Nome sem quantidade/unidade ("farinha de trigo"). */
  name: string;
  /** Texto original. */
  raw: string;
}

const NUMBER_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½⅓⅔¼¾⅕⅛]?|[½⅓⅔¼¾⅕⅛])/;

function parseNumber(token: string): number | null {
  const t = token.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const uni = t.match(/^(\d+(?:[.,]\d+)?)?\s*([½⅓⅔¼¾⅕⅛])$/);
  if (uni) return (uni[1] ? Number(uni[1].replace(',', '.')) : 0) + UNICODE_FRACTIONS[uni[2]];
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseIngredient(raw: string): ParsedIngredient {
  let rest = raw.trim().replace(/^[-•*]\s*/, '');
  const match = rest.match(NUMBER_RE);
  let quantity: number | null = null;
  if (match) {
    quantity = parseNumber(match[1]);
    rest = rest.slice(match[0].length).trim();
  }

  let unit: string | null = null;
  if (quantity !== null) {
    for (const [name, re] of UNITS) {
      const m = rest.match(re);
      if (m) {
        unit = name;
        rest = rest.slice(m[0].length).trim();
        break;
      }
    }
    rest = rest.replace(/^(de|do|da|dos|das)\s+/i, '');
  }

  return { quantity, unit, name: rest || raw.trim(), raw };
}

/** 1,5 -> "1 ½"; 0,333 -> "⅓"; 250 -> "250"; 1,25 -> "1 ¼". */
export function formatQuantity(value: number): string {
  if (value >= 10) return String(Math.round(value));
  const whole = Math.floor(value);
  const frac = value - whole;
  const candidates: [number, string][] = [
    [0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, ''],
  ];
  const [best, symbol] = candidates.reduce((a, b) => (Math.abs(b[0] - frac) < Math.abs(a[0] - frac) ? b : a));
  if (Math.abs(best - frac) > 0.06) {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }
  const w = best === 1 ? whole + 1 : whole;
  if (!symbol) return String(w);
  return w > 0 ? `${w} ${symbol}` : symbol;
}

/** Reescreve a linha com a quantidade multiplicada; linhas sem número ficam iguais. */
export function scaleIngredient(raw: string, factor: number): string {
  if (factor === 1) return raw;
  const parsed = parseIngredient(raw);
  if (parsed.quantity === null) return raw;
  const scaled = parsed.quantity * factor;
  const original = raw.trim().replace(/^[-•*]\s*/, '');
  const match = original.match(NUMBER_RE);
  if (!match) return raw;
  // Mantém o espaçamento original ("200g" -> "400g", "2 xícaras" -> "4 xícaras").
  const gap = /\s$/.test(match[0]) ? ' ' : '';
  return `${formatQuantity(scaled)}${gap}${original.slice(match[0].length)}`;
}

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[,.;].*$/, '')
    .replace(/\b(picad[oa]s?|ralad[oa]s?|fresc[oa]s?|maduros?|maduras?|cortad[oa]s?|em cubos|a gosto|opcional)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/s$/, '');

export interface ShoppingItem {
  id: string;
  name: string;
  /** Ex.: "500 g", "2 xícara + 3 colher de sopa"; vazio quando não há quantidade. */
  quantity: string;
  checked: boolean;
  recipes: string[];
}

export interface ShoppingSource {
  title: string;
  ingredients: string[];
  /** Multiplicador das quantidades (porções pedidas / porções da receita). */
  factor: number;
}

/** Soma ingredientes de várias receitas, juntando o mesmo item na mesma unidade. */
export function buildShoppingItems(sources: ShoppingSource[]): ShoppingItem[] {
  const groups = new Map<string, { name: string; amounts: Map<string, number>; loose: boolean; recipes: Set<string> }>();

  for (const source of sources) {
    for (const line of source.ingredients) {
      if (!line.trim()) continue;
      const parsed = parseIngredient(line);
      const key = normalizeName(parsed.name) || parsed.name.toLowerCase();
      const group = groups.get(key) ?? { name: parsed.name.replace(/\s*\(.*?\)/g, '').trim(), amounts: new Map(), loose: false, recipes: new Set() };
      if (parsed.quantity === null) group.loose = true;
      else {
        // g e kg somam juntos; ml e l também.
        let unit = parsed.unit ?? '';
        let qty = parsed.quantity * source.factor;
        if (unit === 'kg') { unit = 'g'; qty *= 1000; }
        if (unit === 'l') { unit = 'ml'; qty *= 1000; }
        group.amounts.set(unit, (group.amounts.get(unit) ?? 0) + qty);
      }
      group.recipes.add(source.title);
      groups.set(key, group);
    }
  }

  return [...groups.entries()]
    .map(([key, g]) => {
      const parts = [...g.amounts.entries()].map(([unit, qty]) => {
        if (unit === 'g' && qty >= 1000) return `${formatQuantity(qty / 1000)} kg`;
        if (unit === 'ml' && qty >= 1000) return `${formatQuantity(qty / 1000)} l`;
        return unit ? `${formatQuantity(qty)} ${unit}` : formatQuantity(qty);
      });
      return {
        id: key,
        name: g.name.charAt(0).toUpperCase() + g.name.slice(1),
        quantity: parts.join(' + '),
        checked: false,
        recipes: [...g.recipes],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Junta uma lista nova à existente sem perder o que já foi marcado. */
export function mergeShoppingItems(current: ShoppingItem[], added: ShoppingItem[]): ShoppingItem[] {
  const byId = new Map(current.map((i) => [i.id, { ...i }]));
  for (const item of added) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    existing.quantity = [existing.quantity, item.quantity].filter(Boolean).join(' + ');
    existing.recipes = [...new Set([...existing.recipes, ...item.recipes])];
    existing.checked = false;
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Minutos citados num passo ("asse por 25 minutos", "1 hora"), para o timer do modo cozinha. */
export function findStepMinutes(step: string): number | null {
  const text = step.toLowerCase();
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*(h\b|horas?)/);
  const minutes = text.match(/(\d+)\s*(?:a\s*\d+\s*)?(min\b|minutos?)/);
  let total = 0;
  if (hours) total += Number(hours[1].replace(',', '.')) * 60;
  if (minutes) total += Number(minutes[1]);
  return total > 0 ? Math.round(total) : null;
}
