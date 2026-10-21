// Animações compartilhadas: mesma curva e duração em todo o site para as
// transições parecerem parte do mesmo sistema. Só opacidade e transform
// (que a GPU anima sem recalcular layout).
import type { Transition, Variants } from 'framer-motion';

/** Desaceleração suave ("ease-out-quint"): começa rápido e assenta devagar. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const QUICK: Transition = { duration: 0.18, ease: EASE_OUT };
export const SMOOTH: Transition = { duration: 0.28, ease: EASE_OUT };

/** Troca de página: só opacidade (transform criaria um novo contexto para elementos `fixed`). */
export const pageFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: SMOOTH },
};

/** Conteúdo de abas: entra subindo 6px, sai sem atrasar a próxima. */
export const tabContent: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: SMOOTH },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: EASE_OUT } },
};

/** Fundo de modais. */
export const backdrop: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: QUICK },
  exit: { opacity: 0, transition: QUICK },
};

/** Painel de modais: aproxima levemente enquanto aparece. */
export const modalPanel: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SMOOTH },
  exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: 0.16, ease: EASE_OUT } },
};
