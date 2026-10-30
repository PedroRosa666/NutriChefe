import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])';

/**
 * Leva a pessoa ao campo pedido no link (`?campo=bio`): rola até o elemento com
 * `data-field="bio"`, foca o primeiro controle dentro dele e o destaca por um instante.
 * `ready` espera o formulário carregar. O parâmetro sai da URL depois de usado.
 */
export function useFocusField(ready = true) {
  const [searchParams, setSearchParams] = useSearchParams();
  const field = searchParams.get('campo');

  useEffect(() => {
    if (!field || !ready) return;
    // A aba e o formulário montam sob demanda: espera o próximo quadro.
    const id = window.setTimeout(() => {
      const box = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
      if (box) {
        const control = box.matches(FOCUSABLE) ? box : box.querySelector<HTMLElement>(FOCUSABLE);
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        control?.focus({ preventScroll: true });
        box.classList.add('field-highlight');
        window.setTimeout(() => box.classList.remove('field-highlight'), 2400);
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('campo');
          return next;
        },
        { replace: true }
      );
    }, 120);
    return () => window.clearTimeout(id);
  }, [field, ready, setSearchParams]);
}
