import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CalendarPlus, Loader2, MapPin, Pencil, Video, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useSettingsStore } from '../../store/settings';
import { useNotificationSignal } from '../../store/notifications';
import { confirmDialog } from '../../store/confirm';
import { useTranslation } from '../../hooks/useTranslation';
import {
  cancelAppointment,
  downloadIcs,
  listAppointments,
  saveAppointment,
  type Appointment,
  type AppointmentMode,
} from '../../services/appointments';
import { cn } from '../../lib/utils';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]';
const cardClass = 'space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900';

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isUrl = (s: string) => /^https?:\/\//i.test(s);

function useLocale() {
  return useSettingsStore((s) => (s.language === 'pt' ? 'pt-BR' : 'en-US'));
}

/** Avisos de consulta mudam a lista: recarrega quando chegam. */
const useAppointmentSignal = () => useNotificationSignal((n) => n.kind.startsWith('appointment_'));

interface RowProps {
  a: Appointment;
  /** Nome da outra pessoa (paciente para o nutricionista e vice-versa). */
  otherName?: string;
  onEdit?: () => void;
  onChanged: () => void;
}

function AppointmentRow({ a, otherName, onEdit, onChanged }: RowProps) {
  const t = useTranslation();
  const s = t.appointments;
  const locale = useLocale();
  const { showToast } = useToastStore();
  const [busy, setBusy] = useState(false);
  const start = new Date(a.starts_at);
  const past = start.getTime() + a.duration_min * 60000 < Date.now();
  const canceled = a.status === 'canceled';

  const cancel = async () => {
    if (!(await confirmDialog(s.cancelConfirm))) return;
    setBusy(true);
    try {
      await cancelAppointment(a.id);
      showToast(s.canceled, 'info');
      onChanged();
    } catch (error) {
      console.error('Error canceling appointment:', error);
      showToast(s.error, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn('space-y-1.5 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800', (past || canceled) && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 first-letter:uppercase dark:text-white">
            {start.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            {start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} • {s.minutes.replace('{n}', String(a.duration_min))}
            {otherName && ` • ${otherName}`}
          </p>
        </div>
        {canceled ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s.statusCanceled}</span>
        ) : past ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{s.statusPast}</span>
        ) : null}
      </div>
      <p className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
        {a.mode === 'online' ? <Video className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />}
        <span className="min-w-0 break-words">
          {a.mode === 'online' ? s.online : s.inPerson}
          {a.location &&
            (isUrl(a.location) ? (
              <>
                {' — '}
                <a href={a.location} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline dark:text-emerald-400">
                  {s.joinLink}
                </a>
              </>
            ) : (
              ` — ${a.location}`
            ))}
        </span>
      </p>
      {a.notes && <p className="whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">{a.notes}</p>}
      {!canceled && !past && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => downloadIcs(a, s.icsTitle.replace('{name}', otherName ?? ''))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            {s.addToCalendar}
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              {s.reschedule}
            </button>
          )}
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:hover:bg-rose-900/20"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            {s.cancel}
          </button>
        </div>
      )}
    </li>
  );
}

interface FormProps {
  clientId: string;
  editing: Appointment | null;
  onDone: () => void;
  onCancel: () => void;
}

function AppointmentForm({ clientId, editing, onDone, onCancel }: FormProps) {
  const t = useTranslation();
  const s = t.appointments;
  const { showToast } = useToastStore();
  const initial = editing ? new Date(editing.starts_at) : (() => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(9, 0, 0, 0);
    return d;
  })();
  const [date, setDate] = useState(localDate(initial));
  const [time, setTime] = useState(localTime(initial));
  const [duration, setDuration] = useState(editing?.duration_min ?? 60);
  const [mode, setMode] = useState<AppointmentMode>(editing?.mode ?? 'in_person');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
      showToast(s.pastError, 'warning');
      return;
    }
    setSaving(true);
    try {
      await saveAppointment({ id: editing?.id, clientId, startsAt, durationMin: duration, mode, location, notes });
      showToast(editing ? s.rescheduled : s.scheduled, 'success');
      onDone();
    } catch (error) {
      console.error('Error saving appointment:', error);
      showToast(s.error, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{editing ? s.rescheduleTitle : s.newTitle}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.date}</span>
          <input type="date" required value={date} min={localDate(new Date())} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.time}</span>
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </label>
        <label className="col-span-2 space-y-1 sm:col-span-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.duration}</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass}>
            {[30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {s.minutes.replace('{n}', String(n))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="inline-flex rounded-lg bg-white p-0.5 text-xs font-semibold shadow-sm dark:bg-slate-800">
        {(['in_person', 'online'] as AppointmentMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5',
              mode === m ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {m === 'online' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {m === 'online' ? s.online : s.inPerson}
          </button>
        ))}
      </div>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={300}
        placeholder={mode === 'online' ? s.linkPlaceholder : s.addressPlaceholder}
        className={inputClass}
      />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder={s.notesPlaceholder} className={inputClass} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">
          {t.common.cancel}
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? s.saveReschedule : s.schedule}
        </button>
      </div>
    </form>
  );
}

/** Consultas de um paciente, no detalhe do paciente (nutricionista agenda, remarca e cancela). */
export function AppointmentsSection({ clientId }: { clientId: string }) {
  const t = useTranslation();
  const s = t.appointments;
  const signal = useAppointmentSignal();
  const [list, setList] = useState<Appointment[] | null>(null);
  const [form, setForm] = useState<{ editing: Appointment | null } | null>(null);

  const load = useCallback(() => {
    listAppointments({ clientId, fromDays: 30 })
      .then(setList)
      .catch((error) => {
        console.error('Error loading appointments:', error);
        setList([]);
      });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load, signal]);

  const now = Date.now();
  const upcoming = (list ?? []).filter((a) => new Date(a.starts_at).getTime() >= now && a.status === 'scheduled');
  const others = (list ?? []).filter((a) => !upcoming.includes(a)).reverse().slice(0, 3);

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {s.title}
        </h3>
        {!form && (
          <button
            type="button"
            onClick={() => setForm({ editing: null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            {s.scheduleButton}
          </button>
        )}
      </div>

      {form && (
        <AppointmentForm
          key={form.editing?.id ?? 'new'}
          clientId={clientId}
          editing={form.editing}
          onCancel={() => setForm(null)}
          onDone={() => {
            setForm(null);
            load();
          }}
        />
      )}

      {list === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : !list.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{s.empty}</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((a) => (
            <AppointmentRow key={a.id} a={a} otherName={a.clientName} onEdit={() => setForm({ editing: a })} onChanged={load} />
          ))}
          {others.length > 0 && <li className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{s.recent}</li>}
          {others.map((a) => (
            <AppointmentRow key={a.id} a={a} otherName={a.clientName} onChanged={load} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Próximas consultas do usuário (painel inicial do paciente e do nutricionista). */
export function UpcomingAppointments() {
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const s = t.appointments;
  const signal = useAppointmentSignal();
  const [list, setList] = useState<Appointment[] | null>(null);

  const load = useCallback(() => {
    listAppointments({ onlyScheduled: true })
      .then((all) => setList(all.slice(0, 5)))
      .catch((error) => {
        console.error('Error loading appointments:', error);
        setList([]);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, signal]);

  // Sem consultas marcadas, o card não aparece (o painel já tem bastante coisa).
  if (!user || !list?.length) return null;
  const isNutritionist = user.type === 'Nutritionist';

  return (
    <section className={cardClass}>
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        {s.upcomingTitle}
      </h3>
      <ul className="space-y-2">
        {list.map((a) => (
          <AppointmentRow key={a.id} a={a} otherName={isNutritionist ? a.clientName : a.nutritionistName} onChanged={load} />
        ))}
      </ul>
    </section>
  );
}
