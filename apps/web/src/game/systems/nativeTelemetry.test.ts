import { describe, it, expect, afterEach } from 'vitest';
import { platformOf, telemetryEndpoint, setNativeTelemetrySink, reportPluginError, reportAdFailure, describeError } from './NativeTelemetry';
import { Telemetry } from './Telemetry';
import { RevenueCatBackend } from './PlayStore';
import { PurchaseService } from './PurchaseService';
import { createState } from './State';
import { mulberry32 } from './Rng';
import { setStorePrices } from './Prices';
import { storeTelemetryUrl, STORE_TELEMETRY_URL } from '../../../../../scripts/android.mjs';

// AB#4739: native telemetry for the Android app.

const ANDROID_WV = 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.51 Mobile Safari/537.36';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

afterEach(() => { setNativeTelemetrySink(null); setStorePrices(null); });

function capture() {
  const got: { event: string; props: Record<string, unknown> }[] = [];
  setNativeTelemetrySink((event, props) => got.push({ event, props }));
  return got;
}

describe('native telemetry (AB#4739)', () => {
  it('names the Android app and its WebView major, so store sessions are separable', () => {
    expect(platformOf(ANDROID_WV, false, 'android')).toBe('capacitor-android-wv140');
    expect(platformOf('Mozilla/5.0 (Linux; Android 10; wv)', false, 'android')).toBe('capacitor-android-wvunknown');
  });

  it('keeps the web’s platform strings as they were', () => {
    expect(platformOf(CHROME_ANDROID, false, null)).toBe('pwa-browser-android');
    expect(platformOf(CHROME_ANDROID, true, 'web')).toBe('pwa-standalone-android');
    expect(platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false)).toBe('pwa-browser-windows');
  });

  it('names the game on the collector URL, since the app’s origin (https://localhost) names none', () => {
    expect(telemetryEndpoint('https://control.example/e')).toBe('https://control.example/e?g=relic-vault');
    expect(telemetryEndpoint('https://control.example/e?g=other')).toBe('https://control.example/e?g=other');
    expect(telemetryEndpoint(undefined)).toBeUndefined();
  });

  it('reports a failed plugin call as an error event with its plugin, method and code', () => {
    const got = capture();
    reportPluginError('Browser', 'open', Object.assign(new Error('No Activity found'), { code: 'UNAVAILABLE' }));
    expect(got).toEqual([{ event: 'error', props: { source: 'plugin', plugin: 'Browser', method: 'open', code: 'UNAVAILABLE', message: 'No Activity found' } }]);
    expect(describeError('x'.repeat(300)).message).toHaveLength(200);
  });

  it('reports an ad failure with its format, stage and the network’s code', () => {
    const got = capture();
    reportAdFailure('rewarded', 'load', { code: 3, message: 'No fill' });
    expect(got).toEqual([{ event: 'ad_failed', props: { format: 'rewarded', stage: 'load', code: '3', message: 'No fill' } }]);
  });

  it('sends a real purchase and a failed one promptly, not with the 10 s batch', () => {
    for (const e of ['purchase', 'purchase_failed', 'purchase_demo', 'error']) expect(Telemetry.PROMPT.has(e), e).toBe(true);
  });

  it('carries RevenueCat’s error code on a failed purchase', async () => {
    const b = new RevenueCatBackend('goog_test') as any;
    b.products.set('gems200', { identifier: 'rv_gems_200' });
    b.rc = { purchaseStoreProduct: async () => { throw Object.assign(new Error('The payment is pending.'), { code: '20' }); } };
    expect(await b.buy('gems200')).toEqual({ ok: false, reason: 'pending', code: '20' });
    b.rc = { purchaseStoreProduct: async () => { throw Object.assign(new Error('Store problem'), { code: '2' }); } };
    expect(await b.buy('gems200')).toEqual({ ok: false, reason: 'error', code: '2', message: 'Store problem' });
  });

  it('reports a store that never started (no key, no Play Billing) as a plugin error', async () => {
    const got = capture();
    const p = new PurchaseService('play', new RevenueCatBackend(''));
    await p.start(createState(), mulberry32(1));
    expect(got[0]).toMatchObject({ event: 'error', props: { source: 'plugin', plugin: 'Purchases', method: 'start' } });
    expect(String(got[0].props.message)).toMatch(/VITE_REVENUECAT_KEY/);
  });

  it('builds the store bundle with the control plane’s sink unless one is set', () => {
    expect(STORE_TELEMETRY_URL).toMatch(/^https:\/\/[^/]+\/e$/);
    expect(storeTelemetryUrl({})).toBe(STORE_TELEMETRY_URL);
    expect(storeTelemetryUrl({ VITE_TELEMETRY_URL: 'https://elsewhere.example/e' })).toBe('https://elsewhere.example/e');
  });
});
