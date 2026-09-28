/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ownKeys, OWN_KEY } from './DataEraser';
import { adsSentence } from '../buildMode';

// AB#4726: the privacy policy, the terms and the data-safety inventory stay true to the code.
const ROOT = resolve(import.meta.dirname, '../../../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const doc = read('docs/DATA_SAFETY.md');

/** The field names of `interface <name>` in a source file. */
function fieldsOf(file: string, name: string): string[] {
  const src = read(file);
  const body = src.slice(src.indexOf(`interface ${name}`)).split('}')[0];
  return [...body.matchAll(/^\s*([a-zA-Z_]+)\??:/gm)].map((m) => m[1]);
}

/** Every key of every props object passed to track(...) anywhere in the game. */
function trackedPropKeys(): string[] {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) files.push(p); } };
  walk(join(ROOT, 'apps/web/src'));
  const keys = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\btrack\('[a-z_]+',\s*\{([^}]*)\}/g)) {
      for (const k of m[1].matchAll(/(?:^|,)\s*([a-zA-Z_]+)\s*(?=[:,]|$)/g)) keys.add(k[1]);
    }
  }
  return [...keys];
}

describe('docs/DATA_SAFETY.md names every telemetry field (AB#4726)', () => {
  it('every field of the telemetry envelope and of the shop log', () => {
    const fields = [...fieldsOf('apps/web/src/game/systems/Telemetry.ts', 'TelemetryEvent'), ...fieldsOf('apps/web/src/game/systems/Analytics.ts', 'AnalyticsEvent')];
    expect(fields.length).toBeGreaterThanOrEqual(15);
    for (const f of fields) expect(doc, f).toContain(`\`${f}\``);
  });

  it('every props key the game sends with an event', () => {
    const keys = trackedPropKeys();
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect(doc, k).toContain(`\`${k}\``);
  });
});

describe('the public pages (AB#4726)', () => {
  it('are anonymous routes, listed before the playtester wall', () => {
    const routes = JSON.parse(read('public/staticwebapp.config.json')).routes as { route: string; allowedRoles: string[] }[];
    const wall = routes.findIndex((r) => r.route === '/*');
    for (const page of ['/privacy.html', '/terms.html']) {
      const i = routes.findIndex((r) => r.route === page);
      expect(i, page).toBeGreaterThanOrEqual(0);
      expect(i, page).toBeLessThan(wall);
      expect(routes[i].allowedRoles).toContain('anonymous');
    }
  });

  it('the policy says what the brief asks: rv_did, app version, platform, AdMob, Google Play, under 16, deletion, contact, date', () => {
    const policy = read('public/privacy.html');
    for (const s of ['rv_did', 'app version', 'platform', 'Google AdMob', 'Google Play', 'under 16', 'Delete My Data', 'Contact', 'effective']) expect(policy, s).toContain(s);
    expect(read('public/terms.html')).toContain('effective');
  });
});

describe('Delete my data and the ads sentence (AB#4726)', () => {
  it("finds only this game's keys", () => {
    const store = new Map([['relic-vault-save', '1'], ['relic-vault-analytics', '1'], ['rv_did', 'x'], ['someone-else', '1']]);
    const fake = { get length() { return store.size; }, key: (i: number) => [...store.keys()][i] ?? null } as unknown as Storage;
    expect(ownKeys(fake).sort()).toEqual(['relic-vault-analytics', 'relic-vault-save', 'rv_did']);
    expect(OWN_KEY.test('rv_did')).toBe(true);
  });

  it('never says ads are simulated in a build that serves AdMob', () => {
    expect(adsSentence('demo')).toContain('simulated');
    expect(adsSentence('admob')).toContain('Google AdMob');
    expect(adsSentence('admob')).not.toContain('simulated');
  });
});
