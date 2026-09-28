# Relic Vault on Android

The Android app is a [Capacitor 8](https://capacitorjs.com) shell (`android/`, `capacitor.config.ts`) around the
same web build the PWA serves (`dist/`). Capacitor is additive: `npm run build`, `npm test` and the e2e suite are the
web build's, unchanged. App id `com.orchestrata.relicvault`, name "Relic Vault" (AB#4723).

## Setup, once per machine

- **JDK 21**, with `JAVA_HOME` set. Not Android Studio's bundled JDK 25: Gradle 8.14 does not run on it.
- **Android SDK** (Android Studio, or the command-line tools) with `platforms;android-36`, `build-tools;36.0.0` and
  `platform-tools`; set `ANDROID_HOME` (or write `sdk.dir` in `android/local.properties`, which is not committed).
  Installing it means accepting Google's Android SDK licence.

## Commands

| Command | What it does |
|---|---|
| `npm run android:sync` | `npm run build`, then copies `dist/` into `android/` (`npx cap sync android`) |
| `npm run android:apk` | a debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run android:bundle` | the signed release App Bundle for Google Play: `android/app/build/outputs/bundle/release/app-release.aab` |
| `npm run android:icons` | the launcher icons and splash icon, from `public/icons` |

Each checks the JDK, the SDK and (for the bundle) the signing variables first, and stops naming what is missing.
To try a bundle on a phone: `bundletool build-apks --bundle=app-release.aab --output=rv.apks --connected-device`, then
`bundletool install-apks --apks=rv.apks`. The debug APK installs with `adb install`.

## Signing

The release is signed with the **upload key**, read from four environment variables and nothing else:
`RELIC_VAULT_KEYSTORE_PATH`, `RELIC_VAULT_KEYSTORE_PASSWORD`, `RELIC_VAULT_KEY_ALIAS`, `RELIC_VAULT_KEY_PASSWORD`.
No keystore, password or `local.properties` is ever committed (`android/.gitignore` refuses `*.jks`, `*.keystore`).
The Board creates the key once and keeps it outside the repository, for example:
`keytool -genkeypair -v -keystore <path outside the repo>/relic-vault-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
Google Play App Signing holds the app signing key; a lost upload key can be reset there.

The version is `package.json`'s: `npm run build` writes `android/version.properties` (versionName, and versionCode as major*10000 + minor*100 + patch), which the build reads. Cutting a release: docs/RELEASE.md.

## Purchases: the Play store (AB#4725)

A build sells through Google Play Billing only when it is built with `VITE_STORE_MODE=play` and RevenueCat's public
Android SDK key in `VITE_REVENUECAT_KEY` (`goog_...`, made to ship inside the app). Without them it is the demo store,
which charges nothing, as every web and e2e build is:
`VITE_STORE_MODE=play VITE_REVENUECAT_KEY=goog_... npm run android:bundle`.

- **Products** (created in Play Console and RevenueCat, Board release step 7): `rv_welcome`, `rv_gems_200`,
  `rv_gems_500`, `rv_gems_1200`, `rv_piggy`, `rv_comeback` (consumable one-time products), `rv_pass`, `rv_noads`
  (non-consumable), and the subscription `rv_vip` with base plan `monthly`. RevenueCat entitlements `noads`, `pass`
  and `vip` attach to `rv_noads`, `rv_pass` and `rv_vip`. The mapping is `apps/web/src/game/systems/PlayStore.ts`.
- **Testing without charges**: a sandbox SDK key, and the tester's Google account added as a licence tester in Play
  Console; Play then shows its test cards, including "slow test card" for the pending state.
- **What the game does**: prices are the store's, localised (never the catalog's USD); a pack is granted only after
  RevenueCat confirms the transaction, once per transaction id; No Ads, the Pass and VIP are read from RevenueCat on
  every start and resume, so a refund or a cancelled subscription removes them; Settings has Restore Purchases and
  Manage Subscription (Play's subscription centre).
- **Not yet done on a device**: this needs a phone or emulator and the key; `docs/DEVICE_QA.md`.

## Ads (AB#4724)

The game reaches ads through `AdService` (`apps/web/src/game/systems/ads/`). An Android build made with
`VITE_ADS_MODE=admob` serves Google AdMob through `@capacitor-community/admob`; every other build, the web build and
every e2e run included, shows the Criers' Guild demo veil and contacts no ad network.

- **Ids:** `apps/web/src/game/config/ads.ts` holds the rewarded and interstitial ad unit ids, and the manifest's app id
  comes from `RELIC_VAULT_ADMOB_APP_ID` (a Gradle property or the environment). Until the Board supplies real ones
  (AB#4718), both are Google's published test ids, which show test ads and earn nothing.
- **Consent:** the UMP form runs once the age gate is answered and before any ad is requested, and again from
  Settings > Privacy options when UMP requires it. `VITE_ADMOB_DEBUG_GEOGRAPHY=EEA` makes the form appear as it does in
  Europe, on test devices (an emulator is one).
- **Under 16:** tagged under the age of consent, and every request is for non-personalised ads.
- **Trying it:** `VITE_ADS_MODE=admob VITE_ADMOB_DEBUG_GEOGRAPHY=EEA npm run android:apk`, then `adb install`. The emulator
  image needs Google Play services (a `google_apis` image has them).

## How the shell behaves

- **SDK levels:** compile and target API 36, minimum API 26 (Android 8.0).
- **WebView:** the game needs Android System WebView 90 or newer. On an older one the game is never started; a plain
  native screen asks the player to update WebView from Google Play (`MainActivity.load()`).
- **Portrait only.** Android 16 ignores the lock on large screens (600 dp and wider); phones keep it.
- **Edge to edge** on every version (mandatory from API 35). Capacitor's SystemBars plugin gives the page the status
  bar's and the gesture bar's insets as `--safe-area-inset-*` on `<html>`. `measureSafe()` (`apps/web/src/safeArea.ts`)
  takes the larger of those and `env(safe-area-inset-*)`, so the HUD sits below the status bar and the Dock above the
  gesture bar. On a WebView older than 140, Capacitor pads the WebView inside the bars instead, and both read 0.
- **Splash:** Android 12's splash screen on every version, the vault's icon on `#07060B`.
- **Backup:** the WebView's storage (IndexedDB: the save and the purchases already used) is excluded from Android's
  backup and device transfer. Restored on a new phone, it would bring back consumed purchases.
- **Network:** https only (cleartext off); no mixed content; no WebView debugging in release. Hardware acceleration on.
