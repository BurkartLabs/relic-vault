import { get, set, del } from 'idb-keyval';
import { GameState, migrate, createState } from './State';

const KEY = 'relic-vault-save';
const AKEY = 'relic-vault-analytics';
/** Bug #443: where a save we could not read is kept, so a later build can still recover it. */
const BROKEN_KEY = 'relic-vault-save-unreadable';

/** IndexedDB first, localStorage fallback. Schema-versioned via migrate(). */
export class SaveService {
  private idbOk = true;
  /**
   * Set when the stored save could not be read at all. The scene shows this to the player, because starting
   * them silently at zero with no explanation is its own kind of data loss.
   */
  unreadable: string | null = null;

  async load(): Promise<GameState> {
    let raw: unknown = null;
    try { raw = await get(KEY); } catch { this.idbOk = false; }
    if (!raw) {
      try { const ls = localStorage.getItem(KEY); if (ls) raw = JSON.parse(ls); } catch { /* ignore */ }
    }
    if (!raw) return createState();
    try {
      return migrate(raw);
    } catch (e) {
      /**
       * Bug #443: `migrate` threw here and nothing caught it, so the loading screen sat at "opening the vault"
       * forever and the only way back into the game was to clear site data — which destroys the save. One bad
       * field cost the player everything they had.
       *
       * Two rules now hold whatever the save contains. **Never hang**: an unreadable save starts a new one.
       * **Never destroy**: the bytes are copied somewhere safe first, so a build that fixes the cause can still
       * read them, and the player is told rather than left to guess.
       */
      this.unreadable = String((e as Error)?.message ?? e).slice(0, 200);
      try { await set(BROKEN_KEY, raw); } catch { /* */ }
      try { localStorage.setItem(BROKEN_KEY, JSON.stringify(raw)); } catch { /* quota: the idb copy is the one that matters */ }
      return createState();
    }
  }

  async save(s: GameState) {
    const snap = JSON.parse(JSON.stringify(s));
    if (this.idbOk) {
      try { await set(KEY, snap); } catch { this.idbOk = false; }
    }
    try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* quota / private mode */ }
  }

  async loadAnalytics(): Promise<unknown> {
    try { return (await get(AKEY)) ?? JSON.parse(localStorage.getItem(AKEY) || '[]'); } catch { return []; }
  }
  async saveAnalytics(buf: unknown[]) {
    try { await set(AKEY, buf); } catch { try { localStorage.setItem(AKEY, JSON.stringify(buf)); } catch { /* */ } }
  }

  async reset() {
    try { await del(KEY); await del(AKEY); await del(BROKEN_KEY); } catch { /* */ }
    try { localStorage.removeItem(KEY); localStorage.removeItem(AKEY); localStorage.removeItem(BROKEN_KEY); } catch { /* */ }
    this.unreadable = null;
  }
}
