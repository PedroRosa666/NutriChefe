import { expect, test } from '@playwright/test';
import { openAs, openPatient, toast } from './helpers';

// Nutricionista e paciente em sessões separadas: o que um faz aparece para o outro sem recarregar.
test.describe('tempo real', () => {
  test('mensagens chegam nos dois sentidos', async ({ browser }) => {
    const nutri = await openAs(browser, 'nutri');
    const patient = await openAs(browser, 'patient', { width: 390, height: 844 });
    await patient.page.goto('/perfil?tab=messages');
    await expect(patient.page.getByText(/Conversa com/)).toBeVisible();

    const patientId = await openPatient(nutri.page, 'summary');
    await nutri.page.goto(`/perfil?tab=messages&com=${patientId}`);

    const toPatient = `E2E nutri ${Date.now()}`;
    const nutriBox = nutri.page.locator('#conteudo textarea, #conteudo input[type=text]').last();
    await nutriBox.fill(toPatient);
    await nutriBox.press('Enter');
    // A mensagem aparece na conversa e na notificação ao vivo: basta a primeira.
    await expect(patient.page.getByText(toPatient).first()).toBeVisible({ timeout: 10_000 });

    const toNutri = `E2E paciente ${Date.now()}`;
    const patientBox = patient.page.locator('#conteudo textarea, #conteudo input[type=text]').last();
    await patientBox.fill(toNutri);
    await patientBox.press('Enter');
    await expect(nutri.page.getByText(toNutri).first()).toBeVisible({ timeout: 10_000 });

    expect([...nutri.errors, ...patient.errors]).toEqual([]);
    await nutri.context.close();
    await patient.context.close();
  });

  test('pedido de troca do paciente aparece para o nutricionista', async ({ browser }) => {
    const nutri = await openAs(browser, 'nutri');
    const patient = await openAs(browser, 'patient', { width: 390, height: 844 });
    await openPatient(nutri.page, 'plan');
    const swaps = nutri.page.locator('#conteudo section').filter({ hasText: 'Pedidos de troca' }).first();
    await expect(swaps).toBeVisible();

    await patient.page.goto('/perfil?tab=plan');
    await patient.page.getByRole('button', { name: 'Trocar' }).first().click();
    const dialog = patient.page.getByRole('dialog').last();
    const reason = `E2E troca ${Date.now()}`;
    await dialog.locator('textarea').last().fill(reason);
    await dialog.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(toast(patient.page).filter({ hasText: 'Pedido enviado' })).toBeVisible();

    await expect(swaps).toContainText(reason, { timeout: 10_000 });
    expect([...nutri.errors, ...patient.errors]).toEqual([]);
    await nutri.context.close();
    await patient.context.close();
  });
});
