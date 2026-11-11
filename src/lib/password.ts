// Regra única de tamanho de senha para cadastro, troca e recuperação.
// Só vale para senha NOVA: quem já tem senha menor continua entrando normalmente.
// As mensagens em src/lib/i18n citam este número; ao mudar aqui, mude lá também.
export const MIN_PASSWORD_LENGTH = 8;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
