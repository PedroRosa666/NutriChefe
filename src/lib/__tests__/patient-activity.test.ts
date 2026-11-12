import { describe, expect, it } from 'vitest';
import { daysSince, isInactive, kcalStatus, lastActivity } from '../patient-activity';

const today = new Date('2026-10-23T09:00:00');

describe('patient activity', () => {
  it('picks the most recent of diary and meal checks', () => {
    expect(lastActivity('2026-10-20', '2026-10-22')).toBe('2026-10-22');
    expect(lastActivity(null, '2026-10-19')).toBe('2026-10-19');
    expect(lastActivity(null, undefined)).toBeNull();
  });

  it('counts whole days', () => {
    expect(daysSince('2026-10-23', today)).toBe(0);
    expect(daysSince('2026-10-20', today)).toBe(3);
    expect(daysSince(null, today)).toBeNull();
  });

  it('flags after 3 days without any activity, or never', () => {
    expect(isInactive('2026-10-21', today)).toBe(false);
    expect(isInactive('2026-10-20', today)).toBe(true);
    expect(isInactive(null, today)).toBe(true);
  });

  it('compares the weekly calorie average with the goal', () => {
    expect(kcalStatus(2300, 2000, 1)).toBe('over');
    expect(kcalStatus(2200, 2000, 7)).toBeNull();
    expect(kcalStatus(1500, 2000, 3)).toBe('under');
    expect(kcalStatus(1600, 2000, 7)).toBeNull();
    // Um ou dois dias registrados não bastam para dizer que a pessoa come pouco.
    expect(kcalStatus(900, 2000, 2)).toBeNull();
    // Sem meta ou sem registro, não há o que comparar.
    expect(kcalStatus(1500, null, 7)).toBeNull();
    expect(kcalStatus(0, 2000, 7)).toBeNull();
  });
});

describe('meal for time of day', () => {
  it('suggests the meal by the clock', async () => {
    const { mealForTime } = await import('../../store/nutrition-tracking');
    const at = (h: number, m = 0) => new Date(2026, 9, 23, h, m);
    expect(mealForTime(at(7))).toBe('breakfast');
    expect(mealForTime(at(10, 29))).toBe('breakfast');
    expect(mealForTime(at(12))).toBe('lunch');
    expect(mealForTime(at(16))).toBe('snack');
    expect(mealForTime(at(20))).toBe('dinner');
  });
});
