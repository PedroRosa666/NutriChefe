// App instalável e notificações no celular (Web Push).
// O service worker fica em public/sw.js; o envio é feito pela função send-push do Supabase.
import { create } from 'zustand';
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

/** iPhone/iPad: notificações só funcionam com o app instalado na tela de início (iOS 16.4+). */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  });
}

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

const pushApis = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function getPushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return 'unsupported';
  if (!pushApis()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? 'on' : 'off';
}

/** Pede permissão, inscreve este aparelho e guarda a inscrição no banco. */
export async function enablePush(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !pushApis()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const json = subscription.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent,
  });
  if (error) {
    await subscription.unsubscribe();
    throw error;
  }
  return 'on';
}

/** Para de receber neste aparelho. */
export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  }
  return getPushState();
}

/**
 * Ao sair da conta: este aparelho para de receber as notificações dessa pessoa e o
 * service worker apaga os dados guardados para uso sem internet. Roda antes do signOut
 * (ainda com a sessão válida) e nunca impede a saída.
 */
export async function cleanupDeviceOnLogout(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.active?.postMessage({ type: 'logout' });
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn('Device cleanup on logout failed:', error);
  }
}

// ---------------------------------------------------------------- instalar o app

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Evento guardado do navegador (Android/Chrome/Edge) para abrir a janela de instalação. */
  promptEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
}

export const useInstallStore = create<InstallState>(() => ({ promptEvent: null, installed: false }));

export function listenForInstallPrompt(): void {
  useInstallStore.setState({ installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    useInstallStore.setState({ promptEvent: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstallStore.setState({ promptEvent: null, installed: true }));
}

export async function promptInstall(): Promise<boolean> {
  const event = useInstallStore.getState().promptEvent;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  useInstallStore.setState({ promptEvent: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}
