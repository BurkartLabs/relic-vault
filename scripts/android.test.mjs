import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseAdsMode } from './android.mjs';

// Bug #4894: the Board built a release without VITE_ADS_MODE and the phone showed the Criers' Guild demo veil, never an
// AdMob ad. A release bundle is built for Play, so it is admob unless somebody says otherwise, and then it stops.
const HERE = dirname(fileURLToPath(import.meta.url));

describe('the release bundle shows real ads (Bug #4894)', () => {
  it('builds with AdMob when VITE_ADS_MODE is unset or admob', () => {
    expect(releaseAdsMode({})).toEqual({ mode: 'admob' });
    expect(releaseAdsMode({ VITE_ADS_MODE: '' })).toEqual({ mode: 'admob' });
    expect(releaseAdsMode({ VITE_ADS_MODE: 'admob' })).toEqual({ mode: 'admob' });
  });

  it('stops, naming the variable, when a release is asked for with the demo veil', () => {
    const r = releaseAdsMode({ VITE_ADS_MODE: 'demo' });
    expect(r.mode).toBeUndefined();
    expect(r.problem).toMatch(/VITE_ADS_MODE=demo: a release bundle serves real ads/);
  });

  it('and the Gradle release guard refuses a web app built without it, whatever built the release', () => {
    // android/app/build.gradle reads version.properties' adsMode (scripts/version.mjs) inside the release check
    const gradle = readFileSync(join(HERE, '../android/app/build.gradle'), 'utf8');
    const guard = gradle.slice(gradle.indexOf('gradle.taskGraph.whenReady'));
    expect(guard).toMatch(/versionProps\.getProperty\('adsMode'\) != 'admob'/);
    expect(guard).toMatch(/throw new GradleException\("A release build needs the web app built with VITE_ADS_MODE=admob/);
  });
});
