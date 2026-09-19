import { BOARD_SIZE, ECON, CARDS, ALBUM_PAGES } from '../data/catalog';

export const SAVE_VERSION = 5;

export type AgeBand = 'unknown' | 'adult' | 'minor';

/** A patron's request (RV-D2). `want` holds item ids; rewards are fixed when the order is posted. */
export interface Order {
  id: number;
  patron: number;
  want: number[];
  gold: number;
  gems: number;
  xp: number;
  pass: number;
  pts: number;
  card: boolean;
}

export interface GameState {
  v: number;
  /** 0 = empty socket, 1..9 = relic tier. Authoritative. */
  board: number[];
  /** relics waiting for space (chest/purchase overflow). Never lost. */
  satchel: number[];
  /** open patron orders (null = empty slot waiting `orderWait` actions to refill) */
  orders: (Order | null)[];
  orderWait: number[];
  orderSeq: number;
  /** generator level per chain; 0 = locked */
  gens: number[];
  /** best tier reached per chain */
  best: number[];
  gold: number;
  gems: number;
  xp: number;
  rank: number;
  piggy: number;
  pity: number;
  freeChests: number;
  album: number[];
  pagesDone: boolean[];
  crumbs: number;
  stats: {
    merges: number; forges: number; chests: number; sells: number; ads: number;
    maxTier: number; sessions: number; playSeconds: number; t4Merges: number; orders: number; bindings: number;
  };
  ent: {
    welcome: boolean; comeback: boolean; passPremium: boolean; vip: boolean; vipUntil: number;
    removeAds: boolean; skin: boolean; skinOn: boolean;
  };
  pass: { season: number; xp: number; free: number[]; prem: number[] };
  event: { cycle: number; points: number; claimed: number[]; boostUntil: number };
  quests: { day: number; forge: number; t4: number; chest: number; orders: number; claimed: number[] };
  daily: { vipCrateDay: number; adSpinsDay: number; adSpins: number };
  flags: Record<string, number>;
  age: AgeBand;
  lootboxesAllowed: boolean;
  settings: { muted: boolean; music: boolean; haptics: boolean };
  createdAt: number;
  purchases: { sku: string; t: number }[];
}

export function createState(now = Date.now()): GameState {
  const board = new Array(BOARD_SIZE).fill(0);
  board[14] = 1; // boot: one T1 in the (near) center socket
  return {
    v: SAVE_VERSION,
    board,
    satchel: [],
    orders: [null, null, null],
    orderWait: [0, 0, 0],
    orderSeq: 0,
    gens: [1, 0, 0],
    best: [1, 0, 0],
    gold: ECON.startGold,
    gems: ECON.startGems,
    xp: 0,
    rank: 1,
    piggy: 0,
    pity: 0,
    freeChests: 0,
    album: new Array(CARDS.length).fill(0),
    pagesDone: ALBUM_PAGES.map(() => false),
    crumbs: 0,
    stats: { merges: 0, forges: 0, chests: 0, sells: 0, ads: 0, maxTier: 1, sessions: 0, playSeconds: 0, t4Merges: 0, orders: 0, bindings: 0 },
    ent: { welcome: false, comeback: false, passPremium: false, vip: false, vipUntil: 0, removeAds: false, skin: false, skinOn: false },
    pass: { season: seasonId(now), xp: 0, free: [], prem: [] },
    event: { cycle: eventCycle(now), points: 0, claimed: [], boostUntil: 0 },
    quests: { day: utcDay(now), forge: 0, t4: 0, chest: 0, orders: 0, claimed: [] },
    daily: { vipCrateDay: -1, adSpinsDay: -1, adSpins: 0 },
    flags: {},
    age: 'unknown',
    lootboxesAllowed: true,
    settings: { muted: false, music: true, haptics: true },
    createdAt: now,
    purchases: [],
  };
}

export const DAY = 86400000;
export function utcDay(now: number) { return Math.floor(now / DAY); }
export function seasonId(now: number) { return Math.floor(now / (DAY * ECON.seasonDays)); }
export function seasonEndsAt(now: number) { return (seasonId(now) + 1) * DAY * ECON.seasonDays; }
// Events anchored to Friday 00:00 UTC (epoch day 1 = Friday Jan 2 1970)
const EVENT_ANCHOR = DAY * 1;
export function eventCycle(now: number) { return Math.floor((now - EVENT_ANCHOR) / (DAY * ECON.eventDays)); }
export function eventEndsAt(now: number) { return EVENT_ANCHOR + (eventCycle(now) + 1) * DAY * ECON.eventDays; }

/** Roll time-boxed containers (quests, event, season) forward. Pure. */
export function rollover(s: GameState, now: number) {
  const day = utcDay(now);
  if (s.quests.day !== day) s.quests = { day, forge: 0, t4: 0, chest: 0, orders: 0, claimed: [] };
  const cyc = eventCycle(now);
  if (s.event.cycle !== cyc) s.event = { cycle: cyc, points: 0, claimed: [], boostUntil: 0 };
  const sea = seasonId(now);
  if (s.pass.season !== sea) s.pass = { season: sea, xp: 0, free: [], prem: [] };
  if (s.ent.vip && s.ent.vipUntil && now > s.ent.vipUntil) s.ent.vip = false;
}

// ---------------- migrations ----------------
type Raw = any;
const MIGRATIONS: Record<number, (r: Raw, now: number) => Raw> = {
  // v1 -> v2: board used null for empty; no satchel
  1: (r) => {
    r.board = (r.board || []).map((x: number | null) => (x == null ? 0 : x));
    r.satchel = r.satchel || [];
    r.v = 2;
    return r;
  },
  // v2 -> v3: pass & event containers were flat numbers
  2: (r, now) => {
    if (typeof r.passXp === 'number') {
      r.pass = { season: seasonId(now), xp: r.passXp, free: [], prem: [] };
      delete r.passXp;
    }
    if (typeof r.eventPoints === 'number') {
      r.event = { cycle: eventCycle(now), points: r.eventPoints, claimed: [], boostUntil: 0 };
      delete r.eventPoints;
    }
    r.v = 3;
    return r;
  },
  // v3 -> v4 (Deepen cycle 1): chains, generators, patron orders
  3: (r) => {
    const rank = r.rank || 1;
    r.gens = [1, rank >= 3 ? 1 : 0, rank >= 6 ? 1 : 0];
    r.best = [Math.max(1, r.stats?.maxTier || 1), 0, 0];
    r.orders = [null, null, null];
    r.orderWait = [0, 0, 0];
    r.orderSeq = 0;
    r.v = 4;
    return r;
  },
  // v4 -> v5 (Board, #328): the pig stores gems now; the old store was gold (up to 600) and is not carried over
  4: (r) => {
    r.piggy = 0;
    r.v = 5;
    return r;
  },
};

function fill<T>(def: T, raw: any): T {
  if (raw === undefined || raw === null) return def;
  if (Array.isArray(def)) return (Array.isArray(raw) ? raw : def) as T;
  if (typeof def === 'object') {
    const out: any = { ...def };
    for (const k of Object.keys(def as any)) out[k] = fill((def as any)[k], raw[k]);
    // keep unknown flag keys
    if (k_isRecord(def)) for (const k of Object.keys(raw)) if (!(k in out)) out[k] = raw[k];
    return out;
  }
  return (typeof raw === typeof def ? raw : def) as T;
}
function k_isRecord(o: any) { return o && typeof o === 'object' && Object.keys(o).length === 0; }

export function migrate(raw: Raw, now = Date.now()): GameState {
  if (!raw || typeof raw !== 'object') return createState(now);
  let r = JSON.parse(JSON.stringify(raw));
  let v = typeof r.v === 'number' ? r.v : 1;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) break;
    r = m(r, now);
    v = r.v;
  }
  const s = fill(createState(now), r);
  s.v = SAVE_VERSION;
  if (s.board.length !== BOARD_SIZE) {
    const b = new Array(BOARD_SIZE).fill(0);
    s.board.slice(0, BOARD_SIZE).forEach((t, i) => (b[i] = t | 0));
    s.board = b;
  }
  if (s.album.length !== CARDS.length) {
    const a = new Array(CARDS.length).fill(0);
    s.album.forEach((x, i) => { if (i < a.length) a[i] = x; });
    s.album = a;
  }
  // the $4.99 pack was called gems80 while it granted 200 gems; keep old purchase history readable
  for (const p of s.purchases) if (p.sku === 'gems80') p.sku = 'gems200';
  rollover(s, now);
  return s;
}
