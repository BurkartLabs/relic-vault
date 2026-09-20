/**
 * Orchestrata minimum viable instrumentation (see Orchestrata/TELEMETRY.md).
 *
 * Identity: anonymous distinct_id (per device), session_id (per boot), app version, platform.
 * Sink: events are always kept in a local ring buffer (inspectable at ?debug=1 and via
 * window.__rv.telemetry). If VITE_TELEMETRY_URL is set at build time, batches are also POSTed
 * there as JSON (sendBeacon on hide). No endpoint is configured by default: choosing and
 * paying for one is a Board decision (GOVERNANCE.md).
 */
export interface TelemetryEvent {
  event: string;
  t: number;
  distinct_id: string;
  session_id: string;
  app_version: string;
  platform: string;
  props: Record<string, unknown>;
}

function uuid() {
  try { return crypto.randomUUID(); } catch { return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

export class Telemetry {
  buf: TelemetryEvent[] = [];
  distinctId: string;
  sessionId = uuid();
  bootAt = Date.now();
  verbCount = 0;
  actions = 0;
  private pending: TelemetryEvent[] = [];
  private ended = false;

  constructor(public version: string, public platform: string, private endpoint?: string, private cap = 500) {
    let id: string | null = null;
    try { id = localStorage.getItem('rv_did'); } catch { /* private mode */ }
    if (!id) { id = uuid(); try { localStorage.setItem('rv_did', id); } catch { /* */ } }
    this.distinctId = id;
    if (this.endpoint && typeof window !== 'undefined') setInterval(() => this.flush(), 10000);
  }

  track(event: string, props: Record<string, unknown> = {}) {
    const e: TelemetryEvent = {
      event, t: Date.now(), distinct_id: this.distinctId, session_id: this.sessionId,
      app_version: this.version, platform: this.platform, props,
    };
    this.buf.push(e);
    if (this.buf.length > this.cap) this.buf.splice(0, this.buf.length - this.cap);
    if (this.endpoint) {
      this.pending.push(e);
      // the funnel's key events should not wait for the 10s batch
      if (event === 'app_open' || event === 'verb_first' || event === 'purchase_demo' || event === 'error') setTimeout(() => this.flush(), 300);
    }
    return e;
  }

  /** Core verb bookkeeping: first merge in the session is verb_first, later ones verb_repeat. */
  verb() {
    this.verbCount++;
    this.actions++;
    if (this.verbCount === 1) this.track('verb_first', { latency_ms: Date.now() - this.bootAt });
    else this.track('verb_repeat', { count_in_session: this.verbCount });
  }

  /**
   * Bug #326. Hiding the tab used to send `session_end`, and `resume()` re-armed it, so one 22-minute boot
   * produced **270 session_end events** — one every few seconds while the tab sat idle in a browser pane. Any
   * retention or session-length number read from session counts was wrong by two orders of magnitude, and those
   * are the first numbers the company would have trusted.
   *
   * A hide is not an end. On mobile it is often the only moment we get, so it is still worth recording — as
   * `session_pause`, which is cheap to count and impossible to confuse with a session. A session ends once:
   * on `pagehide`, or after the tab has been hidden longer than the TELEMETRY.md timeout.
   */
  static readonly HIDDEN_TIMEOUT_MS = 30 * 60_000;
  private hiddenAt = 0;
  private pauses = 0;

  /** The tab went away. Records a pause, and ends the session only if it stays away past the timeout. */
  pause() {
    if (this.ended || this.hiddenAt) return;
    this.hiddenAt = Date.now();
    this.pauses++;
    this.track('session_pause', { duration_s: Math.round((Date.now() - this.bootAt) / 1000), actions: this.actions, n_pause: this.pauses });
    this.flush(true);
  }

  /** The tab came back. Same session, unless it was away long enough that TELEMETRY.md calls it a new one. */
  resume() {
    if (this.hiddenAt && Date.now() - this.hiddenAt >= Telemetry.HIDDEN_TIMEOUT_MS) this.sessionEnd('timeout');
    this.hiddenAt = 0;
  }

  /** The session is over: the page is going away, or it was hidden past the timeout. Sent at most once. */
  sessionEnd(reason: 'pagehide' | 'timeout' = 'pagehide') {
    if (this.ended) return;
    this.ended = true;
    this.track('session_end', { duration_s: Math.round((Date.now() - this.bootAt) / 1000), actions: this.actions, pauses: this.pauses, reason });
    this.flush(true);
  }

  flush(beacon = false) {
    if (!this.endpoint || !this.pending.length) return;
    const body = JSON.stringify(this.pending.splice(0));
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(this.endpoint, body);
      // text/plain keeps this a CORS "simple request" (no preflight); the collector parses JSON anyway
      else void fetch(this.endpoint, { method: 'POST', body, headers: { 'content-type': 'text/plain' }, keepalive: true }).catch(() => {});
    } catch { /* never let telemetry break play */ }
  }

  count(event: string) { return this.buf.filter((e) => e.event === event).length; }
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
