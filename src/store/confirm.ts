import { create } from 'zustand';

interface ConfirmRequest {
  message: string;
  resolve: (ok: boolean) => void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  answer: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  answer: (ok) => {
    get().request?.resolve(ok);
    set({ request: null });
  },
}));

/**
 * Caixa de confirmação no visual do app (no lugar de window.confirm, que tem a aparência
 * do navegador e trava a página). Resolve true se a pessoa confirmar.
 */
export function confirmDialog(message: string): Promise<boolean> {
  // Uma pergunta por vez: se já havia outra aberta, ela conta como cancelada.
  useConfirmStore.getState().request?.resolve(false);
  return new Promise((resolve) => useConfirmStore.setState({ request: { message, resolve } }));
}
