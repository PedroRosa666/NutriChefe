import { useEffect, useState } from 'react';
import { BadgeCheck, Camera, Clock, Contact, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import {
  CRN_REGIONS,
  getMyCrnStatus,
  getMyVerification,
  submitVerification,
  type CrnStatus,
} from '../../services/verification';

function PhotoInput({
  label,
  hint,
  capture,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  capture: 'user' | 'environment';
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-slate-300 p-3 hover:border-emerald-400 dark:border-slate-600">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {preview ? (
        <img src={preview} alt="" className="h-32 w-full rounded-lg object-cover" />
      ) : (
        <span className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg bg-slate-50 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Camera className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {hint}
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

/** Cartão no painel do nutricionista enquanto o CRN não está aprovado. */
export function CrnVerificationCard() {
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.showToast);
  const t = useTranslation();
  const v = t.verification;

  const [status, setStatus] = useState<CrnStatus | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fullName, setFullName] = useState('');
  const [region, setRegion] = useState<number>(3);
  const [number, setNumber] = useState('');
  const [card, setCard] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([getMyCrnStatus(userId), getMyVerification(userId)])
      .then(([s, mine]) => {
        if (cancelled) return;
        setStatus(s.status);
        setRejectReason(mine?.status === 'rejected' ? mine.reject_reason : '');
        if (mine) {
          setFullName(mine.full_name);
          setRegion(mine.crn_region);
          setNumber(mine.crn_number);
        }
      })
      .catch(() => !cancelled && setStatus('none'));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (user?.name && !fullName) setFullName(user.name);
  }, [user?.name, fullName]);

  if (!user || !status || status === 'approved') return null;

  const card_ = 'rounded-2xl border p-5 shadow-sm';

  if (status === 'pending') {
    return (
      <div className={`${card_} border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20`}>
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">{v.pendingTitle}</h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{v.pendingText}</p>
          </div>
        </div>
      </div>
    );
  }

  const digits = number.replace(/\D/g, '');
  const canSend = fullName.trim().length >= 3 && digits.length >= 1 && digits.length <= 7 && card && selfie && !sending;

  const send = async () => {
    if (!canSend || !card || !selfie) return;
    setSending(true);
    try {
      await submitVerification({ userId: user.id, fullName, region, number: digits, card, selfie });
      setStatus('pending');
      showToast(v.sent, 'success');
    } catch (error) {
      console.error('CRN verification failed', error);
      showToast(v.error, 'error');
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className={`${card_} border-emerald-200 bg-white dark:border-emerald-800/50 dark:bg-slate-900`}>
      <div className="flex items-start gap-3">
        <Contact className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{v.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{v.intro}</p>
        </div>
      </div>

      {status === 'rejected' && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {v.rejected} {rejectReason && <strong>{rejectReason}</strong>}
          </span>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{v.fullName}</span>
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={150} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{v.region}</span>
          <select className={inputClass} value={region} onChange={(e) => setRegion(Number(e.target.value))}>
            {CRN_REGIONS.map((r) => (
              <option key={r} value={r}>
                CRN-{r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{v.number}</span>
          <input
            className={inputClass}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="numeric"
            maxLength={10}
            placeholder="12345"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <PhotoInput label={v.cardLabel} hint={v.cardHint} capture="environment" file={card} onChange={setCard} />
        <PhotoInput label={v.selfieLabel} hint={v.selfieHint} capture="user" file={selfie} onChange={setSelfie} />
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{v.privacy}</p>

      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <BadgeCheck className="h-4 w-4" />
        {sending ? v.sending : v.send}
      </button>
    </div>
  );
}
