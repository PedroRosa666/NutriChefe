import { expect, type Browser, type Page } from '@playwright/test';
import path from 'node:path';

// Fora de e2e-results (o Playwright limpa essa pasta a cada rodada): as sessões são reaproveitadas.
export const STATE_DIR = path.join('e2e', '.auth');
export const NUTRI_STATE = path.join(STATE_DIR, 'nutricionista.json');
export const PATIENT_STATE = path.join(STATE_DIR, 'paciente.json');

/** Página já logada como nutricionista ou paciente da demonstração aberta no global-setup. */
export async function openAs(browser: Browser, who: 'nutri' | 'patient', viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ storageState: who === 'nutri' ? NUTRI_STATE : PATIENT_STATE, viewport, locale: 'pt-BR' });
  const page = await context.newPage();
  const errors = watchConsole(page);
  return { context, page, errors };
}

/**
 * Erros do console que são do app. Fotos de receita hospedadas em outros sites ficam de fora:
 * quando o link cai, o app mostra a ilustração padrão (o erro de carregamento é esperado).
 */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const where = msg.location().url;
    const external = where && !/nutrichef\.app\.br|localhost|supabase\.co/.test(where);
    if (external && msg.text().startsWith('Failed to load resource')) return;
    errors.push(msg.text().replace(/apikey=[^&\s']+/g, 'apikey=…').slice(0, 200));
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export const toast = (page: Page) => page.locator('[role=status],[role=alert]');

/** Id do paciente da demonstração (o nutricionista abre a lista e entra na ficha). */
export async function openPatient(page: Page, tab: 'summary' | 'plan' = 'summary') {
  await page.goto('/perfil?tab=patients');
  await page.getByText('Paciente Demo').first().click();
  await expect(page).toHaveURL(/paciente=/);
  const url = new URL(page.url());
  if (tab === 'plan') url.searchParams.set('ver', 'plan');
  else url.searchParams.delete('ver');
  await page.goto(url.pathname + url.search);
  return url.searchParams.get('paciente')!;
}
