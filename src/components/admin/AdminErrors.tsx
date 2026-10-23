import { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { adminErrors, type AdminError } from '../../services/admin';

export function AdminErrors() {
  const t = useTranslation();
  const a = t.adminPanel;
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<AdminError[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    adminErrors(days).then(setRows).catch(() => setRows([]));
  }, [days]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-full px-3 py-1 text-sm ${days === d ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'}`}
          >
            {a.lastDays.replace('{n}', String(d))}
          </button>
        ))}
      </div>
      {rows === null ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600">{a.noErrors}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.message} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => setOpen(open === e.message ? null : e.message)} className="w-full text-left">
                <p className="break-words font-mono text-sm text-slate-900 dark:text-slate-100">{e.message}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {a.errorCount.replace('{n}', String(e.total)).replace('{u}', String(e.users))} · {new Date(e.last_at).toLocaleString()}
                </p>
              </button>
              {open === e.message && (
                <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p className="break-all">{e.url}</p>
                  {e.stack && <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 dark:bg-slate-800">{e.stack}</pre>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
