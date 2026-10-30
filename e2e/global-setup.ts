import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import { NUTRI_STATE, PATIENT_STATE, STATE_DIR } from './helpers';

/**
 * Abre UMA demonstração e guarda as duas sessões (nutricionista e paciente do mesmo par) para os
 * testes reaproveitarem: o site limita quantas demonstrações começam do mesmo lugar.
 */
export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  // Sessões da última rodada com menos de 45 min: reaproveita (a demonstração ainda vale) e não gasta
  // outra do limite. E2E_NOVA_DEMO=1 força uma demonstração nova.
  const fresh = (file: string) => fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 45 * 60_000;
  if (!process.env.E2E_NOVA_DEMO && fresh(NUTRI_STATE) && fresh(PATIENT_STATE) && sameSite(NUTRI_STATE, baseURL)) return;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ baseURL, locale: 'pt-BR' });
  const page = await context.newPage();

  await page.goto('/demo');
  await page.getByRole('button', { name: /Testar como nutricionista/ }).click();
  await page.waitForURL('**/perfil**', { timeout: 45_000 }).catch(async () => {
    const toast = await page.locator('[role=status],[role=alert]').allInnerTexts();
    throw new Error(`A demonstração não abriu: ${toast.join(' / ') || 'sem mensagem'}`);
  });
  await page.getByText('você é a nutricionista').waitFor({ timeout: 30_000 });

  // Paciente do mesmo par: troca de papel, guarda a sessão dele e volta.
  await page.getByRole('button', { name: /Ver como paciente/ }).click();
  await page.getByText('você é a paciente').waitFor({ timeout: 30_000 });
  await context.storageState({ path: PATIENT_STATE });

  await page.getByRole('button', { name: /Ver como nutricionista/ }).click();
  await page.getByText('você é a nutricionista').waitFor({ timeout: 30_000 });
  await context.storageState({ path: NUTRI_STATE });

  await browser.close();
}

/** As sessões guardadas são do mesmo site (local e publicado guardam o login em origens diferentes). */
function sameSite(file: string, baseURL: string | undefined) {
  const origins: { origin: string }[] = JSON.parse(fs.readFileSync(file, 'utf8')).origins ?? [];
  return !!baseURL && origins.some((o) => baseURL.startsWith(o.origin));
}
