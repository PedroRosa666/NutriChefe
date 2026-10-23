// Erros das funções do painel viram uma frase do idioma atual.
// Os erros do Supabase não são instâncias de Error: a mensagem vem em `message`.
export function adminErrorText(error: unknown, a: { errorsMap: Record<string, string>; actionError: string }): string {
  const message = String((error as { message?: string } | null)?.message ?? '');
  const key = Object.keys(a.errorsMap).find((k) => message.includes(k));
  return key ? a.errorsMap[key] : a.actionError;
}
