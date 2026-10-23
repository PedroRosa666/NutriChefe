// Quando um paciente "sumiu": a mesma regra no painel ("Precisa de atenção") e na lista de pacientes.
// Conta qualquer sinal de uso: registro no diário ou marcação de refeição do plano.

/** Dias sem registro no diário nem marcação de refeição a partir dos quais o paciente está inativo. */
const INACTIVE_DAYS = 3;

const dayStart = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();

/** A data mais recente entre as informadas (AAAA-MM-DD), ou null se nenhuma. */
export function lastActivity(...dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => !!d).map((d) => d.slice(0, 10));
  return valid.length ? valid.sort().pop()! : null;
}

/** Dias desde a data (0 = hoje), ou null se nunca houve atividade. */
export function daysSince(iso: string | null, today = new Date()): number | null {
  if (!iso) return null;
  const now = new Date(today);
  now.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - dayStart(iso)) / 86400000));
}

export const isInactive = (iso: string | null, today = new Date()) => {
  const days = daysSince(iso, today);
  return days === null || days >= INACTIVE_DAYS;
};
