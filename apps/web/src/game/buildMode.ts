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
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

export type AdsMode = 'admob' | 'demo';
export const ADS_MODE: AdsMode = env.VITE_ADS_MODE === 'admob' ? 'admob' : 'demo';
export const PUBLIC_URL = (env.VITE_PUBLIC_URL || 'https://ambitious-river-0aedc1d0f.6.azurestaticapps.net').replace(/\/$/, '');

/** The Settings privacy sentence about ads, for a build mode. */
export function adsSentence(mode: AdsMode = ADS_MODE): string {
  return mode === 'admob'
    ? 'Ads are served by Google AdMob, which processes data under Google’s own privacy policy.'
    : 'Ads in this build are simulated: no ad network is contacted.';
}

/** Opens one of the public pages: the in-app browser in the Android app, a new tab on the web. */
export function openPublicPage(page: 'privacy.html' | 'terms.html') {
  const browser = (window as any).Capacitor?.Plugins?.Browser;
  if (browser?.open) { void browser.open({ url: `${PUBLIC_URL}/${page}` }); return; }
  window.open(new URL(page, location.href).href, '_blank', 'noopener');
}
