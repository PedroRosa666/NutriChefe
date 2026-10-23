// Conquistas (todos) e desafios da semana (Premium) a partir dos números de my_progress()
// (20261030120000_client_premium.sql). Regras puras, sem acesso ao banco, para testar fácil.

export interface Progress {
  diary_days: number;
  streak: number;
  best_streak: number;
  weight_logs: number;
  weight_change: number | null;
  ate_meals: number;
  reviews: number;
  favorites: number;
  week: {
    start: string;
    diary_days: number;
    ate_meals: number;
    weigh_ins: number;
    /** null = sem meta de proteína definida. */
    protein_days: number | null;
    /** null = sem meta de calorias definida. */
    calorie_days: number | null;
  };
}

export type AchievementKey =
  | 'firstLog'
  | 'streak7'
  | 'streak30'
  | 'diary30'
  | 'diary100'
  | 'firstWeigh'
  | 'weigh10'
  | 'lost2'
  | 'lost5'
  | 'meals10'
  | 'meals50'
  | 'reviewer'
  | 'favorites5';

export interface Achievement {
  key: AchievementKey;
  /** Quanto falta: valor atual e alvo (para a barra das conquistas ainda bloqueadas). */
  value: number;
  target: number;
  unlocked: boolean;
}

export type ChallengeKey = 'logDays' | 'ateMeals' | 'weighIn' | 'proteinDays' | 'calorieDays';

export interface Challenge {
  key: ChallengeKey;
  value: number;
  target: number;
  done: boolean;
}

const item = <K extends string>(key: K, value: number, target: number) => ({
  key,
  value: Math.max(0, Math.min(value, target)),
  target,
});

/** Lista de conquistas; as de perda de peso só aparecem para quem tem o objetivo de emagrecer. */
export function achievementsFor(p: Progress, goal: string | null | undefined): Achievement[] {
  const lost = p.weight_change !== null && p.weight_change < 0 ? -p.weight_change : 0;
  const list = [
    item('firstLog' as const, p.diary_days, 1),
    item('streak7' as const, p.best_streak, 7),
    item('streak30' as const, p.best_streak, 30),
    item('diary30' as const, p.diary_days, 30),
    item('diary100' as const, p.diary_days, 100),
    item('firstWeigh' as const, p.weight_logs, 1),
    item('weigh10' as const, p.weight_logs, 10),
    ...(goal === 'lose' ? [item('lost2' as const, Math.floor(lost * 10) / 10, 2), item('lost5' as const, Math.floor(lost * 10) / 10, 5)] : []),
    item('meals10' as const, p.ate_meals, 10),
    item('meals50' as const, p.ate_meals, 50),
    item('reviewer' as const, p.reviews, 1),
    item('favorites5' as const, p.favorites, 5),
  ];
  return list.map((a) => ({ ...a, unlocked: a.value >= a.target }));
}

/** Desafios da semana (segunda a domingo); os de meta só entram se a meta existir. */
export function weeklyChallenges(p: Progress, hasPlan: boolean): Challenge[] {
  const w = p.week;
  const list = [
    item('logDays' as const, w.diary_days, 5),
    ...(hasPlan ? [item('ateMeals' as const, w.ate_meals, 14)] : []),
    item('weighIn' as const, w.weigh_ins, 1),
    ...(w.protein_days !== null ? [item('proteinDays' as const, w.protein_days, 3)] : []),
    ...(w.calorie_days !== null ? [item('calorieDays' as const, w.calorie_days, 4)] : []),
  ];
  return list.map((c) => ({ ...c, done: c.value >= c.target }));
}
