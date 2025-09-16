import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}min`;
  }
  return `${minutes}min`;
}

// Normalizar dificuldade baseado no texto
export function normalizeDifficulty(text: string): 'easy' | 'medium' | 'hard' | null {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (/\b(facil|faceis|simples|basica|basico|iniciante|rapida|rapido)\b/.test(normalized)) {
    return 'easy';
  }
  if (/\b(media|medio|intermediaria|intermediario|moderada|moderado)\b/.test(normalized)) {
    return 'medium';
  }
  if (/\b(dificil|dificeis|avancada|avancado|complexa|complexo|elaborada|elaborado)\b/.test(normalized)) {
    return 'hard';
  }
  
  return null;
}

// Extrair tempo de preparo em minutos
export function parsePrepTime(text: string): { min: number | null, max: number | null } {
  const normalized = text.toLowerCase();
  let min: number | null = null;
  let max: number | null = null;
  
  // Padrões específicos
  if (/\b(rapida|rapido|express|pratica|pratico)\b/.test(normalized)) {
    max = 30;
  }
  if (/\b(lenta|lento|demorada|demorado)\b/.test(normalized)) {
    min = 60;
  }
  
  // Extrair números específicos
  const timePatterns = [
    // "até 30 minutos", "no máximo 45 min"
    /(?:ate|no maximo|maximo)\s+(\d+)\s*(?:min|minuto|minutos)/g,
    // "menos de 20 minutos"
    /menos\s+de\s+(\d+)\s*(?:min|minuto|minutos)/g,
    // "entre 15 e 30 minutos"
    /entre\s+(\d+)\s+e\s+(\d+)\s*(?:min|minuto|minutos)/g,
    // "de 10 a 25 minutos"
    /de\s+(\d+)\s+a\s+(\d+)\s*(?:min|minuto|minutos)/g,
    // "30 minutos"
    /(\d+)\s*(?:min|minuto|minutos)/g,
    // "1 hora", "2 horas"
    /(\d+)\s*(?:h|hora|horas)/g
  ];
  
  for (const pattern of timePatterns) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      if (pattern.source.includes('entre') || pattern.source.includes('de\\s+')) {
        // Padrão de intervalo
        min = parseInt(match[1]);
        max = parseInt(match[2]);
      } else if (pattern.source.includes('ate') || pattern.source.includes('menos') || pattern.source.includes('maximo')) {
        // Padrão de máximo
        max = parseInt(match[1]);
        if (pattern.source.includes('hora')) max *= 60;
      } else {
        // Padrão simples
        const value = parseInt(match[1]);
        const finalValue = pattern.source.includes('hora') ? value * 60 : value;
        if (!min && !max) {
          max = finalValue + 10; // Margem de 10 minutos
        }
      }
    }
  }
  
  return { min, max };
}

// Extrair ingredientes incluídos e excluídos
export function extractIngredients(text: string): { include: string[], exclude: string[] } {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const include: string[] = [];
  const exclude: string[] = [];
  
  // Ingredientes para incluir
  const includePatterns = [
    /\b(?:com|usando|de|feito com|contendo)\s+([a-zA-Z\s,]+?)(?:\s|$|,|\.|!|\?)/g,
    /\b(frango|carne|peixe|salmao|atum|camarao|bacon|presunto|queijo|leite|ovos?|chocolate|banana|morango|tomate|cebola|alho|batata|arroz|macarrao|massa)\b/g
  ];
  
  // Ingredientes para excluir
  const excludePatterns = [
    /\b(?:sem|nao|não)\s+([a-zA-Z\s,]+?)(?:\s|$|,|\.|!|\?)/g
  ];
  
  // Mapear termos de exclusão comuns
  const exclusionMap: Record<string, string[]> = {
    'lactose': ['leite', 'queijo', 'manteiga', 'creme de leite', 'iogurte'],
    'gluten': ['trigo', 'farinha de trigo', 'aveia', 'centeio', 'cevada'],
    'carne': ['frango', 'boi', 'porco', 'peixe', 'salmao', 'atum'],
    'acucar': ['açucar', 'mel', 'xarope', 'melado']
  };
  
  for (const pattern of includePatterns) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      const ingredient = match[1]?.trim();
      if (ingredient && ingredient.length > 2) {
        include.push(ingredient);
      }
    }
  }
  
  for (const pattern of excludePatterns) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      const ingredient = match[1]?.trim();
      if (ingredient && ingredient.length > 2) {
        // Expandir exclusões baseadas no mapa
        if (exclusionMap[ingredient]) {
          exclude.push(...exclusionMap[ingredient]);
        } else {
          exclude.push(ingredient);
        }
      }
    }
  }
  
  return { include, exclude };
}

// Extrair avaliações mínimas e máximas
export function parseRatings(text: string): { min: number | null, max: number | null } {
  const normalized = text.toLowerCase();
  let min: number | null = null;
  let max: number | null = null;
  
  // Padrões de avaliação
  const ratingPatterns = [
    // "avaliação 4 para cima", "nota 3 ou mais"
    /(?:avaliacao|avaliação|nota|rating|estrela|estrelas)\s+(\d+(?:[.,]\d+)?)\s+(?:para\s+cima|ou\s+mais|acima)/g,
    // "acima de 4 estrelas"
    /acima\s+de\s+(\d+(?:[.,]\d+)?)\s*(?:estrela|estrelas|ponto|pontos)?/g,
    // "mínimo 3 estrelas"
    /(?:minimo|mínimo)\s+(\d+(?:[.,]\d+)?)\s*(?:estrela|estrelas|ponto|pontos)?/g,
    // "entre 3 e 5 estrelas"
    /entre\s+(\d+(?:[.,]\d+)?)\s+e\s+(\d+(?:[.,]\d+)?)\s*(?:estrela|estrelas|ponto|pontos)?/g,
    // "4 estrelas"
    /(\d+(?:[.,]\d+)?)\s*(?:estrela|estrelas)/g
  ];
  
  for (const pattern of ratingPatterns) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      if (pattern.source.includes('entre')) {
        // Padrão de intervalo
        min = parseFloat(match[1].replace(',', '.'));
        max = parseFloat(match[2].replace(',', '.'));
      } else if (pattern.source.includes('acima') || pattern.source.includes('para\\s+cima') || pattern.source.includes('ou\\s+mais') || pattern.source.includes('minimo')) {
        // Padrão de mínimo
        min = parseFloat(match[1].replace(',', '.'));
      } else {
        // Padrão simples - assumir como mínimo
        min = parseFloat(match[1].replace(',', '.'));
      }
    }
  }
  
  // Validar valores
  if (min !== null && (min < 1 || min > 5)) min = null;
  if (max !== null && (max < 1 || max > 5)) max = null;
  
  return { min, max };
}