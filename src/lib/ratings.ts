/**
 * Nota média de um conjunto de receitas, pesando pela quantidade de avaliações de cada uma
 * (igual à média de todas as avaliações), sem precisar baixar as avaliações.
 */
export function averageRating(recipes: { rating: number | null; review_count: number | null }[]): number {
  let sum = 0;
  let count = 0;
  for (const r of recipes) {
    const n = Number(r.review_count) || 0;
    sum += (Number(r.rating) || 0) * n;
    count += n;
  }
  return count ? sum / count : 0;
}
