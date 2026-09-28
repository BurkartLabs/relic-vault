/**
 * AB#4726: what this build does about ads, and where its public pages live, set at build time.
 *
 * VITE_ADS_MODE: "admob" in a build that shows real Google AdMob ads, anything else (the default) for the demo veils,
 * which contact no ad network. The privacy copy in Settings follows it, so it never says ads are simulated in a build
 * that serves them.
 *
 * VITE_PUBLIC_URL: where privacy.html and terms.html are served. On the web they open from the page's own origin; in
 * the Android app (Capacitor) the in-app browser needs a web address, so it uses this.
 */
import { reportPluginError } from './systems/NativeTelemetry'; // AB#4739

const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

export type AdsMode = 'admob' | 'demo';
export const ADS_MODE: AdsMode = env.VITE_ADS_MODE === 'admob' ? 'admob' : 'demo';
export const PUBLIC_URL = (env.VITE_PUBLIC_URL || 'https://ambitious-river-0aedc1d0f.6.azurestaticapps.net').replace(/\/$/, '');

/**
 * AB#4725: VITE_STORE_MODE "play" in a build that sells through Google Play Billing (RevenueCat), anything else (the
 * default, and every web and e2e build) for the demo store, which charges nothing. VITE_REVENUECAT_KEY is RevenueCat's
 * public Android SDK key (goog_...), which is made to ship inside the app; a sandbox key and a Play licence tester make
 * every purchase a test purchase. The Board supplies the production key and the Play product ids (release step 7);
 * until then a play build is built with the sandbox key.
 */
export type StoreBuildMode = 'play' | 'demo';
export const STORE_MODE: StoreBuildMode = env.VITE_STORE_MODE === 'play' ? 'play' : 'demo';
export const REVENUECAT_KEY = env.VITE_REVENUECAT_KEY || '';

/**
 * AB#4725: every sentence that says how purchases work, for a store mode. A Play build never says it is a demo, and a
 * demo build never implies money changes hands. The demo lines are unchanged (e2e/version.spec.ts reads the footer).
 */
export function storeCopy(mode: StoreBuildMode = STORE_MODE) {
  return mode === 'play'
    ? {
        shopNote: 'Purchases are charged by Google Play, in your currency. Restore purchases and manage Vault VIP in Settings.',
        historyHeading: 'Recent:',
        vipNote: 'Vault VIP renews monthly through Google Play until you cancel it there: Settings, Manage subscription.',
        vipSheet: 'Monthly subscription through Google Play. Cancel anytime in Play.',
        footer: 'purchases through Google Play',
      }
    : {
        shopNote: 'DEMO MODE: purchases are simulated. No real money is charged. Restore & manage purchases in Settings.',
        historyHeading: 'Recent (demo, not charged):',
        vipNote: 'Subscriptions are managed in your app store account. In this demo, VIP simply expires after 30 days.',
        vipSheet: 'Demo subscription. Cancel anytime in your store account.',
        footer: 'DEMO STORE MODE · no real charges',
      };
}

/** The Settings privacy sentence about ads, for a build mode. */
export function adsSentence(mode: AdsMode = ADS_MODE): string {
  return mode === 'admob'
    ? 'Ads are served by Google AdMob, which processes data under Google’s own privacy policy.'
    : 'Ads in this build are simulated: no ad network is contacted.';
}

/** Opens one of the public pages: the in-app browser in the Android app, a new tab on the web. */
export function openPublicPage(page: 'privacy.html' | 'terms.html') {
  const browser = (window as any).Capacitor?.Plugins?.Browser;
  if (browser?.open) { void Promise.resolve(browser.open({ url: `${PUBLIC_URL}/${page}` })).catch((e: unknown) => reportPluginError('Browser', 'open', e)); return; }
  window.open(new URL(page, location.href).href, '_blank', 'noopener');
}

/** AB#4725: an address outside the game (Play's subscription centre), in the in-app browser or a new tab. */
export function openExternal(url: string) {
  const browser = (window as any).Capacitor?.Plugins?.Browser;
  if (browser?.open) { void Promise.resolve(browser.open({ url })).catch((e: unknown) => reportPluginError('Browser', 'open', e)); return; }
  window.open(url, '_blank', 'noopener');
}
