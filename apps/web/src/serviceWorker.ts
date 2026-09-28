/// <reference types="vite-plugin-pwa/client" />
/**
 * Bug #4787: the service worker is the web's, and only the web's.
 *
 * On the web it makes the PWA work offline, as it always has. In the Android app (Capacitor) the game's files are
 * already on the phone, and a worker only adds a cache that outlives the app: after a Play update the WebView kept
 * running the previous build's code from the worker's cache. So the app registers none, removes any a previous build
 * registered, and reloads once when one was controlling the page, so this launch runs the code that was installed.
 */
import { Capacitor } from '@capacitor/core';

export type SwPlan = 'register' | 'none' | 'remove' | 'remove-and-reload';

export function swPlan(o: { supported: boolean; native: boolean; registrations: number; controlled: boolean; reloadedOnce: boolean }): SwPlan {
  if (!o.supported) return 'none';
  if (!o.native) return 'register';
  if (!o.registrations) return 'none';
  return o.controlled && !o.reloadedOnce ? 'remove-and-reload' : 'remove';
}

const RELOADED = 'rv:sw-removed';

/** Sets the worker up for this platform. Resolves true when the page is about to reload (the caller stops booting). */
export async function setupServiceWorker(): Promise<boolean> {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const native = Capacitor.isNativePlatform();
  if (supported && !native) {
    void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
    return false;
  }
  const regs = supported ? await navigator.serviceWorker.getRegistrations() : [];
  let reloadedOnce = false;
  try { reloadedOnce = sessionStorage.getItem(RELOADED) === '1'; } catch { /* storage refused: at worst no reload */ }
  const plan = swPlan({ supported, native, registrations: regs.length, controlled: !!navigator.serviceWorker?.controller, reloadedOnce });
  if (plan === 'none' || plan === 'register') return false;
  await Promise.all(regs.map((r) => r.unregister()));
  if (plan === 'remove') return false;
  try { sessionStorage.setItem(RELOADED, '1'); } catch { return false; }
  location.reload();
  return true;
}
