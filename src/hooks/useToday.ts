import { useSyncExternalStore } from 'react';
import { toISODate } from '../store/nutrition-tracking';

// "Hoje" (AAAA-MM-DD local) compartilhado pelas telas. O app pode ficar dias aberto (aba,
// app instalado em segundo plano): sem isto, metas, diário e plano continuavam no dia em que
// a tela abriu. Troca à meia-noite e quando o app volta à frente.
let today = toISODate(new Date());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function check() {
  const now = toISODate(new Date());
  if (now !== today) {
    today = now;
    listeners.forEach((l) => l());
  }
  schedule();
}

function schedule() {
  clearTimeout(timer);
  const next = new Date();
  next.setHours(24, 0, 1, 0);
  timer = setTimeout(check, next.getTime() - Date.now());
}

function onVisible() {
  if (document.visibilityState === 'visible') check();
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    // O relógio pode ter mudado enquanto ninguém ouvia.
    today = toISODate(new Date());
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    }
  };
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, () => today);
}
