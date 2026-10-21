import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Stethoscope, Loader2, ShieldCheck, UserMinus, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useToastStore } from '../../store/toast';
import { useNutritionGoalsStore } from '../../store/nutrition-goals';
import { useTranslation } from '../../hooks/useTranslation';
import { CareError, endLink, listMyNutritionists, redeemInvite, type CareLink } from '../../services/care';
import { Avatar } from './Avatar';

export function MyNutritionistCard() {
  const user = useAuthStore((s) => s.user);
  const { showToast } = useToastStore();
  const t = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteFromUrl = searchParams.get('convite');

  const [links, setLinks] = useState<CareLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState(inviteFromUrl ?? '');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setLinks(await listMyNutritionists(user.id));
    } catch (error) {
      console.error('Error loading nutritionists:', error);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Link de convite (/perfil?convite=CODIGO): preenche e leva o cartão para a tela.
  useEffect(() => {
    if (!inviteFromUrl) return;
    setCode(inviteFromUrl);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [inviteFromUrl]);

  const connect = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      await redeemInvite(code);
      showToast(t.care.connected, 'success');
      setCode('');
      if (inviteFromUrl) {
        const next = new URLSearchParams(searchParams);
        next.delete('convite');
        setSearchParams(next, { replace: true });
      }
      await load();
    } catch (error) {
      const key = error instanceof CareError ? error.code : 'unknown';
      showToast(t.care.errors[key as keyof typeof t.care.errors] ?? t.care.errors.unknown, 'error');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (link: CareLink) => {
    if (!window.confirm(t.care.endLinkConfirmClient)) return;
    try {
      await endLink(link.id);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      // Metas definidas por ele continuam valendo; só o rótulo some no próximo carregamento.
      if (user) useNutritionGoalsStore.getState().fetchGoals(user.id);
      showToast(t.care.linkEnded, 'info');
    } catch (error) {
      console.error('Error ending link:', error);
      showToast(t.care.errors.unknown, 'error');
    }
  };

  if (!user || user.type !== 'Client' || !loaded) return null;

  return (
    <section
      ref={cardRef}
      className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${
        inviteFromUrl ? 'border-emerald-300 ring-2 ring-emerald-500/30 dark:border-emerald-600' : 'border-slate-100 dark:border-slate-800'
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-emerald-500" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          {links.length ? t.care.myNutritionist : t.care.connectTitle}
        </h3>
      </div>

      {links.map((link) => (
        <div key={link.id} className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50/60 p-3 dark:bg-emerald-900/10">
          <Avatar name={link.person.full_name} url={link.person.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{link.person.full_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.care.connectedSince} {new Date(link.created_at).toLocaleDateString()}
            </p>
          </div>
          <Link
            to={`/nutricionista/${link.person.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
          >
            {t.care.viewProfile}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => disconnect(link)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/20"
          >
            <UserMinus className="h-3.5 w-3.5" />
            {t.care.endLink}
          </button>
        </div>
      ))}

      {(!links.length || inviteFromUrl) && (
        <div className="space-y-3">
          {inviteFromUrl ? (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t.care.inviteFromLink}</p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t.care.connectDescription}</p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              connect();
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.care.codePlaceholder}
              maxLength={16}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm uppercase tracking-widest text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.care.connect}
            </button>
          </form>
          <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {t.care.consentNote}
          </p>
        </div>
      )}
    </section>
  );
}
