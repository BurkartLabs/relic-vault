/**
 * AB#4724: the AdMob ids. Google's published test ids until the Board supplies the real ones (AB#4718): a build with
 * these shows Google's test ads and earns nothing. To go live: replace the two ad unit ids and set `testing` to false
 * here, and give the Android build the app id as RELIC_VAULT_ADMOB_APP_ID (android/app/build.gradle).
 *
 * VITE_ADMOB_DEBUG_GEOGRAPHY=EEA makes the consent form (UMP) behave as it does in Europe, for trying it anywhere;
 * it works on test devices only (an emulator is one), and only while `testing` is true.
 */
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

export const ADMOB = {
  /** Test app id: the manifest's, from android/app/build.gradle. Listed here so the ids are read in one place. */
  appId: 'ca-app-pub-3940256099942544~3347511713',
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',
  interstitialId: 'ca-app-pub-3940256099942544/1033173712',
  testing: true,
  debugGeography: env.VITE_ADMOB_DEBUG_GEOGRAPHY === 'EEA' ? 1 : undefined,
};
