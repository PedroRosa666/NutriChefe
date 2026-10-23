import { useTranslation } from './useTranslation';

/** Saudação do período do dia, pelo relógio do aparelho. */
export function useGreeting(): string {
  const u = useTranslation().profileUi;
  const hour = new Date().getHours();
  return hour < 12 ? u.morning : hour < 18 ? u.afternoon : u.evening;
}
