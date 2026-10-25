import { useEffect, useMemo, useState } from 'react';
import { planDayOf, type PlanMeal } from '../services/care';
import { listPlanVersions, listPlanViews, versionOn, type PlanVersion } from '../services/plans';
import { mealItems, mealsOnDay } from '../lib/plan-meals';
import { useNotificationSignal } from '../store/notifications';

/**
 * Refeições do plano em uso numa data (as da versão que valia no dia, com itens nesse dia), para o
 * diário oferecer os blocos da prescrição. null: sem plano em uso nessa data (o diário usa as
 * refeições de sempre).
 */
export function usePlanMealsOn(userId: string | undefined, date: string): PlanMeal[] | null {
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const signal = useNotificationSignal((n) => n.kind === 'plan_updated' || n.kind === 'link_ended');

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const views = await listPlanViews(userId);
      const active = views.find((v) => v.active && (v.current || v.next));
      const list = active ? await listPlanVersions(active.id) : [];
      if (alive) setVersions(list);
    })().catch((error) => console.error('Error loading plan meals for the diary:', error));
    return () => {
      alive = false;
    };
  }, [userId, signal]);

  return useMemo(() => {
    const version = versionOn(versions, date);
    if (!version) return null;
    const day = planDayOf(new Date(`${date}T12:00:00`));
    const meals = mealsOnDay(version.meals, day).filter((m) => mealItems(version.items, m.id, day).length > 0);
    return meals.length ? meals : null;
  }, [versions, date]);
}
