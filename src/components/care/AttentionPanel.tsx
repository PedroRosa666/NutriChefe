import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, ChevronRight, Crown, MessageCircle, MoonStar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../hooks/useTranslation';
import { usePremiumStore } from '../../store/premium';
import { daysSince, isInactive, lastActivity } from '../../lib/patient-activity';

interface AttentionRow {
  client_id: string;
  full_name: string | null;
  last_log: string | null;
  last_check: string | null;
  pending_swaps: number;
  unread_messages: number;
}


/** "Precisa de atenção": pacientes com trocas pendentes, mensagens não lidas ou sem registrar há dias. */
export function AttentionPanel() {
  const t = useTranslation();
  const a = t.attention;
  const nutritionistPro = usePremiumStore((s) => s.nutritionistPro);
  const [rows, setRows] = useState<AttentionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('patients_attention').then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error('patients_attention failed', error);
      setRows((data ?? []) as AttentionRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  const flagged = rows
    .map((r) => {
      const last = lastActivity(r.last_log, r.last_check);
      return { ...r, idle: daysSince(last), inactive: isInactive(last) };
    })
    .filter((r) => r.pending_swaps > 0 || r.unread_messages > 0 || r.inactive)
    .sort((x, y) => y.pending_swaps + y.unread_messages - (x.pending_swaps + x.unread_messages) || (y.idle ?? 99) - (x.idle ?? 99));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        {flagged.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        {a.title}
        {/* Contador só quando há alguém: um "0" em destaque parecia alerta. */}
        {flagged.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {flagged.length}
          </span>
        )}
      </h3>

      {flagged.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.allGood}</p>
      ) : !nutritionistPro ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p>{a.lockedText.replace('{n}', String(flagged.length))}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/perfil?tab=patients" className="font-semibold text-emerald-700 dark:text-emerald-300">
              {a.seeList}
            </Link>
            <Link to="/mentoria-ia" className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
              <Crown className="h-4 w-4" />
              {a.unlock}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {flagged.map((r) => (
            <li key={r.client_id}>
              <Link
                to={`/perfil?tab=patients&paciente=${r.client_id}`}
                className="flex items-center gap-3 py-2.5 hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{r.full_name || a.noName}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {r.pending_swaps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <ArrowLeftRight className="h-3 w-3" />
                        {(r.pending_swaps === 1 ? a.swapsOne : a.swapsMany).replace('{n}', String(r.pending_swaps))}
                      </span>
                    )}
                    {r.unread_messages > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                        <MessageCircle className="h-3 w-3" />
                        {(r.unread_messages === 1 ? a.messagesOne : a.messagesMany).replace('{n}', String(r.unread_messages))}
                      </span>
                    )}
                    {r.inactive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <MoonStar className="h-3 w-3" />
                        {r.idle === null ? a.neverLogged : a.idleDays.replace('{n}', String(r.idle))}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
