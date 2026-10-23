// Cartão "Primeiros passos": escondido por usuário neste aparelho.
export const gettingStartedKey = (userId: string) => `nc-getting-started-hidden:${userId}`;

export function isGettingStartedHidden(userId: string) {
  try {
    return localStorage.getItem(gettingStartedKey(userId)) === '1';
  } catch {
    return false;
  }
}
