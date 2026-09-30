# Relic Vault release 2: native shell, ads, billing and release hardening (Builder work)

Feature AB#4712 (Proposed) · product relic-vault · migrated from Azure DevOps on 2026-09-30 (AB#4889)

## What it is

Where it sits: under the Relic Vault epic AB#268, opened with release 1 on 2026-09-27. The code-side of the same release.
What it is: what the survey of origin/main c7aa093 found missing for a store release: no native project (pure PWA), ads are a 1.5 s demo veil (AdVeil.ts), PurchaseService is demo-only and client-authoritative, prices are hard-coded dollar strings, no privacy policy page, no Android back-button handling, no 512 icon or 1024x500 feature graphic, no device QA, no versionCode scheme, no AAB in CI, loot-box region is a self-declared toggle, age is self-declared.
Why it matters: AdMob cannot render inside a Trusted Web Activity (GoogleChrome/android-browser-helper #535), so "show ads when it's supposed to" needs a native shell: Capacitor, with the community AdMob plugin and RevenueCat's official purchases-capacitor. Google Play requires target API 36 and Billing Library 8+ for anything submitted after 2026-08-31. Every story here stays Proposed until the release Decision under this Feature is answered.
Order: shell first (everything else runs inside it), then ads and billing in parallel, then privacy/back-button/assets, then device QA, CI and versioning, then the post-launch stories.

## Acceptance

The Feature is done when a stranger with the internal-testing link, a license-tester account and the checklist below
can confirm every numbered line on a phone, not in a desktop browser (CLAUDE.md, "Before you say something works").
The two post-launch headings (AB#4734 age signal, AB#4740 Play Games saves) and the Board-only CI grant (Bug AB#4761)
are **not** required for Done; they stay in the checklist so they are not forgotten.

1. **It installs and boots.** A signed `.aab` built from `main` (`npm run android:bundle`, or the CI stage once
   the Board's keystore and agent exist) installs from Google Play internal testing on an Android 16 phone and boots to
   the age gate in portrait, HUD below the status bar and Dock above the gesture bar; on an Android 10 device it shows
   the designed "update Android System WebView" screen instead of a blank view. Screenshots of both attached to the PR.
2. **Ads show when they are supposed to, and only then.** On a device with the test ad unit IDs: FREE SPIN and
   Double-It play a real rewarded ad and grant only after the SDK's reward callback (closing early grants nothing and
   says so); an interstitial appears after a chest and after an event claim, never inside the 45 s gap, never during a
   drag or a streak, and never gates play; a VIP or no-ads profile sees no interstitial; the UMP consent form appears
   once on first launch in an EEA locale and again from Settings, Privacy options. The web build and e2e still use the
   demo veil.
3. **The store is real and honest.** With a license-tester account: every Play product (`rv_welcome`, `rv_gems_200`,
   `rv_gems_500`, `rv_gems_1200`, `rv_piggy`, `rv_pass`, `rv_noads`, `rv_comeback`, subscription `rv_vip`)
   grants exactly what the catalog blurb advertises; `rv_noads` stops interstitials; restore on a second device returns
   the entitlements and no consumable; a refund from Play Console revokes the entitlement on next boot; every price a
   player sees is the store's localised price and the value ribbons recompute from it; no "DEMO STORE MODE" text is
   visible in a play-mode build.
4. **Keeper's Pass is seasonal** (Decision AB#4788): `passPremium` resets in `rollover()` at a season change,
   `rv_pass` is re-grantable once per season, and the Settings and shop copy say "this season".
5. **The legal pages are public.** `/privacy.html` and `/terms.html` load on the live Static Web App without
   signing in (the game root still requires the playtester role); Settings opens both; "Delete my data" leaves no
   relic-vault key in IndexedDB or localStorage; `docs/DATA_SAFETY.md` names every field `Telemetry.ts` and
   `Analytics.ts` send.
6. **Android behaves like an app.** Back closes the topmost open surface (shop, settings, offer sheet, odds sheet, ad
   veil) one at a time; from the bare vault one press shows the "press back again" toast and a second exits;
   backgrounding mid-drag and returning restores the exact board.
7. **The store listing can be filled from the repo.** `screenshots/store/` holds the 512 icon, the 1024x500 feature
   graphic, 8 phone and 4 tablet shots at Play's exact sizes, and `docs/STORE_LISTING.md` has every Main store
   listing field inside its character limit (a test asserts the limits).
8. **It was looked at on a phone, with numbers.** `docs/DEVICE_QA.md`'s checklist has been run once on a real
   mid-range phone with cold-start and steady-fps figures recorded, and `node scripts/android-qa.mjs` produces
   `screenshots/android/*.png` on an emulator from a clean checkout.
9. **Nothing flakes on the way.** `npm run typecheck && npm test && npx playwright test` pass on the web build, and
   the "telemetry reaches a real sink" e2e is green ten runs in a row (Bug AB#4789).
10. **CI can ship it, once the Board can.** The `android` stage on `main` publishes `relic-vault.aab` as an
    artifact when the keystore Secure file and the three secret variables exist, and fails with a message naming what
    is missing when they do not; the `validate` stage is unchanged. This line is checked only after Board steps
    AB#4762 (agent) and AB#4716 (keystore) are done.

## Checklist

Each heading replaces a Requirement or Bug, which Azure DevOps keeps (Closed, tagged folded, linked here); its lines are its Acceptance. A checked line was Resolved and has not been verified. 6 open, 12 resolved.

### CI: build and sign the Android App Bundle on main, publish it as an artifact, optional upload to the internal track (Requirement AB#4731, Proposed)

What: Where it sits: Release 2, story 8. Depends on the shell. The Board uploads the keystore as a Secure file and the passwords as secret variables (Board step 4); this pipeline reads them. / What: azure-pipelines.yml: a new stage android after validate, on main only: Java 21, Android SDK command-line tools (ubuntu-latest has them), npm ci, npm run build, cap sync, DownloadSecureFile@1 for the keystore, gradle bundleRelease with the signing env vars, PublishPipelineArtifact relic-vault.aab plus… (the rest: AB#4731)

- [ ] A main build publishes relic-vault.aab as an artifact; the Board can download it and upload to Play (recorded on Board step 4).
- [ ] Missing keystore or variables fail the stage with a message naming what is missing; no secret is echoed.
- [ ] The validate stage is unchanged and still gates PRs.

### Age assurance beyond self-declaration: consume the Play age signal when available, fall back to the gate (Requirement AB#4734, Proposed)

What: Where it sits: Release 2, story 11. Post-first-release unless the Decision says otherwise. Check the current status of Google's Play Age Signals API before starting; it was announced in 2025 for US state age-assurance laws and its availability by region changes. / What: If the Play age signal reports the account holder is under 16 (or the signal's nearest bracket), set profile age to minor and hide the age gate; if it reports adult, still show the gate the first time (the signal describes the… (the rest: AB#4734)

- [ ] Unit test for the precedence (signal minor beats gate; gate governs otherwise).
- [ ] Behaviour documented in docs/DATA_SAFETY.md and privacy.html.
- [ ] Works with the signal absent (web build unchanged).

### Post-launch: cross-device saves with Play Games Services Saved Games (sign-in optional) (Requirement AB#4740, Proposed)

What: Where it sits: Release 2, story 15. Post-launch. Not a release blocker; filed so it is not forgotten. Needs a Play Games Services project the Board creates in Play Console (a short Board ticket when this opens). / What: Optional Google Play Games sign-in from Settings; on sign-in, the save (and the consumed-transaction ids) sync to Saved Games; conflicts resolve to the save with more total actions and tell the player. Never required to play; never touches entitlements (RevenueCat restores those).… (the rest: AB#4740)

- [ ] Sign in on device A, play, sign in on device B: same board.
- [ ] Conflict path tested with a unit test on the resolver.
- [ ] Play without signing in is unchanged.

### relic-vault CI is disabled: every run since 2026-09-19 failed with "No hosted parallelism has been purchased or granted"; nothing has deployed since (Bug AB#4761, Proposed)

What: Where it sits: blocks Feature AB#4711 and AB#4712 (Relic Vault release). Found by OPS on 2026-09-27 while merging AB#4726 (PR 1145): the privacy and terms pages are on main but the live Static Web App still 302s to sign-in, because no deploy has run. / Symptom: pipeline relic-vault-ci has queueStatus disabled; all 8 recorded runs (2026-09-19 21:39 to 2026-09-20 02:53 UTC, run ids up to 9) failed in stage validate, job test, before any step ran. / Repro: az pipelines list shows queueStatus disabled;… (the rest: AB#4761)
Symptom: relic-vault-ci is disabled and every run failed before its first step with "No hosted parallelism has been purchased or granted".
Repro: az pipelines list -o table shows relic-vault-ci queueStatus disabled; az devops invoke --area build --resource timeline --route-parameters project=Orchestrata buildId=9 shows the issue text.
Proposed fix: Board: request the free parallelism grant (aka.ms/azpipelines-parallelism-request) or register a self-hosted agent on the Board PC; re-enable relic-vault-ci; re-run main; confirm /privacy.html loads anonymously on the live site.

- [ ] Fixed: relic-vault CI is disabled: every run since 2026-09-19 failed with "No hosted parallelism has been purchased or granted"; nothing has deployed since

### Relic Vault: Settings calls the Keeper's Pass '(this season)' but the premium pass never ends at a season change (Bug AB#4786, Proposed)

What: Symptom. Settings > Manage Purchases lists 'Keeper's Pass (this season)' (Settings.ts), and the shop blurb sells a premium track. But State.rollover() only resets pass XP and claims at a new season (s.pass = { season, xp: 0, free: [], prem: [] }); s.ent.passPremium stays true forever. Either the copy promises less than the game gives, or the game gives a season pass for life. With AB#4725 the Play product rv_pass is a non-consumable (lifetime) entitlement, which matches the game, not the copy.… (the rest: AB#4786)
Symptom: Settings > Manage Purchases lists 'Keeper's Pass (this season)' (Settings.ts), and the shop blurb sells a premium track. But State.rollover() only resets pass XP and claims at a new season (s.pass = { season, xp: 0, free: [], prem: [] }); s.ent.passPremium stays true forever. Either the copy promises less than the game gives, or the game gives a season pass for life. With AB#4725 the Play product rv_pass is a non-consumable (lifetime) entitlement, which matches the game, not the copy.
Repro: Buy the Keeper's Pass (demo), move the clock past seasonEndsAt(now) and reload: passPremium is still true and the premium track is still open, while Settings says 'this season'.
Proposed fix: Confidence: medium. A product decision first (Director/Board): per-season pass or lifetime premium track. If lifetime: change the Settings copy to 'Keeper's Pass' and the blurb accordingly. If per-season: reset passPremium in rollover at a season change and make rv_pass a consumable per season in Play (granted once per transaction, as grantOnce does), with the price copy saying 'this season'. Confidence medium on the mechanics, the choice is not ours.

- [x] Fixed: Relic Vault: Settings calls the Keeper's Pass '(this season)' but the premium pass never ends at a season change

### Relic Vault e2e 'telemetry reaches a real sink' flakes: __vault.pair is null after the first forge (Bug AB#4789, Proposed)

What: Symptom. e2e/smoke.spec.ts:197 'telemetry reaches a real sink: app_open and verb_first arrive at the collector' failed once in a full `npx playwright test` with 'TypeError: Cannot read properties of null (reading 0)' at line 203: after tapForge, window.__vault.pair was null, so there was no pair to drag and the test died before checking the collector. Rerun alone it passed 4 of 4. / Repro. npx playwright test (the whole suite) on relic-vault main plus branch feat/4739-native-telemetry (whose… (the rest: AB#4789)
Symptom: e2e/smoke.spec.ts:197 'telemetry reaches a real sink: app_open and verb_first arrive at the collector' failed once in a full `npx playwright test` with 'TypeError: Cannot read properties of null (reading 0)' at line 203: after tapForge, window.__vault.pair was null, so there was no pair to drag and the test died before checking the collector. Rerun alone it passed 4 of 4.
Repro: npx playwright test (the whole suite) on relic-vault main plus branch feat/4739-native-telemetry (whose changes touch telemetry, not forging); intermittent, about 1 in 5 in a full run.
Proposed fix: Confidence: medium. Wait for __vault.pair to be non-null (page.waitForFunction, a few seconds), or seed the board with two same-tier relics before dragging, as the other smoke tests that merge do; the check that matters (events at the collector) is unchanged. Test: --repeat-each 20 with no failure.

- [x] Fixed: Relic Vault e2e 'telemetry reaches a real sink' flakes: __vault.pair is null after the first forge

### Relic Vault keeps playing its audio with the screen off or the app minimised, and the phone runs hot (the Board, 2026-09-30)

What: the Board, on the Android build: "the audio stays playing even when the screen is off. Also when the app is minimized. Also, my phone is getting real hot playing it." Root cause: nothing suspended the Web Audio context (the drone never stops) or the game loop on the Android lifecycle, and the loop drew 60 frames a second whether or not anyone was touching the game. Fix: systems/Power.ts sleeps the loop and suspends the audio when the app is backgrounded or the page hidden, and draws at 30 fps after 2.5 s without a touch (60 while touching).

- [x] Fixed: with the screen off or the app minimised the game loop sleeps and the audio is suspended; both come back with the app (unit tests; the hidden page in a browser; scripts/android-qa.mjs now checks both on a device).
- [x] Idle work roughly halved: 74 to 44 ms of main-thread work a second on the idle vault (desktop Edge at phone size), 60 fps kept while touching.
- [ ] Checked on the Board's phone: no sound with the screen off or minimised, and cooler in play.
### Capacitor Android shell: android/ project, target API 36, edge-to-edge, orientation, splash, signed AAB script (Requirement AB#4723, Resolved, not verified)

What: Where it sits: Release 2, story 1: everything else runs inside this. Opens once the Decision picks Capacitor (recommended) over a TWA. / What: Add Capacitor (@capacitor/core, @capacitor/cli, @capacitor/android) with appId from the Decision (chosen: com.madgod_games.relic_vault), appName "Relic Vault", webDir dist. Android project: compileSdk/targetSdk 36, minSdk 26 (WebView 90+ check on boot with a plain "update Android System WebView" screen), portrait-only activity, edge-to-edge (mandatory on… (the rest: AB#4723)

- [x] npm run android:bundle produces a signed .aab when the keystore env vars are set, and fails with a clear message when they are not.
- [x] The .aab installs on an Android 10 and an Android 16 device or emulator; the game boots to the age gate in portrait, the HUD sits below the status bar and the Dock above the gesture bar (screenshots of both attached, P-001).
- [x] npm test, npm run typecheck and npx playwright test pass unchanged on the web build.
- [x] docs/ANDROID.md explains setup in under a page; no secret value appears anywhere in the repo.

### AdService abstraction and AdMob adapter: rewarded and interstitial, UMP consent, under-16 handling, demo fallback (Requirement AB#4724, Resolved, not verified)

What: Where it sits: Release 2, story 2. Depends on the shell. Board step 6 supplies the AdMob App ID and unit IDs (public, committed to a config file). / What: Extract an AdService interface from VaultScene.watchAd() and maybeInterstitial() (VaultScene.ts:1299-1323) with two adapters: DemoAdService (the existing AdVeil, used on the web build and in e2e) and AdMobAdService (@capacitor-community/admob, or Capawesome's plugin on the Next-Gen SDK if it is stable by then). Rules the adapter must keep: a… (the rest: AB#4724)

- [x] Unit tests for the cadence rules run against a fake AdService and pass for both adapters' contract.
- [x] On a device with test ads: the wheel's FREE SPIN shows a real rewarded test ad and grants only after the reward callback; closing early grants nothing and says so; the interstitial appears after a chest, respects the 45 s gap and never during a streak (screen recording or three screenshots attached).
- [x] A VIP or no-ads profile sees no interstitial and the wheel says "no ad for VIP" as today.
- [x] The UMP form appears once on first launch in an EEA-locale emulator; Settings has a working "Privacy options" entry.
- [x] The web build and e2e still use the demo veil unchanged.

### PurchaseService Play adapter via RevenueCat: product mapping, store prices, entitlements, consumables, restore, refunds (Requirement AB#4725, Resolved, not verified)

What: Where it sits: Release 2, story 3. Depends on the shell. Board step 7 supplies the product IDs and the public RevenueCat SDK key. Opens once the Decision picks RevenueCat (recommended) over own receipt validation. / What: Implement StoreMode "play" in PurchaseService (PurchaseService.ts:63-81) with @revenuecat/purchases-capacitor. Mapping table catalog SkuId → Play product ID (rv_welcome, rv_gems_200, rv_gems_500, rv_gems_1200, rv_piggy, rv_pass, rv_noads, rv_comeback, subscription… (the rest: AB#4725)

- [x] sim.test.ts's every-SKU grant test passes unchanged; a new test asserts a consumable transaction id granted twice grants once.
- [x] On the internal build with a license-tester account: buy rv_gems_500 and see 500 gems; buy rv_noads and see interstitials stop; buy rv_vip and see the VIP entitlement; restore on a second device returns the entitlements and no gems; a refund from Play Console removes noads on next boot (Board records the results on Board step 7).
- [x] Every visible price string on the shop and offers is the store's localised price; screenshot of the shop in a non-USD locale attached.
- [x] No demo-store text is visible in a play-mode build.

### Privacy policy, terms and data-safety inventory: public pages outside the invite wall, Settings links, delete-my-data (Requirement AB#4726, Resolved, not verified)

What: Where it sits: Release 2, story 4. Independent of the shell. Board step 3 copies from docs/DATA_SAFETY.md. / What: Write public/privacy.html and public/terms.html in the game's voice but plain: what is stored on the device, what the telemetry sends (rv_did, events, app version, platform), that AdMob and Google Play process their own data under their policies, the under-16 rule, how to delete data (the in-game button), contact email, effective date. Add both routes to staticwebapp.config.json as… (the rest: AB#4726)

- [x] https:///privacy.html and /terms.html load without signing in.
- [x] Settings opens both; screenshots attached.
- [x] docs/DATA_SAFETY.md exists and names every telemetry field in Telemetry.ts and Analytics.ts.
- [x] "Delete my data" leaves no relic-vault key in IndexedDB or localStorage (e2e asserts).

### Android back button and lifecycle: close the top sheet, double-tap to exit, save and pause on background (Requirement AB#4728, Resolved, not verified)

What: Where it sits: Release 2, story 5. Depends on the shell. / What: Capacitor App plugin backButton listener: if a sheet, modal, shop, settings or ad veil is open, close the topmost (same path as its own close control); if the vault is bare, show a 2-second toast "Press back again to leave the vault" and exit on a second press. appStateChange: on background, persist the save and send session_pause (Telemetry already maps hidden tab → pause, Bug #326); on resume, re-check RevenueCat entitlements and… (the rest: AB#4728)

- [x] On device: back closes each of shop, settings, offer sheet, odds sheet, ad veil in turn; from the bare vault a single back shows the toast and a second exits; screen recording or screenshots attached.
- [x] Backgrounding mid-drag and returning restores the exact board (the existing reload e2e logic reused).
- [x] Unit test for the back-stack resolver (which surface is topmost).

### Store listing asset pipeline: 512 icon, 1024x500 feature graphic, captioned phone and tablet screenshots, store copy, 30-second trailer cut (Requirement AB#4729, Resolved, not verified)

What: Where it sits: Release 2, story 6. Independent. Board step 2 uploads the output. / What: Extend apps/web/tools/make-icons.mjs to also bake a 512x512 32-bit PNG (no alpha rounding, Play adds the mask) and a 1024x500 feature graphic (the relic painter's hero relic on the vault backdrop with the wordmark; no small text). Extend play.mjs to export a screenshots/store/ set: 8 phone shots at 1080x1920 of the moments that sell the game (first forge, a T6 merge with VFX, the shop, the album, an event… (the rest: AB#4729)

- [x] screenshots/store/ holds the icon, feature graphic, 8 phone shots and 4 tablet shots at the exact sizes Play lists; a contact sheet of all of them is attached to the PR.
- [x] docs/STORE_LISTING.md has every field Play's Main store listing asks for, within its character limits (a test asserts the limits).
- [x] video/trailer.mp4 is 25 to 32 seconds, 1080x1920, and plays in a browser.

### Device QA: emulator build-and-install script, adb screenshot pass, and a release checklist a session can run (Requirement AB#4730, Resolved, not verified)

What: Where it sits: Release 2, story 7. Depends on the shell, ads and billing stories; runs before every store release. / What: scripts/android-qa.mjs: builds the debug APK, boots a named emulator (Pixel 8, API 36) or uses an attached device, installs, launches, and captures adb screencaps at fixed moments driven through Chrome DevTools remote debugging of the WebView (the existing play.mjs actions), into screenshots/android/. docs/DEVICE_QA.md: the checklist a session or the Board runs on a real… (the rest: AB#4730)

- [x] node scripts/android-qa.mjs produces screenshots/android/*.png on an emulator from a clean checkout with the Android SDK installed (documented prerequisites).
- [x] docs/DEVICE_QA.md checklist run once on a real phone with results recorded in the PR.
- [x] Cold-start time and fps numbers on a named mid-range device recorded in docs/DEVICE_QA.md with the measuring method.

### Loot-box region from the store: default chestsAllowed from the Play storefront country, keep the manual toggle (Requirement AB#4733, Resolved, not verified)

What: Where it sits: Release 2, story 10. Depends on the billing story (RevenueCat exposes the storefront country). Board steps 5 and 8 also exclude Belgium at the Play level. / What: On boot in play mode read the storefront country code; if it is in a maintained list data/lootbox-restricted-countries (BE today; the Decision names the list and who updates it), set lootboxesAllowed=false before the first shop render and disable the manual toggle with the reason shown. Elsewhere the manual toggle keeps… (the rest: AB#4733)

- [x] Unit test: BE storefront → chestsAllowed false regardless of toggle; CA storefront → toggle governs.
- [x] The shop shows the existing "not offered in your region" reason (ShopModal.ts:143) in the BE case.
- [x] docs/DATA_SAFETY.md notes that the storefront country is read but not stored.

### Cold start and low-end WebView performance: measure, budget, and lazy-paint the relic art (Requirement AB#4737, Resolved, not verified)

What: Where it sits: Release 2, story 12. After the shell exists; the device QA story supplies the measuring method. / What: Measure time-to-age-gate and time-to-first-forge on a mid-range Android device and the Pixel 8 emulator with a throttled CPU. RelicFactory paints every relic at boot; move floor-3+ chains and the shop art to lazy paint on first need, cache painted textures across the session, and confirm texture memory stays under 256 MB on a 2 GB device. Budget: under 3 s to interactive warm, 5… (the rest: AB#4737)

- [x] Before/after numbers on the named device in docs/DEVICE_QA.md.
- [x] No visual change on the web build (playtest screenshots diffed).
- [x] Unit tests still pass; e2e boot-console-errors check still passes.

### Repository hygiene before the release pipeline: dead ad/salvage code, dist folders, Android artefacts ignored (Requirement AB#4738, Resolved, not verified)

What: Where it sits: Release 2, story 13. Independent; small. / What: Delete Economy.adSalvage() and the Sku.random field if nothing but tests reference them (survey §10), or wire them; remove dist/ and apps/web/dist-qa/ from the working tree and add them, android/app/build, android/.gradle, *.jks, *.keystore, version.properties and any service-account *.json pattern to .gitignore; add a test that fails if a file matching *.jks or a Google service-account JSON shape is tracked. / Why: The survey found… (the rest: AB#4738)

- [x] git ls-files shows no dist/ or dist-qa/ entries.
- [x] The secret-shape test exists and passes.
- [x] npm test and e2e unchanged.

### Native telemetry: platform value, crash and JS-error forwarding, and the endpoint the store build reports to (Requirement AB#4739, Resolved, not verified)

What: Where it sits: Release 2, story 14. Depends on the shell and on the telemetry-host Decision (TODO #1, "blocks leaving Preview"). / What: GameCtx platform string gains capacitor-android (and the WebView major version) so store sessions are separable in the funnel; window.onerror / unhandledrejection already emit error events: add the Capacitor plugin error path and the ad/billing failure codes. Build the store bundle with VITE_TELEMETRY_URL set from the Decision; document in docs/ANALYTICS.md that… (the rest: AB#4739)

- [x] A store build's app_open carries platform capacitor-android and the WebView version.
- [x] A forced JS error on device appears at the endpoint within a minute.
- [x] docs/ANALYTICS.md updated.

## Demo script

_To be written._
