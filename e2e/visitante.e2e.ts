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

  // O formulário fala com o Supabase Auth: a política de conteúdo (CSP) não pode barrar a chamada.
  // Senha errada de propósito: não precisa de conta, e a resposta 400 do servidor é a esperada.
  test('login com senha errada chega ao servidor e mostra o aviso', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/login');
    const dialog = page.getByRole('dialog');
    await dialog.locator('#email').fill('e2e-conta-inexistente@example.com');
    await dialog.locator('#password').fill('senha-errada-de-teste');
    await dialog.locator('button[type=submit]').click();
    await expect(page.getByText('E-mail ou senha incorretos.').first()).toBeVisible();
    expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
  });
});
