import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useToastStore } from '../../store/toast';
import { confirmDialog } from '../../store/confirm';
import { broadcast } from '../../services/admin';
import { adminErrorText } from './errors';

type Audience = 'all' | 'clients' | 'nutritionists';

export function AdminAnnouncements() {
  const t = useTranslation();
  const a = t.adminPanel;
  const showToast = useToastStore((s) => s.showToast);
  const [audience, setAudience] = useState<Audience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!(await confirmDialog(a.broadcastConfirm.replace('{to}', a.audiences[audience])))) return;
    setSending(true);
    try {
      const n = await broadcast(audience, title, body);
      showToast(a.broadcastSent.replace('{n}', String(n)), 'success');
      setTitle('');
      setBody('');
    } catch (error) {
      showToast(adminErrorText(error, a), 'error');
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-300">{a.broadcastIntro}</p>
      <div className="flex flex-wrap gap-2">
        {(['all', 'clients', 'nutritionists'] as Audience[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAudience(k)}
            className={`rounded-full px-3 py-1 text-sm ${audience === k ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'}`}
          >
            {a.audiences[k]}
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {a.broadcastTitle}
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
      </label>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {a.broadcastBody}
        <textarea className={inputClass} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} />
      </label>
      <button
        type="button"
        onClick={send}
        disabled={sending || !title.trim() || !body.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Megaphone className="h-4 w-4" />
        {a.broadcastSend}
      </button>
    </div>
  );
}
