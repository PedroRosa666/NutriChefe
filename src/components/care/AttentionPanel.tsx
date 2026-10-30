import { useEffect, useState, type ReactNode } from 'react';
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

export interface FlaggedPatient extends AttentionRow {
  idle: number | null;
  inactive: boolean;
}

/** No plano grátis o nutricionista vê os primeiros da fila; o Premium mostra todos. */
const FREE_VISIBLE = 3;
/** Com muitos pacientes, o Painel mostra só o topo da fila e leva à lista filtrada. */
const MAX_VISIBLE = 5;

/**
 * Pacientes com trocas pendentes, mensagens não lidas ou sem registrar há dias, do mais urgente
 * ao menos. `null` enquanto carrega; em erro, lista vazia (o Painel não trava).
 */
export function usePatientsAttention() {
  const [flagged, setFlagged] = useState<FlaggedPatient[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('patients_attention').then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error('patients_attention failed', error);
      const rows = ((data ?? []) as AttentionRow[])
        .map((r) => {
          const last = lastActivity(r.last_log, r.last_check);
          return { ...r, idle: daysSince(last), inactive: isInactive(last) };
        })
        .filter((r) => r.pending_swaps > 0 || r.unread_messages > 0 || r.inactive)
        .sort((x, y) => y.pending_swaps + y.unread_messages - (x.pending_swaps + x.unread_messages) || (y.idle ?? 99) - (x.idle ?? 99));
      setFlagged(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return flagged;
}

/** Abre a ficha já na aba onde o motivo se resolve: conversa, pedido de troca ou resumo. */
function patientLink(r: FlaggedPatient) {
  const tab = r.unread_messages > 0 ? '&ver=messages' : r.pending_swaps > 0 ? '&ver=plan' : '';
  return `/perfil?tab=patients&paciente=${r.client_id}${tab}`;
}

/** "Precisa de atenção": a fila do dia do nutricionista. */
export function AttentionPanel({ flagged, hasPatients }: { flagged: FlaggedPatient[] | null; hasPatients: boolean }) {
  const t = useTranslation();
  const a = t.attention;
  const nutritionistPro = usePremiumStore((s) => s.nutritionistPro);

  if (!flagged || !hasPatients) return null;

  const limit = nutritionistPro ? MAX_VISIBLE : FREE_VISIBLE;
  const visible = flagged.slice(0, limit);
  const hidden = flagged.length - visible.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        {flagged.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        {a.title}
        {/* Contador só quando há alguém: um "0" em destaque parecia alerta. */}
        {flagged.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {flagged.length}
          </span>
        )}
      </h2>

      {flagged.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.allGood}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((r) => (
              <li key={r.client_id}>
                <Link to={patientLink(r)} className="flex items-center gap-3 py-2.5 hover:text-emerald-700 dark:hover:text-emerald-300">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{r.full_name || a.noName}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {r.unread_messages > 0 && (
                        <StatusChip kind="messages">
                          {(r.unread_messages === 1 ? a.messagesOne : a.messagesMany).replace('{n}', String(r.unread_messages))}
                        </StatusChip>
                      )}
                      {r.pending_swaps > 0 && (
                        <StatusChip kind="swaps">
                          {(r.pending_swaps === 1 ? a.swapsOne : a.swapsMany).replace('{n}', String(r.pending_swaps))}
                        </StatusChip>
                      )}
                      {r.inactive && (
                        <StatusChip kind="inactive">{r.idle === null ? a.neverLogged : a.idleDays.replace('{n}', String(r.idle))}</StatusChip>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
          {hidden > 0 &&
            (nutritionistPro ? (
              <Link to="/perfil?tab=patients&filtro=atencao" className="mt-2 inline-flex text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {a.seeAll.replace('{n}', String(flagged.length))}
              </Link>
            ) : (
              <Link
                to="/mentoria-ia"
                className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
              >
                <Crown className="h-4 w-4 flex-shrink-0" />
                {(hidden === 1 ? a.lockedOne : a.lockedMany).replace('{n}', String(hidden))}
              </Link>
            ))}
        </>
      )}
    </section>
  );
}

const CHIP = {
  messages: { icon: MessageCircle, className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  swaps: { icon: ArrowLeftRight, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  inactive: { icon: MoonStar, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  adherence: { icon: AlertTriangle, className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
} as const;

/**
 * Selo de situação do paciente, com a mesma cor e ícone em todas as telas (Painel, lista de
 * pacientes): mensagens = azul, trocas = âmbar, sem registrar = cinza, adesão baixa = rosa.
 */
export function StatusChip({ kind, children }: { kind: keyof typeof CHIP; children: ReactNode }) {
  const { icon: Icon, className } = CHIP[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {children}
    </span>
  );
}
