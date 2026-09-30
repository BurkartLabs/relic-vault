/**
 * AB#4724: the AdMob ids, the Board's live ones since AB#4712 (they ship in the client by design; none is a secret).
 * A build made with VITE_ADS_MODE=admob serves real ads that earn money. The manifest's app id comes from
 * RELIC_VAULT_ADMOB_APP_ID (android/app/build.gradle), and a release build stops without it, since Google's test app
 * id with these live ad units would serve nothing.
 *
 * VITE_ADMOB_TESTING=1 asks AdMob for test ads on these same units: for any build a person taps through (QA, a
 * session's device check), because tapping a live ad on your own app counts as invalid traffic against the account.
 * VITE_ADMOB_DEBUG_GEOGRAPHY=EEA makes the consent form (UMP) behave as it does in Europe, for trying it anywhere;
 * it works on test devices only (an emulator is one), and only while `testing` is true.
 */
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;

export const ADMOB = {
  /** The manifest's app id, set by android/app/build.gradle from RELIC_VAULT_ADMOB_APP_ID; listed so the ids are in one place. */
  appId: 'ca-app-pub-7851334875499084~7442310009',
  rewardedId: 'ca-app-pub-7851334875499084/1339936082',
  interstitialId: 'ca-app-pub-7851334875499084/6180190063',
  testing: env.VITE_ADMOB_TESTING === '1', // false unless a build asks: the release serves live ads
  debugGeography: env.VITE_ADMOB_DEBUG_GEOGRAPHY === 'EEA' ? 1 : undefined,
};
