/**
 * The phone's safe areas (notch, status bar, gesture bar) in CSS pixels, which VaultScene turns into the HUD's and the
 * Dock's offsets (window.__safeTop, window.__safeBottom).
 *
 * On the web they are CSS env(safe-area-inset-*), as they always were. In the Android app (AB#4723, docs/ANDROID.md)
 * Capacitor's SystemBars plugin also writes --safe-area-inset-* on <html> from the native insets, and it does so after
 * the page has started, so:
 * - the larger of the two is used. With a WebView that pads itself inside the bars both are 0; with one that runs edge
 *   to edge both are the insets;
 * - the env() rule is written first and the max() one after it, so a browser without CSS max() keeps the env() value;
 * - watchSafeArea() measures again when <html>'s style changes, and announces a change (SAFE_AREA_EVENT) so the vault
 *   lays itself out again, as it does on a resize.
 */
export const SAFE_AREA_EVENT = 'rv-safe-area';

type Doc = Pick<Document, 'createElement' | 'body' | 'documentElement'>;
type Win = { getComputedStyle(el: Element): { paddingTop: string; paddingBottom: string }; dispatchEvent(e: Event): boolean } & Record<string, any>;

export const SAFE_PROBE_CSS = [
  'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none',
  'padding-top:env(safe-area-inset-top)',
  'padding-bottom:env(safe-area-inset-bottom)',
  'padding-top:max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))',
  'padding-bottom:max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))',
].join(';');

export function measureSafe(doc: Doc = document, win: Win = window as unknown as Win) {
  const probe = doc.createElement('div');
  probe.style.cssText = SAFE_PROBE_CSS;
  doc.body.appendChild(probe);
  const cs = win.getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  win.__safeTop = top;
  win.__safeBottom = bottom;
  return { top, bottom };
}

/** Measures again whenever <html>'s style changes, and announces a change. Returns the unsubscribe. */
export function watchSafeArea(doc: Doc = document, win: Win = window as unknown as Win, Observer: typeof MutationObserver = MutationObserver) {
  const observer = new Observer(() => {
    const before = [win.__safeTop, win.__safeBottom];
    const now = measureSafe(doc, win);
    if (now.top !== before[0] || now.bottom !== before[1]) win.dispatchEvent(new Event(SAFE_AREA_EVENT));
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['style'] });
  return () => observer.disconnect();
}
