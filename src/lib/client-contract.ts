/**
 * Versão do contrato com o banco que este app entende. Sobe junto com a migração que muda o formato
 * dos dados (a função app_min_client() do banco devolve a mínima aceita).
 * 3: refeições personalizadas (20261106120000_custom_meals.sql).
 * 4: rendimento, porção e ingredientes das receitas (20261107120000_recipe_yield.sql).
 * 5: valores calculados pelos ingredientes (20261108120000_recipe_calc.sql).
 *
 * O build publica o mesmo número em /version.json (vite.config.ts): é o que o site no ar entende.
 */
export const CLIENT_CONTRACT = 5;

export type UpdateCheck = 'current' | 'reload' | 'deploy_behind';

/**
 * O que fazer quando o banco pede um contrato (minClient) e o site no ar publica outro (published):
 * - 'current': este app atende o banco; nada a mostrar.
 * - 'reload': o site no ar já atende o banco; recarregar resolve, então o aviso aparece.
 * - 'deploy_behind': nem o site no ar atende (migração aplicada antes do deploy, ou deploy falhou).
 *   Recarregar não resolve: sem aviso para quem usa, só um erro no console para quem publica.
 * published null: não deu para ler o /version.json (sem rede, ambiente de desenvolvimento).
 */
export function updateCheck(minClient: number, published: number | null, running = CLIENT_CONTRACT): UpdateCheck {
  if (minClient <= running) return 'current';
  return published !== null && published >= minClient ? 'reload' : 'deploy_behind';
}
