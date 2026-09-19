import { get, set, del } from 'idb-keyval';
import { GameState, migrate, createState } from './State';

const KEY = 'relic-vault-save';
const AKEY = 'relic-vault-analytics';

/** IndexedDB first, localStorage fallback. Schema-versioned via migrate(). */
export class SaveService {
  private idbOk = true;

  async load(): Promise<GameState> {
    let raw: unknown = null;
    try { raw = await get(KEY); } catch { this.idbOk = false; }
    if (!raw) {
      try { const ls = localStorage.getItem(KEY); if (ls) raw = JSON.parse(ls); } catch { /* ignore */ }
    }
    return raw ? migrate(raw) : createState();
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
    try { await del(KEY); await del(AKEY); } catch { /* */ }
    try { localStorage.removeItem(KEY); localStorage.removeItem(AKEY); } catch { /* */ }
  }
}
