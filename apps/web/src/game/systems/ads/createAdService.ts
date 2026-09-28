import { Capacitor } from '@capacitor/core';
import { ADS_MODE } from '../../buildMode';
import { DemoAdService, type AdService } from './AdService';
import { AdMobAdService, type AdMobConfig, type AdMobLike } from './AdMobAdService';

type PluginModule = { AdMob: unknown };
/** The ad unit ids and test settings: config/ads.ts. */
export type AdMobIds = Pick<AdMobConfig, 'rewardedId' | 'interstitialId' | 'testing' | 'debugGeography'>;
const loadPlugin = () => import('@capacitor-community/admob') as Promise<PluginModule>;

/**
 * AB#4724: the ad adapter for this build. AdMob in the Android app built with VITE_ADS_MODE=admob; the demo veil
 * everywhere else (the web build, every e2e run, and an Android build without it). The plugin is imported when it is
 * first called, so a build that never serves AdMob never loads it.
 */
export function createAdService(ids: AdMobIds, mode = ADS_MODE, native = Capacitor.isNativePlatform(), load: () => Promise<PluginModule> = loadPlugin): AdService {
  if (mode !== 'admob' || !native) return new DemoAdService();
  // Bug #4785: a Capacitor plugin answers every property with a method, \`then\` included, so a promise resolved with it
  // calls AdMob.then() (rejected by the native bridge). It travels in a wrapper, never as a promise's value.
  let plugin: Promise<{ it: AdMobLike }> | null = null;
  const get = () => (plugin ??= load().then((m) => ({ it: m.AdMob as AdMobLike })));
  const lazy = new Proxy({} as AdMobLike, {
    get: (_t, key: string) => (...args: unknown[]) => get().then((p) => (p.it as any)[key](...args)),
  });
  return new AdMobAdService(lazy, { ...ids });
}
