import { describe, expect, it } from 'vitest';
import { achievementsFor, weeklyChallenges, type Progress } from '../achievements';

const base: Progress = {
  diary_days: 0,
  streak: 0,
  best_streak: 0,
  weight_logs: 0,
  weight_change: null,
  ate_meals: 0,
  reviews: 0,
  favorites: 0,
  week: { start: '2026-10-19', diary_days: 0, ate_meals: 0, weigh_ins: 0, protein_days: null, calorie_days: null },
};

describe('achievementsFor', () => {
  it('libera as conquistas que atingiram o alvo e limita a barra ao alvo', () => {
    const list = achievementsFor({ ...base, diary_days: 40, best_streak: 8, weight_logs: 1 }, 'maintain');
    const byKey = Object.fromEntries(list.map((a) => [a.key, a]));
    expect(byKey.firstLog.unlocked).toBe(true);
    expect(byKey.streak7.unlocked).toBe(true);
    expect(byKey.streak30).toMatchObject({ unlocked: false, value: 8, target: 30 });
    expect(byKey.diary30).toMatchObject({ unlocked: true, value: 30 });
    expect(byKey.firstWeigh.unlocked).toBe(true);
  });

  it('perda de peso só conta para quem quer emagrecer', () => {
    const p = { ...base, weight_change: -2.5 };
    expect(achievementsFor(p, 'gain').some((a) => a.key === 'lost2')).toBe(false);
    const lose = achievementsFor(p, 'lose');
    expect(lose.find((a) => a.key === 'lost2')?.unlocked).toBe(true);
    expect(lose.find((a) => a.key === 'lost5')).toMatchObject({ unlocked: false, value: 2.5 });
  });
});

describe('weeklyChallenges', () => {
  it('sem metas e sem plano, só os desafios de diário e pesagem', () => {
    expect(weeklyChallenges(base, false).map((c) => c.key)).toEqual(['logDays', 'weighIn']);
  });

  it('com plano e metas, inclui refeições e metas e marca os concluídos', () => {
    const p = { ...base, week: { ...base.week, diary_days: 5, ate_meals: 3, weigh_ins: 2, protein_days: 3, calorie_days: 1 } };
    const list = weeklyChallenges(p, true);
    expect(list.map((c) => [c.key, c.done])).toEqual([
      ['logDays', true],
      ['ateMeals', false],
      ['weighIn', true],
      ['proteinDays', true],
      ['calorieDays', false],
    ]);
  });
});
