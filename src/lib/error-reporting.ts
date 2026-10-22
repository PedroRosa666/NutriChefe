// Grava no Supabase (tabela client_errors) os erros que acontecem no navegador de quem usa o app,
// para sabermos quando algo quebra. Só em produção; no máximo 10 por visita e sem repetir a mesma mensagem.
import { supabase } from './supabase';

const MAX_PER_VISIT = 10;
const sent = new Set<string>();

export function reportError(error: unknown, context = ''): void {
  if (!import.meta.env.PROD) return;
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  const message = `${context ? `[${context}] ` : ''}${err.message || 'Erro sem mensagem'}`.slice(0, 500);
  if (sent.has(message) || sent.size >= MAX_PER_VISIT) return;
  sent.add(message);
  // Sem await e sem relançar: o registro nunca pode atrapalhar o app.
  supabase
    .from('client_errors')
    .insert({
      message,
      stack: (err.stack ?? '').slice(0, 4000),
      url: window.location.href.slice(0, 500),
      user_agent: navigator.userAgent.slice(0, 300),
    })
    .then(({ error: insertError }) => {
      if (insertError) console.warn('Could not report error:', insertError.message);
    });
}

/** Erros que escapam do React (código assíncrono, promessas sem catch). */
export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (event) => {
    // Falha ao carregar script/imagem não tem `error`; só interessa erro de código.
    if (event.error) reportError(event.error, 'window');
  });
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'));
}
