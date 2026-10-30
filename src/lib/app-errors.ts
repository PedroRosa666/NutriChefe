// Erros com código estável. As funções do banco levantam o código como mensagem
// (RAISE EXCEPTION 'version_conflict'); a tela traduz pelo código, nunca procurando palavras
// soltas no texto da exceção.
import type { Translations } from './i18n/translations';

const APP_ERROR_CODES = [
  'not_authenticated',
  'not_allowed',
  'version_conflict',
  'operation_conflict',
  'validation_failed',
  'resource_archived',
  'temporarily_unavailable',
  'premium_required',
  'app_outdated',
  'limit_exceeded',
  'invalid_yield',
  'demo_readonly',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number] | 'unknown';

const NETWORK = /Failed to fetch|NetworkError|Load failed|network|timeout|FunctionsFetchError/i;

/** Código do erro: o que o banco levantou, o código do Postgres equivalente ou falha de rede. */
export function errorCode(error: unknown): AppErrorCode {
  if (!error) return 'unknown';
  const e = error as { message?: unknown; code?: unknown; name?: unknown; status?: unknown };
  const message = String(e.message ?? error).trim();
  if ((APP_ERROR_CODES as readonly string[]).includes(message)) return message as AppErrorCode;
  switch (e.code) {
    case '42501':
      return 'not_allowed';
    case '23514':
    case '22P02':
    case '22023':
      return 'validation_failed';
    case '40001':
      return 'version_conflict';
  }
  if (e.status === 401) return 'not_authenticated';
  if (NETWORK.test(message) || NETWORK.test(String(e.name ?? '')) || (typeof e.status === 'number' && e.status >= 500)) {
    return 'temporarily_unavailable';
  }
  return 'unknown';
}

type AppErrorTexts = Translations['appErrors'];

/** Frase para a pessoa, no idioma atual. */
export function errorText(error: unknown, texts: AppErrorTexts): string {
  return texts[errorCode(error)];
}
