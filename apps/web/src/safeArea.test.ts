import { describe, it, expect } from 'vitest';
import { measureSafe, watchSafeArea, SAFE_AREA_EVENT, SAFE_PROBE_CSS } from './safeArea';
// @ts-ignore: a Node script, tested here because vitest runs apps/web/src's tests (AB#4723)
import { signingProblems, toolchainProblems, SIGNING_VARS } from '../../../scripts/android.mjs';

// AB#4723: the Android app's insets reach the HUD and the Dock through the same measureSafe() the web uses. The CSS
// itself (env() and Capacitor's --safe-area-inset-*) is measured in a real browser by e2e/android-safe-area.spec.ts;
// here, the rule order and the announcement, with a stand-in document.
function fakePage(padding: { top: string; bottom: string }) {
  const events: string[] = [];
  let observed: (() => void) | null = null;
  const doc = {
    body: { appendChild: () => undefined },
    documentElement: {},
    createElement: () => ({ style: { cssText: '' }, remove: () => undefined }),
  } as any;
  const win = {
    getComputedStyle: () => ({ paddingTop: padding.top, paddingBottom: padding.bottom }),
    dispatchEvent: (e: Event) => { events.push(e.type); return true; },
  } as any;
  class Observer { constructor(cb: () => void) { observed = cb; } observe() {} disconnect() {} }
  return { doc, win, events, Observer: Observer as any, change: () => observed?.() };
}

describe('safe areas (AB#4723)', () => {
  it('writes the env() rule before the max() rule, so a browser without max() keeps the web behaviour', () => {
    expect(SAFE_PROBE_CSS.indexOf('padding-top:env(safe-area-inset-top)')).toBeLessThan(SAFE_PROBE_CSS.indexOf('padding-top:max('));
    expect(SAFE_PROBE_CSS).toContain('var(--safe-area-inset-top, 0px)');
    expect(SAFE_PROBE_CSS).toContain('var(--safe-area-inset-bottom, 0px)');
  });

  it('sets __safeTop and __safeBottom from the measured padding', () => {
    const p = fakePage({ top: '24px', bottom: '48px' });
    expect(measureSafe(p.doc, p.win)).toEqual({ top: 24, bottom: 48 });
    expect([p.win.__safeTop, p.win.__safeBottom]).toEqual([24, 48]);
  });

  it('announces a change when <html>\'s style moves the insets, and stays quiet when it does not', () => {
    const padding = { top: '0px', bottom: '0px' };
    const p = fakePage(padding);
    measureSafe(p.doc, p.win);
    watchSafeArea(p.doc, p.win, p.Observer);
    p.change();
    expect(p.events).toEqual([]);
    padding.top = '31px'; padding.bottom = '24px';
    p.change();
    expect(p.events).toEqual([SAFE_AREA_EVENT]);
    expect([p.win.__safeTop, p.win.__safeBottom]).toEqual([31, 24]);
  });
});

describe('android:bundle refuses to build without its signing variables (AB#4723)', () => {
  const all = Object.fromEntries(SIGNING_VARS.map((n: string) => [n, n === 'RELIC_VAULT_KEYSTORE_PATH' ? 'C:/keys/upload.jks' : 'x']));

  it('names every unset variable, and never a value', () => {
    const [problem] = signingProblems({}, () => true);
    for (const name of SIGNING_VARS) expect(problem).toContain(name);
    const partly = signingProblems({ ...all, RELIC_VAULT_KEY_PASSWORD: '' }, () => true);
    expect(partly[0]).toContain('RELIC_VAULT_KEY_PASSWORD');
    expect(partly[0]).not.toContain('RELIC_VAULT_KEY_ALIAS');
    expect(partly.join(' ')).not.toContain('C:/keys/upload.jks');
  });

  it('refuses a keystore path that is not a file, and passes when all is there', () => {
    expect(signingProblems(all, () => false)).toEqual(['RELIC_VAULT_KEYSTORE_PATH does not name a keystore file that exists.']);
    expect(signingProblems(all, () => true)).toEqual([]);
  });

  it('says which of the JDK and the Android SDK is missing', () => {
    expect(toolchainProblems({}, { javaOnPath: false, localProperties: '' })).toHaveLength(2);
    expect(toolchainProblems({ JAVA_HOME: 'x' }, { javaOnPath: false, localProperties: 'sdk.dir=C\\:\\\\Android' })).toEqual([]);
  });
});
