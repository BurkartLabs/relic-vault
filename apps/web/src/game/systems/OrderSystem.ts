import { ECON } from '../data/catalog';
import { CHAINS, PATRONS, BINDINGS, itemId, itemWork, buildGold, chainOf, tierOf, isTop } from '../data/items';
import type { GameState, Order } from './State';
import { noteFloorAction } from './Chronicle';
import { liveChains } from './Floors';
import type { Rng } from './Rng';
import { grantGold, addXp, grantCard, CardResult } from './Economy';

/**
 * Patron Orders (DEPTH.md RV-D2). Three named patrons always want specific relics.
 * Orders never expire on a wall clock. Dismissing one is free; its slot refills after a few actions.
 * They are the main source of gold, rank XP, pass XP and Rush points, so what you keep matters.
 */
const O = ECON.orders;

/**
 * Chains a patron may ask for: unlocked **and** live on this floor.
 *
 * Descending leaves the floor above's generator level alone, which is deliberate — taking it back would make
 * descending a punishment — but it also means `gens[0]` stays above zero for ever. Without the second condition a
 * patron on the Frost Ledger would ask for a Flint Shard the player has no way to forge, and an order nobody can
 * fill is worse than no order: it sits in a slot, pays nothing, and teaches the player to ignore the system
 * (T-005, "if ignoring a system is the optimal play, it is an economy bug").
 */
function unlockedChains(s: GameState) {
  const live = liveChains(s);
  return CHAINS.filter((c) => (s.gens[c.id] ?? 0) > 0 && live.includes(c.id)).map((c) => c.id);
}

/**
 * Highest tier a patron may ask for in a chain: usually your best, sometimes one past it (a stretch goal),
 * never past the top, and never a tier whose binding chain you have not unlocked yet.
 */
function askCap(s: GameState, chain: number, rng: Rng) {
  const best = Math.max(1, s.best[chain] ?? 1);
  let cap = Math.min(CHAINS[chain].maxTier, best + (rng() < 0.2 ? 1 : 0));
  while (cap > 2) {
    const b = BINDINGS[itemId(chain, cap)];
    if (!b || (s.gens[chainOf(b)] ?? 0) > 0) break;
    cap--;
  }
  // never ask for a tier-1 relic: that is what the generators hand out (and what the tutorial holds)
  return Math.max(2, cap);
}

export function generateOrder(s: GameState, rng: Rng): Order {
  // three open orders come from three different patrons and never ask for the identical set
  const open = s.orders.filter((o): o is Order => !!o);
  const free = PATRONS.filter((p) => !open.some((o) => o.patron === p.id));
  const pool = free.length ? free : PATRONS;
  let best: Order | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const o = rollOrder(s, rng, pool[Math.floor(rng() * pool.length)]);
    best = o;
    if (!open.some((x) => x.want.join() === o.want.join())) break;
  }
  s.orderSeq++;
  best!.id = s.orderSeq;
  if (s.orderSeq % O.gemsEvery === 0) best!.gems = O.gems[0] + Math.floor(rng() * (O.gems[1] - O.gems[0] + 1));
  return best!;
}

function rollOrder(s: GameState, rng: Rng, patron: (typeof PATRONS)[number]): Order {
  const chains = unlockedChains(s);
  // later ranks ask for more items; a patron leans toward their favourite chain when it is unlocked
  const maxItems = Math.min(O.maxItems, 1 + Math.floor(s.rank / 3));
  const n = 1 + Math.floor(rng() * maxItems);
  const want: number[] = [];
  for (let k = 0; k < n; k++) {
    const chain = chains.includes(patron.likes) && rng() < 0.6 ? patron.likes : chains[Math.floor(rng() * chains.length)];
    const cap = askCap(s, chain, rng);
    const lo = Math.max(2, cap - 2);
    const tier = Math.min(cap, lo + Math.floor(rng() * (cap - lo + 1)));
    want.push(itemId(chain, tier));
  }
  want.sort((a, b) => a - b);
  const work = want.reduce((a, id) => a + itemWork(id), 0);
  const bonus = 1 + 0.15 * (n - 1); // multi-item orders pay a premium: they tie up space
  // A patron must beat both alternatives: keeping the relic (the merge gold it already paid) and, at the top of a
  // chain, ascending it (Bug #333, Board RV-B9).
  const itemGold = (id: number) => Math.max(buildGold(id, ECON.mergeGold) * O.goldMultiplier, isTop(id) ? CHAINS[chainOf(id)].value * ECON.ascendGold * O.topAscendShare : 0);
  return {
    id: 0,
    patron: patron.id,
    want,
    gold: Math.round(want.reduce((a, id) => a + itemGold(id), 0) * bonus),
    xp: Math.max(2, Math.round(work * O.xpPerWork * bonus)),
    pass: Math.max(1, Math.round(Math.sqrt(work) * O.passPerRootWork)),
    pts: Math.max(1, Math.round(work * O.ptsPerWork)),
    gems: 0,
    card: rng() < O.cardChance,
  };
}

/** Fill empty slots whose wait has run out. Returns the slots that received a new order. */
export function refillOrders(s: GameState, rng: Rng): number[] {
  const filled: number[] = [];
  for (let i = 0; i < O.slots; i++) {
    if (s.orders[i] == null && (s.orderWait[i] ?? 0) <= 0) { s.orders[i] = generateOrder(s, rng); filled.push(i); }
  }
  return filled;
}

/** Called after every core action (forge, merge, sell, deliver): wait counters are action-based, not clock-based. */
export function tickOrders(s: GameState, rng: Rng): number[] {
  for (let i = 0; i < O.slots; i++) if (s.orders[i] == null && s.orderWait[i] > 0) s.orderWait[i]--;
  return refillOrders(s, rng);
}

/** Board sockets that would satisfy an order, or null if something is missing. */
export function matchOrder(s: GameState, o: Order): number[] | null {
  const used = new Set<number>();
  const out: number[] = [];
  for (const id of o.want) {
    let found = -1;
    for (let i = 0; i < s.board.length; i++) if (!used.has(i) && s.board[i] === id) { found = i; break; }
    if (found < 0) return null;
    used.add(found);
    out.push(found);
  }
  return out;
}

/** How many of the wanted items are on the board right now (for progress pips). */
export function orderProgress(s: GameState, o: Order): boolean[] {
  const used = new Set<number>();
  return o.want.map((id) => {
    for (let i = 0; i < s.board.length; i++) if (!used.has(i) && s.board[i] === id) { used.add(i); return true; }
    return false;
  });
}

export interface DeliverResult {
  ok: boolean;
  slot: number;
  order?: Order;
  sockets: number[];
  rankUps: number;
  card?: CardResult;
}

export function deliver(s: GameState, slot: number, rng: Rng, now = Date.now()): DeliverResult {
  const o = s.orders[slot];
  if (!o) return { ok: false, slot, sockets: [], rankUps: 0 };
  const sockets = matchOrder(s, o);
  if (!sockets) return { ok: false, slot, sockets: [], rankUps: 0, order: o };
  for (const i of sockets) s.board[i] = 0;
  grantGold(s, o.gold);
  s.gems += o.gems;
  const rankUps = addXp(s, o.xp);
  s.pass.xp += o.pass;
  s.event.points += o.pts * (s.event.boostUntil > now ? 2 : 1);
  s.stats.orders++;
  s.quests.orders++;
  noteFloorAction(s, 'orders');
  let card: CardResult | undefined;
  if (o.card) card = grantCard(s, rng);
  s.orders[slot] = null;
  s.orderWait[slot] = 0; // a filled order is replaced right away
  refillOrders(s, rng);
  return { ok: true, slot, order: o, sockets, rankUps, card };
}

/** Free: the patron leaves, a new one arrives after `dismissWait` actions. */
export function dismissOrder(s: GameState, slot: number): boolean {
  if (!s.orders[slot]) return false;
  s.orders[slot] = null;
  s.orderWait[slot] = O.dismissWait;
  return true;
}

/** Items an open order is waiting for, by id → count (the planner keeps these). */
export function wantedCounts(s: GameState): Map<number, number> {
  const m = new Map<number, number>();
  for (const o of s.orders) if (o) for (const id of o.want) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export { chainOf, tierOf };
