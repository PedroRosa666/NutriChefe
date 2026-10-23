// Depois de uma publicação, quem estava com o app aberto ainda tem a versão antiga, que pede
// arquivos que não existem mais (ao abrir uma aba ou um modal). Em vez da tela de erro,
// recarrega uma vez para pegar a versão nova.

const KEY = 'nc-stale-reload';
const WINDOW_MS = 30_000;

/** Erro de "arquivo da versão antiga não encontrado" (Chrome, Safari e Firefox). */
export function isStaleBuildError(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading chunk/i.test(
    message
  );
}

/** Recarrega a página, no máximo uma vez a cada 30 s (evita ficar em loop se o problema for outro). */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* sem sessionStorage: recarrega mesmo assim */
  }
  window.location.reload();
  return true;
}

export function installStaleBuildRecovery() {
  // O Vite avisa quando não consegue carregar um pedaço do app.
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleBuildError(event.reason) && reloadForNewBuild()) event.preventDefault();
  });
}
