/// <reference types="node" /> // this test reads files; the app itself stays browser-typed (tsconfig types)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * AB#4729: docs/STORE_LISTING.md holds every field of Google Play's Main store listing; this holds each to Play's
 * limit, and every graphic in screenshots/store/ to Play's exact size and format, read from the PNG header. The
 * trailer's shot list (video/trailer.json) must name real footage and add up to 25 to 32 seconds.
 */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const DOC = readFileSync(join(ROOT, 'docs/STORE_LISTING.md'), 'utf8').replace(/\r\n/g, '\n');
const STORE = join(ROOT, 'screenshots/store');

/** The first ```text block under a `## heading`, trimmed. */
function field(heading: string): string {
  const at = DOC.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`STORE_LISTING.md has no "## ${heading}"`);
  const next = DOC.indexOf('\n## ', at + 4);
  const section = DOC.slice(at, next < 0 ? undefined : next);
  const m = section.match(/```text\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`"## ${heading}" has no text block`);
  return m[1].trim();
}
/** Characters as Play counts them: code points, not UTF-16 units. */
const chars = (s: string) => [...s].length;

/** A PNG's width, height and colour type (2: RGB, 24-bit; 6: RGBA, 32-bit), from its header. */
function png(file: string) {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('ascii'), file).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bitDepth: b[24], colourType: b[25], bytes: b.length };
}

describe('the Play store listing text (AB#4729)', () => {
  it('app name, short and full description, within Play\'s limits', () => {
    const name = field('App name');
    const short = field('Short description');
    const full = field('Full description');
    expect(chars(name)).toBeGreaterThan(0);
    expect(chars(name)).toBeLessThanOrEqual(30);
    expect(chars(short)).toBeGreaterThan(0);
    expect(chars(short)).toBeLessThanOrEqual(80);
    expect(chars(full)).toBeGreaterThan(500);
    expect(chars(full)).toBeLessThanOrEqual(4000);
  });

  it('says what the brief asks it to say, plainly', () => {
    const full = field('Full description');
    expect(full).toMatch(/no energy/i);
    expect(full).toMatch(/always another merge/i);
    expect(full).toMatch(/odds/i);
    expect(full).toMatch(/removes the interstitials/i); // the no-ads purchase
    expect(full).toMatch(/in-app purchases/i);
  });

  it('ten ranked tags, one per line, and a what\'s-new template within 500 characters', () => {
    const tags = field('Tags').split('\n').map((t) => t.trim()).filter(Boolean);
    expect(tags).toHaveLength(10);
    expect(new Set(tags).size).toBe(10);
    const whatsNew = field("What's new (template)");
    expect(chars(whatsNew)).toBeLessThanOrEqual(500);
  });
});

describe('the Play store graphics, at Play\'s exact sizes (AB#4729)', () => {
  const files = existsSync(STORE) ? readdirSync(STORE).filter((f) => f.endsWith('.png')) : [];
  const set = (prefix: string) => files.filter((f) => f.startsWith(prefix)).sort();

  it('the icon: 512x512, 32-bit PNG, under 1 MB', () => {
    const i = png(join(STORE, 'icon-512.png'));
    expect([i.width, i.height, i.bitDepth, i.colourType]).toEqual([512, 512, 8, 6]);
    expect(i.bytes).toBeLessThan(1024 * 1024);
  });

  it('the feature graphic: 1024x500, 24-bit PNG with no alpha', () => {
    const f = png(join(STORE, 'feature-graphic-1024x500.png'));
    expect([f.width, f.height, f.bitDepth, f.colourType]).toEqual([1024, 500, 8, 2]);
  });

  it('8 phone shots at 1080x1920, and 4 at each tablet size, all 24-bit PNG under 8 MB', () => {
    const sets: [string, number, number, number][] = [['phone-', 8, 1080, 1920], ['tablet7-', 4, 1200, 1920], ['tablet10-', 4, 1600, 2560]];
    for (const [prefix, count, w, h] of sets) {
      const shots = set(prefix);
      expect(shots, prefix).toHaveLength(count);
      for (const s of shots) {
        const p = png(join(STORE, s));
        expect([p.width, p.height, p.bitDepth, p.colourType], s).toEqual([w, h, 8, 2]);
        expect(p.bytes, s).toBeLessThan(8 * 1024 * 1024);
      }
    }
  });
});

describe('the trailer shot list (AB#4729)', () => {
  const { shots } = JSON.parse(readFileSync(join(ROOT, 'video/trailer.json'), 'utf8'));
  const segments = JSON.parse(readFileSync(join(ROOT, 'video/segments.json'), 'utf8'));

  it('adds up to 25 to 32 seconds', () => {
    const total = shots.reduce((a: number, s: any) => a + (s.card ? s.seconds : s.to - s.from), 0);
    expect(total).toBeGreaterThanOrEqual(25);
    expect(total).toBeLessThanOrEqual(32);
  });

  it('names real footage: each segment and clip is in video/segments.json, and every shot has a caption for the .vtt', () => {
    for (const s of shots) {
      expect(typeof s.caption, JSON.stringify(s)).toBe('string');
      if (s.card) continue;
      const seg = segments.find((x: any) => x.id === s.segment);
      expect(seg?.clips?.[s.clip ?? 0], `${s.segment} clip ${s.clip ?? 0}`).toBeTruthy();
      expect(s.to).toBeGreaterThan(s.from);
    }
  });
});
