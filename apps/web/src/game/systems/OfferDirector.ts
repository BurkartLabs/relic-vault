import { ECON } from '../data/catalog';
import type { GameState } from './State';
import type { MergeResult } from './MergeSystem';
import { eventMilestoneIndex } from './Economy';

export type OfferId = 'welcome' | 'comeback' | 'jammed' | 'shopBest' | 'doubleIt' | 'piggy' | 'passUpsell' | 'boost' | 'vip';

export interface OfferRequest { id: OfferId; trigger: string; delayMs: number }

/**
 * First-session conversion script. Phaser-free: decides WHAT to show and WHEN,
 * persists one-shot flags in state.flags, never fires two surfaces at once.
 */
export class OfferDirector {
  queue: OfferRequest[] = [];
  constructor(private s: () => GameState) {}

  private once(flag: string): boolean {
    const f = this.s().flags;
    if (f[flag]) return false;
    f[flag] = 1;
    return true;
  }

  private push(r: OfferRequest) {
    if (this.queue.some((q) => q.id === r.id)) return;
    this.queue.push(r);
  }

  onMerge(r: MergeResult) {
    const s = this.s();
    if (!r.ok) return;
    if (s.stats.merges === 1 && !s.ent.welcome && this.once('offer_welcome')) {
      this.push({ id: 'welcome', trigger: 'first_merge', delayMs: 1500 });
    }
    if ((s.stats.merges >= 8 || r.tier >= 4) && !s.ent.comeback && s.stats.merges > 1 && this.once('offer_comeback')) {
      this.push({ id: 'comeback', trigger: r.tier >= 4 ? 'first_t4' : 'merge_8', delayMs: 900 });
    }
    if (s.stats.merges >= 20 && this.once('offer_shop20')) {
      this.push({ id: 'shopBest', trigger: 'merge_20', delayMs: 700 });
    }
    const m = eventMilestoneIndex(s);
    if (m >= 1 && !s.ent.passPremium && this.once('offer_pass')) {
      this.push({ id: 'passUpsell', trigger: 'event_milestone_1', delayMs: 1100 });
    }
  }

  onBoardFull() {
    this.push({ id: 'jammed', trigger: 'board_full', delayMs: 0 });
  }

  onAdComplete() {
    if (this.once('offer_double')) this.push({ id: 'doubleIt', trigger: 'first_ad', delayMs: 400 });
  }

  /** Called every second or so. */
  tick(now: number, eventEnds: number) {
    const s = this.s();
    if (s.piggy >= ECON.piggyNagAt && this.once('offer_piggy')) {
      this.push({ id: 'piggy', trigger: 'piggy_200', delayMs: 300 });
    }
    const left = eventEnds - now;
    const cycleFlag = `offer_boost_${s.event.cycle}`;
    if (left < 48 * 3600000 && s.event.points > 0 && s.stats.merges >= 30 && this.once(cycleFlag)) {
      this.push({ id: 'boost', trigger: 'event_last_48h', delayMs: 500 });
    }
    if (s.stats.merges >= 60 && !s.ent.vip && this.once('offer_vip')) {
      this.push({ id: 'vip', trigger: 'merge_60', delayMs: 600 });
    }
  }

  next(): OfferRequest | undefined {
    return this.queue.shift();
  }
}
