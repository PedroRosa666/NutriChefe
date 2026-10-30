import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Janelas abertas, da mais antiga à mais nova: só a do topo responde ao Esc e prende o Tab
// (ex.: a confirmação aberta por cima do recorte da foto).
const stack: symbol[] = [];

interface Options {
  /** Fecha a janela (Esc). Sem ele, o Esc não faz nada. */
  onClose?: () => void;
  /** Elemento que recebe o foco ao abrir; sem ele, o primeiro campo ou botão da janela. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Para janelas que ficam montadas e só aparecem quando abertas. */
  active?: boolean;
}

/**
 * Comportamento de janela de diálogo (WAI-ARIA): foco entra na janela ao abrir, o Tab fica
 * preso dentro dela, o Esc fecha e, ao fechar, o foco volta para o botão que a abriu.
 * O container recebe role="dialog", aria-modal e aria-labelledby no próprio JSX.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, { onClose, initialFocus, active = true }: Options = {}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const id = Symbol('dialog');
    stack.push(id);
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Depois da animação de entrada montar o conteúdo.
    const timer = window.setTimeout(() => {
      if (ref.current?.contains(document.activeElement)) return;
      (initialFocus?.current ?? focusables()[0] ?? ref.current)?.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = ref.current?.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [active, ref, initialFocus]);
}
