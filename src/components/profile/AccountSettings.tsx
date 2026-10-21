import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, CreditCard, KeyRound, Loader2, LogOut, UserCog } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useSubscriptionStore } from '../../store/subscription';
import { useToastStore } from '../../store/toast';
import { useSettingsStore } from '../../store/settings';
import { useTranslation } from '../../hooks/useTranslation';
import { supabase } from '../../lib/supabase';
import { openBillingPortal } from '../../services/subscription';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const cardClass = 'space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

export function AccountSettings() {
  const { user, updateName, signOut } = useAuthStore();
  const { userSubscription, isPremium } = useSubscriptionStore();
  const { showToast } = useToastStore();
  const { language } = useSettingsStore();
  const t = useTranslation();
  const a = t.account;

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  if (!user) return null;

  const isNutritionist = user.type === 'Nutritionist';
  const premium = isPremium();
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale) : '—');

  const handleName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      showToast(a.nameTooShort, 'warning');
      return;
    }
    setSavingName(true);
    try {
      await updateName(name);
      showToast(a.nameSaved, 'success');
    } catch (error) {
      console.error('Error updating name:', error);
      showToast(a.saveError, 'error');
    } finally {
      setSavingName(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      showToast(a.passwordTooShort, 'warning');
      return;
    }
    if (password !== confirm) {
      showToast(a.passwordMismatch, 'warning');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirm('');
      showToast(a.passwordSaved, 'success');
    } catch (error) {
      console.error('Error updating password:', error);
      const msg = error instanceof Error && /same|different/i.test(error.message) ? a.passwordSame : a.saveError;
      showToast(msg, 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePortal = async () => {
    setOpeningPortal(true);
    try {
      await openBillingPortal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : a.saveError, 'error');
      setOpeningPortal(false);
    }
  };

  const status = userSubscription?.status;
  const statusLabel = status ? a.status[status] : a.status.none;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={handleName} className={cardClass}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <UserCog className="h-4 w-4 text-emerald-500" /> {t.profile.personalInfo}
        </h3>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="acc-name">{t.profile.name}</label>
          <input id="acc-name" className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="acc-email">{t.profile.email}</label>
          <input id="acc-email" className={inputClass} value={user.email} disabled />
        </div>
        <button type="submit" disabled={savingName || name.trim() === user.name}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {savingName && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.common.save}
        </button>
      </form>

      <form onSubmit={handlePassword} className={cardClass}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <KeyRound className="h-4 w-4 text-emerald-500" /> {a.changePassword}
        </h3>
        <input type="password" className={inputClass} placeholder={a.newPassword} value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <input type="password" className={inputClass} placeholder={a.confirmPassword} value={confirm}
          onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <p className="text-xs text-slate-500 dark:text-slate-400">{a.passwordHint}</p>
        <button type="submit" disabled={savingPassword || !password}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
          {a.updatePassword}
        </button>
      </form>

      {!isNutritionist && (
        <section className={cardClass}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <CreditCard className="h-4 w-4 text-amber-500" /> {a.subscription}
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{a.plan}</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{userSubscription?.plan?.name ?? a.freePlan}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{a.statusLabel}</dt>
              <dd className={`font-semibold ${premium ? 'text-emerald-600' : status === 'pending' ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}`}>
                {statusLabel}
              </dd>
            </div>
            {userSubscription?.stripe_subscription_id && (
              <>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{a.since}</dt>
                  <dd className="text-slate-700 dark:text-slate-200">{formatDate(userSubscription.started_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    {userSubscription.auto_renew ? a.renewsOn : a.endsOn}
                  </dt>
                  <dd className="text-slate-700 dark:text-slate-200">{formatDate(userSubscription.expires_at)}</dd>
                </div>
              </>
            )}
          </dl>
          {status === 'pending' && <p className="text-xs text-amber-600">{a.pendingHint}</p>}

          {userSubscription?.stripe_subscription_id ? (
            <button type="button" onClick={handlePortal} disabled={openingPortal}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {openingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {a.manageSubscription}
            </button>
          ) : (
            <Link to="/mentoria-ia"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
              <Crown className="h-4 w-4" /> {t.profile.upgradePremium}
            </Link>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">{a.portalHint}</p>
        </section>
      )}

      <section className={cardClass}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{a.session}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{a.sessionHint}</p>
        <button type="button" onClick={() => signOut()}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20">
          <LogOut className="h-4 w-4" /> {t.common.signOut}
        </button>
      </section>
    </div>
  );
}
