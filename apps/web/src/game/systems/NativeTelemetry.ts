/**
 * AB#4739: what telemetry needs to know about the Android app, kept pure so it is tested without a device.
 *
 * - platformOf: the platform string every event carries. In the Android app it is capacitor-android-wv<major>, the
 *   Android System WebView's major version, so store sessions are separable from the web's in the funnel and a fault
 *   seen only on one WebView shows up as that WebView.
 * - telemetryEndpoint: the collector attributes a batch to a game by ?g=<slug>, else by the page's origin. The app's
 *   pages come from https://localhost, which names no game, so every batch names Relic Vault itself.
 * - reportPluginError / reportAdFailure: the error paths no window.onerror sees. A Capacitor plugin call that rejects
 *   inside a handled promise, and an ad that fails to load or show, are reported through a sink GameCtx connects.
 */

export const TELEMETRY_GAME = 'relic-vault';

/** The platform string: capacitor-<os>[-wv<major>] in the app, pwa-<browser|standalone>-<os> on the web. */
export function platformOf(ua: string, standalone: boolean, nativePlatform?: string | null): string {
  if (nativePlatform === 'android') {
    const major = /Chrome\/(\d+)/.exec(ua)?.[1];
    return `capacitor-android-wv${major ?? 'unknown'}`;
  }
  if (nativePlatform === 'ios') return 'capacitor-ios';
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'mac' : 'other';
  return `pwa-${standalone ? 'standalone' : 'browser'}-${os}`;
}

/** The collector's URL with ?g=<game> added (kept if the URL already names one); undefined stays undefined. */
export function telemetryEndpoint(url: string | undefined, game = TELEMETRY_GAME): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('g')) u.searchParams.set('g', game);
    return u.toString();
  } catch {
    return url;
  }
}

type Sink = (event: string, props: Record<string, unknown>) => void;
let sink: Sink | null = null;

/** Where native failures go: GameCtx connects its telemetry; null in tests and before boot. */
export function setNativeTelemetrySink(s: Sink | null) {
  sink = s;
}

/** The error code and message a plugin rejection carries, as sent: the code as a string, the message cut to 200. */
export function describeError(err: unknown): { code?: string; message: string } {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = e && e.code !== undefined && e.code !== null ? String(e.code) : undefined;
  return { code, message: String(e?.message ?? err).slice(0, 200) };
}

/** A Capacitor plugin call that failed (Purchases.configure, Browser.open, ...): an `error` event, source "plugin". */
export function reportPluginError(plugin: string, method: string, err: unknown) {
  sink?.('error', { source: 'plugin', plugin, method, ...describeError(err) });
}

/**
 * An ad that could not load or show: `ad_failed` with the format and the ad network's error code. Nothing calls it
 * yet: ads are the demo veils until the AdMob item lands, and the AdMob callbacks call this.
 */
export function reportAdFailure(format: 'rewarded' | 'interstitial', stage: 'load' | 'show', err: unknown) {
  sink?.('ad_failed', { format, stage, ...describeError(err) });
}
