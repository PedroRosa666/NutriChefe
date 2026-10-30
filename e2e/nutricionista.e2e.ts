import { expect, test } from '@playwright/test';
import { openAs, openPatient } from './helpers';

test.describe('nutricionista', () => {
  test('Painel: números levam às telas e a fila de atenção aparece', async ({ browser }) => {
    const { page, errors, context } = await openAs(browser, 'nutri', { width: 1600, height: 900 });
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { name: /Nutricionista!/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Precisam de atenção/ })).toHaveAttribute('href', /filtro=atencao/);
    await expect(page.getByRole('link', { name: /Mensagens não lidas/ })).toHaveAttribute('href', /tab=messages/);
    await expect(page.getByText('Próximas consultas').or(page.getByText('Nenhuma consulta marcada'))).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });

  test('Resumo do paciente: tocar num dia mostra o dia; fora volta para a semana', async ({ browser }) => {
    const { page, errors, context } = await openAs(browser, 'nutri');
    await openPatient(page, 'summary');
    const bars = page.locator('button[aria-pressed]');
    await expect(bars).toHaveCount(7);
    // Último dia com registro (aria-label "qui: 720 kcal"); a demonstração sempre tem dias registrados.
    const labels = await bars.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    const index = labels.map((l, i) => (/: 0 kcal/.test(l) ? -1 : i)).filter((i) => i >= 0).pop();
    expect(index, 'a demonstração tem dias com registro').toBeDefined();
    const bar = bars.nth(index!);
    await bar.click();
    await expect(bar).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Total do dia')).toBeVisible();
    await expect(page.getByText(/da meta de 1\.?800 kcal/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Registros de / })).toBeVisible();
    // Fora do bloco: volta para os 7 dias.
    await page.locator('header').first().click({ position: { x: 5, y: 5 } });
    await expect(page.getByText('Média por dia registrado')).toBeVisible();
    // Esc também volta.
    await bar.click();
    await expect(page.getByText('Total do dia')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Média por dia registrado')).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });

  test('Editor do plano: metas do dia e "Gerar de novo" com aviso honesto', async ({ browser }) => {
    const { page, errors, context } = await openAs(browser, 'nutri', { width: 1400, height: 1000 });
    await openPatient(page, 'plan');
    await page.getByRole('button', { name: 'Editar' }).first().click();
    const goals = page.locator('section[aria-label="Metas do dia"]');
    await expect(goals).toContainText('Calorias');
    await expect(goals).toContainText('Fibra');

    await page.getByRole('button', { name: /Preencher plano/ }).click();
    await page.locator('button', { hasText: 'Gerar de novo' }).first().click();
    const confirm = page.locator('[role=alertdialog]');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Confirmar' }).click();
    // Sempre um aviso: gerado, gerado com divisão sugerida, ou o que passou da meta / ficou longe.
    await expect(page.locator('[role=status],[role=alert]').filter({ hasText: /Plano gerado|longe da meta/ })).toBeVisible();
    // Cada dia gerado fica a até 20% da meta de calorias.
    const kcal = await page.locator('button').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText).flatMap((t) => (/^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom|Hoje)\b/.test(t) ? [Number(t.match(/(\d+) kcal/)?.[1] ?? 0)] : []))
    );
    expect(kcal.length).toBeGreaterThan(0);
    for (const k of kcal) expect(Math.abs(k - 1800) / 1800).toBeLessThan(0.2);
    // Registro no relatório: como ficou o dia selecionado (útil para acompanhar o gerador).
    test.info().annotations.push({ type: 'metas do dia', description: (await goals.innerText()).replace(/s+/g, ' ') });

    // Não salva: descarta.
    await page.getByRole('button', { name: 'Cancelar' }).last().click();
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Confirmar' }).click();
    expect(errors).toEqual([]);
    await context.close();
  });
});
