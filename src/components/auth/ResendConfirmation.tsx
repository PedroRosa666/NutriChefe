import { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { resendConfirmationEmail } from '../../services/database';
import { useTranslation } from '../../hooks/useTranslation';

// O Supabase só aceita um novo envio para o mesmo e-mail a cada 60 segundos.
const COOLDOWN_SECONDS = 60;

interface ResendConfirmationProps {
  initialEmail?: string;
}

export function ResendConfirmation({ initialEmail = '' }: ResendConfirmationProps) {
  const t = useTranslation();
  const r = t.feedback.resendConfirmation;
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => setEmail(initialEmail), [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email.trim()) {
      setFeedback({ type: 'error', text: r.emailRequired });
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      await resendConfirmationEmail(email);
      setFeedback({ type: 'ok', text: r.sent });
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const text = /rate limit|seconds/i.test(message)
        ? r.rateLimited
        : r.error;
      setFeedback({ type: 'error', text });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-slate-700 dark:text-slate-200">
        {r.prompt}
      </p>
      {!initialEmail && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.feedback.auth.emailPlaceholder}
          autoComplete="email"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      )}
      <button
        type="button"
        onClick={handleResend}
        disabled={sending || cooldown > 0}
        className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {cooldown > 0 ? r.resendIn.replace('{seconds}', String(cooldown)) : r.resend}
      </button>
      {feedback && (
        <p className={feedback.type === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
