export interface AnalyticsEvent {
  t: number;
  type: string;
  sku?: string;
  trigger?: string;
  sessionSeconds: number;
  rank: number;
  gems: number;
  gold: number;
  [k: string]: unknown;
}

/**
 * Local ring buffer of monetization events (offer impressions, IAP clicks, purchases).
 * Every entry carries sku, trigger, sessionSeconds, rank, gems, gold.
 * `forward` lets the Orchestrata telemetry layer mirror the events it cares about.
 */
export class Analytics {
  buf: AnalyticsEvent[] = [];
  constructor(
    public cap = 256,
    private ctx: () => { sessionSeconds: number; rank: number; gems: number; gold: number },
    private forward?: (e: AnalyticsEvent) => void,
  ) {}
  log(type: string, extra: Record<string, unknown> = {}) {
    const e = { t: Date.now(), type, ...this.ctx(), ...extra } as AnalyticsEvent;
    this.buf.push(e);
    if (this.buf.length > this.cap) this.buf.splice(0, this.buf.length - this.cap);
    try { this.forward?.(e); } catch { /* never break play */ }
    return e;
  }
  count(type: string) { return this.buf.filter((e) => e.type === type).length; }
  load(arr: unknown) { if (Array.isArray(arr)) this.buf = arr.slice(-this.cap) as AnalyticsEvent[]; }
}
