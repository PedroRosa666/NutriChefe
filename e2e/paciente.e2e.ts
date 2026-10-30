import { expect, test } from '@playwright/test';
import { openAs, toast } from './helpers';

test.describe('paciente', () => {
  test('check-in do plano lança no diário e continua depois de recarregar', async ({ browser }) => {
    const { page, errors, context } = await openAs(browser, 'patient', { width: 390, height: 844 });
    await page.goto('/perfil?tab=plan');
    const comi = page.getByRole('button', { name: 'Comi' }).first();
    await comi.click();
    await expect(comi).toHaveAttribute('aria-pressed', 'true');
    await expect(toast(page).filter({ hasText: 'lançado no diário' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Comi' }).first()).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    await context.close();
  });

  test('diário: alimento da tabela entra nas calorias do dia', async ({ browser }) => {
    const { page, errors, context } = await openAs(browser, 'patient', { width: 390, height: 844 });
    await page.goto('/perfil?tab=nutrition');
    const kcal = async () => Number((await page.locator('#conteudo').innerText()).match(/Calorias\s*([\d.]+)\s*\//)?.[1].replace('.', '') ?? NaN);
    await expect(page.getByText(/Calorias/).first()).toBeVisible();
    const before = await kcal();
    await page.getByRole('tab', { name: 'Alimento' }).click();
    await page.getByPlaceholder(/Buscar alimento/).pressSequentially('arroz carreteiro', { delay: 20 });
    await page.locator('#conteudo button', { hasText: 'Arroz carreteiro' }).first().click();
    await page.getByRole('button', { name: 'Adicionar ao diário' }).click();
    await expect(toast(page).filter({ hasText: 'Adicionado ao diário' })).toBeVisible();
    await expect.poll(kcal).toBeGreaterThan(before);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('Premium liberado: aba Conta mostra o que está incluído e não há convite a assinar', async ({ browser }) => {
    const { page, errors, context } = await openAs(browser, 'patient');
    await page.goto('/perfil?tab=account');
    await expect(page.getByText('Seu Premium está ativo')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conversar com o NutriBot' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Seja Premium' })).toHaveCount(0);
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { name: /Paciente!|Boa|Bom/ }).first()).toBeVisible();
    await expect(page.getByText('Desbloqueie o NutriBot')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
});
