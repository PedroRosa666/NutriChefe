import { useEffect, useState } from 'react';
import { BellRing, Download, Loader2, Share, Smartphone } from 'lucide-react';
import { useToastStore } from '../../store/toast';
import { useTranslation } from '../../hooks/useTranslation';
import { disablePush, enablePush, getPushState, isIos, promptInstall, useInstallStore, type PushState } from '../../lib/push';

/** Instalar o app na tela de início e ligar/desligar as notificações neste aparelho. */
export function AppDeviceCard({ className }: { className: string }) {
  const t = useTranslation();
  const s = t.device;
  const { showToast } = useToastStore();
  const { promptEvent, installed } = useInstallStore();
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  const togglePush = async () => {
    setBusy(true);
    try {
      const next = push === 'on' ? await disablePush() : await enablePush();
      setPush(next);
      if (next === 'on') showToast(s.pushOnToast, 'success');
      else if (next === 'denied') showToast(s.pushDenied, 'warning');
    } catch (error) {
      console.error('Error toggling push:', error);
      showToast(s.pushError, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={className}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        {s.title}
      </h3>

      {/* Instalar */}
      {installed ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{s.installed}</p>
      ) : promptEvent ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.installHint}</p>
          <button
            type="button"
            onClick={() => promptInstall()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            {s.install}
          </button>
        </div>
      ) : isIos() ? (
        <p className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Share className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {s.iosInstall}
        </p>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{s.browserInstall}</p>
      )}

      {/* Notificações */}
      <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <BellRing className="h-4 w-4" />
          {s.pushTitle}
        </p>
        {push === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : push === 'unsupported' ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.pushUnsupported}</p>
        ) : push === 'needs-install' ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{s.pushNeedsInstall}</p>
        ) : push === 'denied' ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{s.pushDenied}</p>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">{push === 'on' ? s.pushOnHint : s.pushOffHint}</p>
            <button
              type="button"
              onClick={togglePush}
              disabled={busy}
              className={
                push === 'on'
                  ? 'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  : 'inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60'
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              {push === 'on' ? s.pushTurnOff : s.pushTurnOn}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
