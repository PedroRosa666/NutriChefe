// Agenda de consultas (supabase/migrations/20261026140000_appointments.sql).
// O nutricionista agenda e remarca; qualquer um dos dois cancela. Tudo pelas funções do banco.
import { supabase } from '../lib/supabase';

export type AppointmentMode = 'in_person' | 'online';

export interface Appointment {
  id: string;
  nutritionist_id: string;
  client_id: string;
  starts_at: string;
  duration_min: number;
  mode: AppointmentMode;
  location: string;
  notes: string;
  status: 'scheduled' | 'canceled';
  canceled_by: string | null;
  nutritionistName: string;
  clientName: string;
}

const COLUMNS =
  'id, nutritionist_id, client_id, starts_at, duration_min, mode, location, notes, status, canceled_by, ' +
  'nutritionist:profiles!appointments_nutritionist_id_fkey(full_name), client:profiles!appointments_client_id_fkey(full_name)';

type Named = { full_name: string | null } | { full_name: string | null }[] | null;
type Row = Omit<Appointment, 'nutritionistName' | 'clientName'> & { nutritionist: Named; client: Named };
const nameOf = (v: Named) => (Array.isArray(v) ? v[0]?.full_name : v?.full_name) ?? '';

const toAppointment = ({ nutritionist, client, ...row }: Row): Appointment => ({
  ...row,
  nutritionistName: nameOf(nutritionist),
  clientName: nameOf(client),
});

/**
 * Consultas visíveis ao usuário (as regras do banco já filtram por acompanhamento ativo).
 * `clientId` restringe a um paciente; `fromDays` volta alguns dias para mostrar as recentes.
 */
export async function listAppointments(opts: { clientId?: string; fromDays?: number; onlyScheduled?: boolean } = {}): Promise<Appointment[]> {
  const from = new Date(Date.now() - (opts.fromDays ?? 0) * 86400000).toISOString();
  let query = supabase.from('appointments').select(COLUMNS).gte('starts_at', from).order('starts_at', { ascending: true }).limit(100);
  if (opts.clientId) query = query.eq('client_id', opts.clientId);
  if (opts.onlyScheduled) query = query.eq('status', 'scheduled');
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toAppointment);
}

export async function saveAppointment(input: {
  id?: string | null;
  clientId: string;
  startsAt: Date;
  durationMin: number;
  mode: AppointmentMode;
  location: string;
  notes: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_appointment', {
    p_id: input.id ?? null,
    p_client: input.clientId,
    p_starts_at: input.startsAt.toISOString(),
    p_duration_min: input.durationMin,
    p_mode: input.mode,
    p_location: input.location.trim(),
    p_notes: input.notes.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function cancelAppointment(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_appointment', { p_id: id });
  if (error) throw error;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Baixa um arquivo .ics para a pessoa pôr a consulta na agenda do celular/computador. */
export function downloadIcs(a: Appointment, title: string): void {
  const start = new Date(a.starts_at);
  const end = new Date(start.getTime() + a.duration_min * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NutriChef//Agenda//PT',
    'BEGIN:VEVENT',
    `UID:${a.id}@nutrichef`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    a.location ? `LOCATION:${icsText(a.location)}` : '',
    a.notes ? `DESCRIPTION:${icsText(a.notes)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'consulta-nutrichef.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
