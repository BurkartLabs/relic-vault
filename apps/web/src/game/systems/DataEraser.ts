import { clear, keys } from 'idb-keyval';
import type { SaveService } from './SaveService';

/**
 * AB#4726: "Delete my data". Everything Relic Vault keeps on a device goes: the save, the analytics log, the copy of an
 * unreadable save, the device id the telemetry sends (rv_did), and whatever an ad or store SDK caches. The page then
 * reloads as a new player.
 *
 * What is ours: every localStorage key starting `relic-vault` or `rv_`, and idb-keyval's default store, which nothing
 * but this game writes on its origin. An SDK that keeps its own cache registers a way to clear it (registerDataEraser)
 * when it is integrated. Neither AdMob nor RevenueCat is in the build yet, so nothing is registered today.
 *
 * Before anything is cleared, the save service stops writing for the rest of this page's life. Otherwise the pagehide
 * autosave (GameCtx) would write the save straight back during the reload.
 */
export const OWN_KEY = /^(relic-vault|rv_)/;

const erasers: { name: string; run: () => unknown }[] = [];

/** An SDK's own local cache, cleared by Delete my data (AdMob, RevenueCat, when they land). */
export function registerDataEraser(name: string, run: () => unknown) {
  erasers.push({ name, run });
}

/** This game's keys in a Storage (localStorage or sessionStorage). */
export function ownKeys(storage: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && OWN_KEY.test(k)) out.push(k);
  }
  return out;
}

export interface ErasedCheck { localStorage: string[]; sessionStorage: string[]; indexedDB: string[] }

/** What is left afterwards, read back from the storage itself: empty lists when the erase worked. */
export async function whatRemains(): Promise<ErasedCheck> {
  let idb: string[] = [];
  try { idb = (await keys()).map(String); } catch { /* no IndexedDB */ }
  const safe = (s: () => Storage) => { try { return ownKeys(s()); } catch { return []; } };
  return { localStorage: safe(() => localStorage), sessionStorage: safe(() => sessionStorage), indexedDB: idb };
}

/** Clears everything above. Returns what remains, which should be nothing. */
export async function deleteMyData(save: SaveService): Promise<ErasedCheck> {
  save.halt();
  await save.reset();
  try { await clear(); } catch { /* no IndexedDB: the localStorage copies below are the whole of it */ }
  for (const s of [() => localStorage, () => sessionStorage]) {
    try { const st = s(); for (const k of ownKeys(st)) st.removeItem(k); } catch { /* private mode */ }
  }
  for (const e of erasers) {
    try { await e.run(); } catch { /* one SDK failing must not keep the rest */ }
  }
  return whatRemains();
}
