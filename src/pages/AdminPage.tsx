import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { useTranslation } from '../hooks/useTranslation';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  docUrls,
  isAdmin,
  listPendingVerifications,
  reviewVerification,
  type CrnVerification,
} from '../services/verification';

// Consulta pública do Conselho Federal de Nutricionistas (busca por nome ou registro).
const CFN_LOOKUP_URL = 'https://cfn.org.br/';

function VerificationRow({ v, onDone }: { v: CrnVerification; onDone: () => void }) {
  const t = useTranslation();
  const a = t.admin;
  const showToast = useToastStore((s) => s.showToast);
  const [urls, setUrls] = useState<{ card: string | null; selfie: string | null } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    docUrls(v).then(setUrls).catch(() => setUrls({ card: null, selfie: null }));
  }, [v]);

  const review = async (approve: boolean) => {
    if (!approve && !reason.trim()) return;
    setBusy(true);
    try {
      await reviewVerification(v, approve, reason);
      showToast(approve ? a.approved : a.rejected, 'success');
      onDone();
    } catch (error) {
      console.error('review failed', error);
      showToast(a.error, 'error');
      setBusy(false);
    }
  };

  const crn = `CRN-${v.crn_region} ${v.crn_number}`;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{v.full_name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{crn}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(v.created_at).toLocaleString()}</p>
        </div>
        <a
          href={CFN_LOOKUP_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => navigator.clipboard?.writeText(v.full_name).catch(() => undefined)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ExternalLink className="h-4 w-4" />
          {a.lookup}
        </a>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {(['card', 'selfie'] as const).map((k) => (
          <figure key={k} className="overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {urls === null ? (
              <div className="flex h-44 items-center justify-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : urls[k] ? (
              <a href={urls[k] ?? undefined} target="_blank" rel="noreferrer">
                <img src={urls[k] ?? undefined} alt={k === 'card' ? a.card : a.selfie} className="h-44 w-full object-cover" />
              </a>
            ) : (
              <div className="flex h-44 items-center justify-center text-xs text-slate-500">{a.noPhoto}</div>
            )}
            <figcaption className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300">{k === 'card' ? a.card : a.selfie}</figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{a.checkHint}</p>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {a.reasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-rose-400 dark:border-slate-600 dark:text-slate-200"
              >
                {r}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={a.reasonPlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => review(false)}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {a.confirmReject}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-200"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => review(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {a.approve}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20"
          >
            <X className="h-4 w-4" />
            {a.reject}
          </button>
        </div>
      )}
    </li>
  );
}

/** Painel do administrador: por enquanto, a fila de verificação do CRN. */
export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const a = t.admin;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<CrnVerification[] | null>(null);

  const load = useCallback(() => {
    listPendingVerifications()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!user?.id) return setAllowed(false);
    isAdmin().then((ok) => {
      setAllowed(ok);
      if (ok) load();
    });
  }, [user?.id, load]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700 dark:text-slate-300">
        <ArrowLeft className="h-4 w-4" />
        {a.back}
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
        <ShieldCheck className="h-6 w-6 text-emerald-600" />
        {a.title}
      </h1>

      {allowed === null || (allowed && items === null) ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : !allowed ? (
        <p className="mt-6 text-slate-600 dark:text-slate-300">{a.notAllowed}</p>
      ) : (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {a.pendingTitle} ({items?.length ?? 0})
          </h2>
          {items && items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
              {a.empty}
            </p>
          ) : (
            <ul className="space-y-4">
              {items?.map((v) => (
                <VerificationRow key={v.user_id} v={v} onDone={load} />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
