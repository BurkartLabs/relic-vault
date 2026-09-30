import { describe, it, expect } from 'vitest';
import { ADMOB } from './ads';

// AB#4712: the live AdMob ids. The app id and both ad units must come from one AdMob account, or the units serve nothing.
describe('AdMob ids', () => {
  const publisher = (id: string) => id.split(/[~/]/)[0];

  it('are the live ones, all from the same account, never Google’s test publisher', () => {
    expect(ADMOB.appId).toMatch(/^ca-app-pub-\d+~\d+$/);
    expect(ADMOB.rewardedId).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(ADMOB.interstitialId).toMatch(/^ca-app-pub-\d+\/\d+$/);
    expect(new Set([ADMOB.appId, ADMOB.rewardedId, ADMOB.interstitialId].map(publisher))).toEqual(new Set([publisher(ADMOB.appId)]));
    expect(publisher(ADMOB.appId)).not.toBe('ca-app-pub-3940256099942544');
  });

  it('ask for live ads unless a build sets VITE_ADMOB_TESTING=1', () => {
    expect(ADMOB.testing).toBe(false);
  });
});
