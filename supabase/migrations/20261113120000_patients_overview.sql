/*
  Lista de pacientes do nutricionista numa consulta só (antes, umas 8 consultas por paciente,
  repetidas a cada mensagem recebida).

  - patients_overview(): para cada paciente ativo de quem chama, o último registro no diário e a
    última refeição marcada (histórico completo, como patients_attention: a lista dizia "nunca"
    para quem estava parado havia mais de 7 dias), dias com registro e calorias dos últimos 7 dias
    (pelo dia do app, app_today), a meta de calorias, trocas pendentes e mensagens não lidas.
  - A adesão ao plano continua no app (regras das versões do plano em src/lib/adherence.ts).
*/

CREATE OR REPLACE FUNCTION public.patients_overview()
RETURNS TABLE (
  client_id uuid,
  last_log date,
  last_check date,
  days7 integer,
  kcal7 numeric,
  goal_kcal numeric,
  pending_swaps integer,
  unread_messages integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.client_id,
         (SELECT max(e.entry_date) FROM nutrition_log_entries e WHERE e.user_id = c.client_id),
         (SELECT max(k.check_date) FROM meal_plan_checks k
            JOIN meal_plans mp ON mp.id = k.plan_id
           WHERE k.client_id = c.client_id AND mp.created_by = c.nutritionist_id),
         w.days7,
         w.kcal7,
         (SELECT g.calories FROM nutrition_goals g WHERE g.user_id = c.client_id),
         (SELECT count(*)::int FROM food_swap_requests s
           WHERE s.client_id = c.client_id AND s.nutritionist_id = c.nutritionist_id AND s.status = 'pending'),
         (SELECT count(*)::int FROM care_messages m
           WHERE m.client_id = c.client_id AND m.nutritionist_id = c.nutritionist_id
             AND m.sender_id = c.client_id AND m.read_at IS NULL)
  FROM nutritionist_clients c
  CROSS JOIN LATERAL (
    SELECT count(DISTINCT e.entry_date)::int AS days7,
           coalesce(sum(
             CASE WHEN jsonb_typeof(e.per_serving -> 'calories') = 'number'
                  THEN (e.per_serving ->> 'calories')::numeric * coalesce(e.servings, 1) ELSE 0 END
           ), 0) AS kcal7
    FROM nutrition_log_entries e
    WHERE e.user_id = c.client_id AND e.entry_date BETWEEN public.app_today() - 6 AND public.app_today()
  ) w
  WHERE c.nutritionist_id = auth.uid() AND c.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.patients_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.patients_overview() TO authenticated;
