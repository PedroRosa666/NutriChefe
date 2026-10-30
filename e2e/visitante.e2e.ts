import { expect, test } from '@playwright/test';
import { watchConsole } from './helpers';

test.describe('sem login', () => {
  test('perfil pede login com Entrar em destaque', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/perfil');
    await expect(page.getByRole('heading', { name: 'Entre para ver seu perfil.' })).toBeVisible();
    const entrar = page.getByRole('link', { name: 'Entrar' });
    await expect(entrar).toHaveAttribute('href', /\/login\?next=%2Fperfil/);
    await expect(entrar).toHaveClass(/bg-emerald-600/);
    expect(errors).toEqual([]);
  });

  test('link de convite deixa Cadastrar em destaque e leva ao cadastro', async ({ page }) => {
    await page.goto('/perfil?convite=e2e');
    await expect(page.getByRole('heading', { name: 'Seu nutricionista convidou você' })).toBeVisible();
    const cadastrar = page.getByRole('link', { name: 'Cadastrar' });
    await expect(cadastrar).toHaveClass(/bg-emerald-600/);
    await cadastrar.click();
    await expect(page).toHaveURL(/modo=cadastro.*convite%3De2e/);
    await expect(page.getByRole('dialog')).toContainText('Criar conta');
  });
});
