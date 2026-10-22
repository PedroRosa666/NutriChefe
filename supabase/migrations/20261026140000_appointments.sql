/*
  # Agenda de consultas

  - appointments: consultas marcadas pelo nutricionista com um paciente (presencial ou online).
    As duas pontas veem enquanto o acompanhamento estiver ativo.
  - Escrita só pelas funções abaixo: o nutricionista agenda e remarca (save_appointment);
    qualquer um dos dois cancela (cancel_appointment).
  - Avisos (sino + celular):
      appointment_scheduled -> paciente: consulta marcada ou remarcada
      appointment_canceled  -> a outra pessoa: consulta cancelada
      appointment_reminder  -> os dois: 1 dia antes e 1 hora antes
  - Lembretes: send_appointment_reminders(), chamada a cada 10 minutos pelo pg_cron.
*/

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_min smallint NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 10 AND 240),
  mode text NOT NULL DEFAULT 'in_person' CHECK (mode IN ('in_person', 'online')),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 300),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'canceled')),
  canceled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reminded_day_at timestamptz,
  reminded_hour_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_nutritionist ON appointments(nutritionist_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming ON appointments(starts_at) WHERE status = 'scheduled';

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read appointments" ON appointments;
CREATE POLICY "Members read appointments"
  ON appointments FOR SELECT TO authenticated
  USING (
    (nutritionist_id = auth.uid() AND public.is_my_patient(client_id))
    OR (client_id = auth.uid() AND public.is_my_nutritionist(nutritionist_id))
  );

REVOKE INSERT, UPDATE, DELETE ON appointments FROM anon, authenticated;

-- Avisos: novos tipos.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'swap_requested', 'swap_answered', 'patient_joined', 'link_ended', 'plan_updated', 'goals_updated', 'message',
  'appointment_scheduled', 'appointment_canceled', 'appointment_reminder'
));

CREATE OR REPLACE FUNCTION public.appointment_data(p appointments, p_other uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name', public.profile_name(p_other),
    'starts_at', p.starts_at,
    'mode', p.mode,
    'location', p.location,
    'client_id', p.client_id
  );
$$;

REVOKE ALL ON FUNCTION public.appointment_data(appointments, uuid) FROM public, anon, authenticated;

-- Nutricionista: agenda (p_id nulo) ou remarca uma consulta com um paciente ativo.
CREATE OR REPLACE FUNCTION public.save_appointment(
  p_id uuid, p_client uuid, p_starts_at timestamptz, p_duration_min smallint,
  p_mode text, p_location text, p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row appointments;
  v_rescheduled boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_my_patient(p_client) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF p_starts_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'in_the_past';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO appointments (nutritionist_id, client_id, starts_at, duration_min, mode, location, notes)
    VALUES (auth.uid(), p_client, p_starts_at, coalesce(p_duration_min, 60), coalesce(p_mode, 'in_person'),
            left(coalesce(p_location, ''), 300), left(coalesce(p_notes, ''), 1000))
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM appointments WHERE id = p_id FOR UPDATE;
    IF v_row.id IS NULL OR v_row.nutritionist_id <> auth.uid() OR v_row.client_id <> p_client OR v_row.status <> 'scheduled' THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
    v_rescheduled := v_row.starts_at <> p_starts_at;
    UPDATE appointments
    SET starts_at = p_starts_at, duration_min = coalesce(p_duration_min, duration_min), mode = coalesce(p_mode, mode),
        location = left(coalesce(p_location, ''), 300), notes = left(coalesce(p_notes, ''), 1000), updated_at = now(),
        -- Nova data: os lembretes valem de novo.
        reminded_day_at = CASE WHEN v_rescheduled THEN NULL ELSE reminded_day_at END,
        reminded_hour_at = CASE WHEN v_rescheduled THEN NULL ELSE reminded_hour_at END
    WHERE id = p_id
    RETURNING * INTO v_row;
  END IF;

  -- Marcada para daqui a menos de 1 dia: o aviso de agendamento já faz o papel do lembrete de 1 dia.
  IF v_row.reminded_day_at IS NULL AND v_row.starts_at <= now() + interval '24 hours' THEN
    UPDATE appointments SET reminded_day_at = now() WHERE id = v_row.id;
  END IF;

  IF p_id IS NULL OR v_rescheduled THEN
    PERFORM public.notify(v_row.client_id, 'appointment_scheduled', v_row.id,
      public.appointment_data(v_row, v_row.nutritionist_id) || jsonb_build_object('rescheduled', v_rescheduled));
  END IF;
  RETURN v_row.id;
END;
$$;

-- Qualquer um dos dois cancela; a outra pessoa recebe aviso.
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row appointments;
  v_other uuid;
BEGIN
  SELECT * INTO v_row FROM appointments WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status <> 'scheduled' OR auth.uid() IS NULL
     OR NOT ((v_row.nutritionist_id = auth.uid() AND public.is_my_patient(v_row.client_id))
          OR (v_row.client_id = auth.uid() AND public.is_my_nutritionist(v_row.nutritionist_id))) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  UPDATE appointments SET status = 'canceled', canceled_by = auth.uid(), updated_at = now() WHERE id = p_id
  RETURNING * INTO v_row;
  v_other := CASE WHEN auth.uid() = v_row.client_id THEN v_row.nutritionist_id ELSE v_row.client_id END;
  PERFORM public.notify(v_other, 'appointment_canceled', v_row.id, public.appointment_data(v_row, auth.uid()));
END;
$$;

REVOKE ALL ON FUNCTION public.save_appointment(uuid, uuid, timestamptz, smallint, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_appointment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_appointment(uuid, uuid, timestamptz, smallint, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(uuid) TO authenticated;

-- Lembretes de 1 dia e de 1 hora, para os dois. Devolve quantas consultas foram lembradas.
CREATE OR REPLACE FUNCTION public.send_appointment_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row appointments;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM appointments
    WHERE status = 'scheduled' AND starts_at > now()
      AND ((reminded_day_at IS NULL AND starts_at <= now() + interval '24 hours')
        OR (reminded_hour_at IS NULL AND starts_at <= now() + interval '60 minutes'))
      AND EXISTS (SELECT 1 FROM nutritionist_clients c
                  WHERE c.nutritionist_id = appointments.nutritionist_id AND c.client_id = appointments.client_id AND c.status = 'active')
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.notify(v_row.client_id, 'appointment_reminder', v_row.id, public.appointment_data(v_row, v_row.nutritionist_id));
    PERFORM public.notify(v_row.nutritionist_id, 'appointment_reminder', v_row.id, public.appointment_data(v_row, v_row.client_id));
    IF v_row.starts_at <= now() + interval '60 minutes' THEN
      UPDATE appointments SET reminded_hour_at = now(), reminded_day_at = coalesce(reminded_day_at, now()) WHERE id = v_row.id;
    ELSE
      UPDATE appointments SET reminded_day_at = now() WHERE id = v_row.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_appointment_reminders() FROM public, anon, authenticated;

-- Fim do acompanhamento: as consultas futuras são canceladas.
CREATE OR REPLACE FUNCTION public.cancel_appointments_on_link_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'ended' THEN
    UPDATE appointments
    SET status = 'canceled', canceled_by = auth.uid(), updated_at = now()
    WHERE nutritionist_id = NEW.nutritionist_id AND client_id = NEW.client_id
      AND status = 'scheduled' AND starts_at > now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_appointments_on_link_end ON nutritionist_clients;
CREATE TRIGGER trg_cancel_appointments_on_link_end
  AFTER UPDATE OF status ON nutritionist_clients
  FOR EACH ROW EXECUTE FUNCTION public.cancel_appointments_on_link_end();

-- Agenda os lembretes no pg_cron (a cada 10 minutos). Sem pg_cron disponível, pula.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'appointment-reminders';
    PERFORM cron.schedule('appointment-reminders', '*/10 * * * *', 'SELECT public.send_appointment_reminders()');
  END IF;
END;
$$;
