import { ECON } from '../data/catalog';
import type { GameState } from './State';
import type { MergeResult } from './MergeSystem';
import { eventMilestoneIndex } from './Economy';
import { welcomeOpen } from './Offers';

export type OfferId = 'welcome' | 'comeback' | 'shopBest' | 'doubleIt' | 'piggy' | 'passUpsell' | 'vip';

export interface OfferRequest { id: OfferId; trigger: string; delayMs: number }

/**
 * RV-M8 (AB#383): pushed offers per session. A session is one boot (state.stats.sessions, which GameCtx.boot counts),
 * the same span as telemetry's session_id. RV-B8 keeps offers out of a streak; this keeps a long session from being
 * sold to over and over: seven offer ids, about five reachable in one long first session, and now one of them shown.
 * The shop is not an offer here: the player opens it.
 */
export const PUSHED_OFFERS_PER_SESSION = 1;

/**
 * First-session conversion script. Phaser-free: decides WHAT to show and WHEN,
 * persists one-shot flags in state.flags, never fires two surfaces at once.
 */
export class OfferDirector {
  queue: OfferRequest[] = [];
  constructor(private s: () => GameState) {}

  /**
   * Whether this session has had its pushed offers. Fails closed: a session counter that did not load (missing, not a
   * whole number) reads as a session already at its cap, so a broken save means fewer offers, never more.
   */
  sessionCapped(): boolean {
    const s = this.s();
    const session = s.stats?.sessions;
    if (!Number.isInteger(session) || session < 0) return true;
    return s.flags.offers_session === session && (s.flags.offers_pushed ?? 0) >= PUSHED_OFFERS_PER_SESSION;
  }

  /**
   * Push a one-shot offer. Its flag is set only when it is pushed, so an offer the session cap holds back is not lost:
   * its trigger fires again in a later session (every trigger but the first merge's is a standing condition).
   */
  private offer(flag: string, r: OfferRequest) {
    const s = this.s();
    const f = s.flags;
    if (f[flag]) return;
    // Soul: we do not ship to children as a growth hack. Under-16 profiles never get pushed offers;
    // the shop stays reachable, and the Vault Jammed helper (not an offer) still appears.
    if (s.age === 'minor') { f[flag] = 1; return; } // minors are sold nothing at all (the one exception, the board-full sheet, is gone)
    if (this.queue.some((q) => q.id === r.id) || this.sessionCapped()) return;
    f[flag] = 1;
    if (f.offers_session !== s.stats.sessions) { f.offers_session = s.stats.sessions; f.offers_pushed = 0; }
    f.offers_pushed = (f.offers_pushed ?? 0) + 1;
    this.queue.push(r);
  }

  onMerge(r: MergeResult) {
    const s = this.s();
    if (!r.ok) return;
    if (s.stats.merges === 1 && welcomeOpen(s, Date.now())) {
      this.offer('offer_welcome', { id: 'welcome', trigger: 'first_merge', delayMs: 1500 });
    }
    if ((s.stats.merges >= 8 || r.tier >= 4) && !s.ent.comeback && s.stats.merges > 1) {
      this.offer('offer_comeback', { id: 'comeback', trigger: r.tier >= 4 ? 'first_t4' : 'merge_8', delayMs: 900 });
    }
    if (s.stats.merges >= 20) {
      this.offer('offer_shop20', { id: 'shopBest', trigger: 'merge_20', delayMs: 700 });
    }
    const m = eventMilestoneIndex(s);
    if (m >= 1 && !s.ent.passPremium) {
      this.offer('offer_pass', { id: 'passUpsell', trigger: 'event_milestone_1', delayMs: 1100 });
    }
  }

  onAdComplete() {
    this.offer('offer_double', { id: 'doubleIt', trigger: 'first_ad', delayMs: 400 });
  }

  /** Called every second or so. */
  tick(now: number, eventEnds: number) {
    const s = this.s();
    if (s.piggy >= ECON.piggyNagAt) {
      this.offer('offer_piggy', { id: 'piggy', trigger: 'piggy_200', delayMs: 300 });
    }
    // RV-D6 (Depth review #2): the Rush Boost is never pushed. With paced events a deadline pop-up
    // selling "finish faster" is FOMO, which RUBRIC scores as coercion. It stays in the Events panel.
    void eventEnds; void now;
    if (s.stats.merges >= 60 && !s.ent.vip) {
      this.offer('offer_vip', { id: 'vip', trigger: 'merge_60', delayMs: 600 });
    }
  }

  next(): OfferRequest | undefined {
    return this.queue.shift();
  }
}
