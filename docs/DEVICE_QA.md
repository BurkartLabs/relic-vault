# Device QA: start time, frame rate and memory

Relic Vault's performance budget and what it measures today. Release 2 (AB#4737).

## The budget

| What | Budget |
|---|---|
| To interactive, warm (a returning player, cached) | under 3 s |
| To interactive, cold (a first visit, nothing cached) | under 5 s |
| Frame rate, 36 relics on the board and 200 particles live | 60 fps, steady |
| Texture memory | under 256 MB |

## Where it is measured

| Target | Status |
|---|---|
| Real low-end Android device (Pixel-class) | **TODO**: not yet run. The release checklist below says how. |
| Android emulator, Pixel 8, API 36 (`npm run android:qa`) | The app itself in its WebView. The timings are the build machine's, not a phone's; see "Device QA on Android". |
| Desktop Chrome, CPU throttled 4x | The numbers below. A stand-in for a slow phone, not a measurement of one. |

**Method.** A production build (`npm run build`, served by `npx vite preview`) in headless Chromium through Playwright,
viewport 412x915, the CPU throttled 4x through the DevTools protocol (`Emulation.setCPUThrottlingRate`). WebGL runs on
the machine's GPU (flags `--use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu`): without them headless Chromium
renders WebGL in software on the throttled CPU, which a phone does not do, and every number comes out two to four
times worse than the game is (the first attempt measured 2.7 fps that way). Machine: Windows 10, GTX 1070 Ti.

- **Cold**: a fresh browser profile; the age gate shows and is answered as soon as it appears.
- **Warm**: a reload in the same profile: cached, the age gate already answered.
- **Vault ready**: navigation start to the vault's HUD existing (`window.__vault.hud`), stamped in the page.
- **First forge**: to the first relic landing on the board after tapping the forge.
- **Steady frame rate**: 36 relics (the board filled) and 200 live particles, 5 s of `requestAnimationFrame`.
- **Texture memory**: every texture's pixels at 4 bytes (the GPU copy). Each canvas texture also keeps a CPU canvas of
  the same size in the WebView's heap.
- Medians. Run to run varies by about a second, so read small differences as noise.

Rerun it: `node apps/web/tools/perf.mjs http://127.0.0.1:4176/ screenshots/perf/<tag> [runs]` against a preview build.
The boot's own steps are `performance.measure` entries named `rv:*` (main.ts and the boot scenes), and the script
reports them.

## Results, desktop Chrome, CPU throttled 4x

| | Before (main, 6 runs) | After (AB#4737, 5 runs) | Budget |
|---|---|---|---|
| Cold: age gate shown | 1.7 to 4.2 s | 2.9 s | |
| Cold: vault ready | 8.4 to 8.6 s | 6.8 s | 5 s: **not met** |
| Cold: first forge | 8.8 to 9.0 s | 7.1 s | |
| Warm: vault ready | 7.1 to 7.8 s | 6.3 s | 3 s: **not met** |
| Warm: first forge | 7.5 to 8.2 s | 7.0 s | |
| Frame rate, 36 relics + ~190 live particles | 58.6 fps, p95 frame 16.8 ms | 60.2 fps, p95 frame 16.8 ms | met |
| Texture memory (GPU) | 95 MB, 146 textures | 81 MB, 112 textures | met |

The boot's steps, medians (before from the runs with the marks in, on main's code):

| Step (`rv:*`) | Before | After |
|---|---|---|
| fonts | 0.40 s | 0.44 s |
| splash | 0.44 s | 0.43 s |
| bake: Waking the relics | 1.47 s | 0.96 s |
| bake: Carving the vault | 0.80 s | 0.80 s |
| bake: Gilding the frames (UI, shop) | 0.79 s | 0.00 s |
| bake: Shuffling the album | 0.33 s | 0.00 s |
| vault create | 1.43 s | 1.71 s |

**What changed.** The relics of floors 3 to 9 (70 of 120) are not painted at boot: their atlas frames exist, blank,
and the first lookup of any of them paints its chain and refreshes the atlas (RelicFactory `paintOnLookup`); a floor
change paints its floor before re-laying the board. The UI's art (the shop's ribbons and seals, the wheel, the piggy
bank, the particles) and the album's cards are painted on their first lookup (art/lazy.ts). Everything painted is kept
for the session. What the first screen needs is still painted before it shows, so part of the old UI bake now lands
in vault create (1.43 s to 1.71 s).

**Texture memory.** 81 MB on the GPU, with the same again as the canvases behind it: about 160 MB together, under
256 MB. The two relic atlases stay at full size (26 MB and 16 MB) so no screen's frame name changed; a relic not yet
painted is transparent in them.

**The start budget is not met.** From here, in order of what is left (warm): vault create (1.7 s), the vault's
background (0.8 s), the first three floors' relics (1.0 s), the splash and fonts (0.9 s), about 0.75 s before the
game's code starts (`rv:start`: loading and parsing the script under throttling), and about 0.9 s of scene hand-offs,
including the 360 ms fade into the vault. Next steps worth measuring: keep the painted art
across sessions (IndexedDB), which would take a warm start's bakes to near zero; split vault create; paint the vault's
background in layers over the first frames.

**No visual change.** The playtest (`apps/web/tools/play.mjs … full`) run on main and on this change, compared shot by
shot: every difference was within main's own difference from itself on a second run (ambient particles, merge timing),
and the lazily painted screens (shop, wheel, album) were looked at. The unit tests and the e2e suite, with its
boot-console-errors check, pass.

## The Play store on a device (AB#4725): TODO

Not yet run: it needs an Android device or emulator with Google Play, RevenueCat's sandbox SDK key and a Play licence
tester (docs/ANDROID.md, "Purchases"). What was checked without them: the adapter against a fake RevenueCat store in
unit tests, and a play-mode web build fed euro prices, looked at in a German-locale browser
(`screenshots/store/ab4725/`). That is a stand-in for the store, not the store. On a device, in a non-USD Play country:

1. The shop, the offers, the Welcome pack, the Pass and VIP show Play's own localised prices; no "$", no "demo".
2. Buy a gem pack with a test card: the gems arrive once. Kill the app during the purchase and reopen: still once.
3. Buy with "slow test card": the shop says the payment is pending; when Play completes it, the pack arrives, once.
4. Buy No Ads, then refund it in Play Console: on the next start or resume, interstitials are back.
5. Subscribe to VIP, cancel in Settings > Manage Subscription (Play's page opens): VIP ends when Play says it lapses.
6. Reinstall, Restore Purchases: No Ads, the Pass and VIP come back; no gem pack is paid out again.

## Device QA on Android (AB#4730)

`npm run android:qa` (scripts/android-qa.mjs) builds the debug APK, boots an emulator or uses an attached phone,
installs the app from clean, launches it and drives it through its WebView over Chrome DevTools (the play.mjs actions:
game coordinates to CSS pixels, a real pointer). It saves the device's own screenshots (`adb screencap`, status and
navigation bars included) to `screenshots/android/`, with `summary.json` beside them (device, WebView version,
timings, one line per check, console errors). It exits non-zero if a check failed.

    npm run android:qa                                   build, boot the rvqa_pixel8_36 emulator (created if missing), run
    npm run android:qa -- --device <serial>              a phone over USB (adb devices), or an emulator already running
    npm run android:qa -- --no-build --keep --window     reuse the last APK, leave the emulator up, show its window

Needs JDK 21 as `JAVA_HOME` (not Android Studio's JDK 25, docs/ANDROID.md) and the SDK's `system-images;android-36;
google_apis;x86_64`. `ANDROID_AVD_HOME` chooses where the emulator is created. The emulator runs with `-gpu host` and
3 GB: with the image's defaults (software GPU, 2 GB) it crashed loading the game, twice. Only a debug build can be
driven: capacitor.config.ts leaves `webContentsDebuggingEnabled` unset, which Capacitor turns on for debug and off
for release.

The shots, in order: launch, age gate, vault, three forges, a merge (tier 3 onto tier 3), the shop, after Back with
the shop open, settings, a full board (36 relics) with the frame rate counted, a rotation, Home and back, a cold start.

**What it cannot see.** Real ads and purchases (test ids only), touch feel, heat and battery, and a phone's speed: the
emulator borrows the build machine's CPU and GPU, and here it shared them with two other emulators. It is the app on
Android, not a measurement of a phone. Its first run (2026-09-28, emulator, API 36, WebView 133):

| | Emulator |
|---|---|
| `am start` cold (process start to first frame) | 2.2 to 2.5 s |
| Cold, navigation start to vault ready (the page's own clock) | 9.8 to 10.1 s |
| Cold, first launch after install, to the age gate (page clock) | 8.8 s |
| `am start` warm (process alive) | 0.8 to 0.9 s |
| Frame rate, full board | 50 to 54 fps |
| Rotation | portrait-locked (the manifest), page kept |
| Background and resume | page and board kept |
| Back with the shop open | **leaves the app**: AB#4728 is in flight |

The cold start agrees with the desktop measurement above: the start budget is not met.

## Release checklist, on a real phone (AB#4730)

A session or the Board runs this before a release goes to production, on a mid-range 2022 phone (Pixel 6a,
Galaxy A53 class) with the build the release will ship: the signed bundle through the internal testing track, not
a debug APK. Run `npm run android:qa -- --device <serial>` first against a debug build on the same phone. It covers
the start timings, frame rate, gate, forge, merge, shop, back, rotation and resume, and saves the shots. Then work
through the list by hand. Write down the phone, Android version, WebView version and build (Settings > Version), and
a pass/fail for every row. A fail blocks the release unless the Board waives it in writing.

| # | Check | How | Passes when |
|---|---|---|---|
| 1 | Start time, cold | Force-stop (Settings > Apps > Relic Vault > Force stop), wait 10 s, open it with a stopwatch; or `adb shell am start -W` plus summary.json's `coldPageMsToInteractive`. Three tries, take the median. | The vault is playable (forge responds) in under 5 s. |
| 2 | Start time, warm | Open it, press Home, open it again from the launcher. Three tries. | Playable in under 3 s; the board is as it was left. |
| 3 | Frame rate | Fill the board (36 relics) and merge a high tier for the particles. Turn on Developer options > Profile HWUI rendering > On screen as bars. Watch for 30 s, then read summary.json `fullBoardFps` from the scripted run. | Bars stay under the green 16 ms line apart from single spikes; no visible stutter while dragging; 58 fps or more. |
| 4 | Age gate | Clear storage (Settings > Apps > Relic Vault > Storage > Clear storage), open. Answer "Under 16" once and open the shop; clear again and answer "16 or older". | The gate shows before anything else. Under 16: no random paid chest in the shop. 16 or older: the full shop. It never asks again after it is answered. |
| 5 | Forge | Tap the forge ten times. | A relic lands each time with its sound and haptic; the forge counter and gold move; a full board says so rather than failing silently. |
| 6 | Merge | Drag one relic onto its twin; drag onto a different relic; drag off the board. | The twin merges into the next tier with its effect; a different relic swaps or bounces back; nothing is lost off the board. |
| 7 | Shop | Open the shop from the dock and from the gems pill; scroll to the bottom; close it with X and with Back. | Every price is Play's localised price (no "$" in a non-USD country, no "demo"). The odds link opens the odds. The shop closes both ways. |
| 8 | A real test ad | With AB#4724 merged: a licence-tester account, no No Ads purchase. Watch a rewarded ad (a chest or a double reward) to the end, and one to half then close it. Let an interstitial come up between floors. | Google's "Test Ad" label is on each ad. The reward arrives once, only for the ad watched to the end. The game resumes where it was with its sound. No ad appears in the first session or over the age gate. |
| 9 | A test purchase | A licence tester, in a non-USD Play country if possible. Buy a gem pack with "Test card, always approves"; buy one with "slow test card"; kill the app during a purchase and reopen. | The gems arrive once, every time. Slow card: the shop says pending, and the pack arrives once when Play completes it. The rest is in "The Play store on a device" above (steps 1 to 5). |
| 10 | Restore | Buy No Ads (test card), uninstall, install again, Settings > Restore Purchases. | No Ads, the Pass and VIP come back. No gem pack is paid out a second time. |
| 11 | Back button | With AB#4728 merged: press Back (or swipe back) with a sheet open, on the vault with nothing open, and during the age gate. | Back closes the top sheet. On the vault it asks before leaving, or leaves without losing progress. It never skips the age gate. |
| 12 | Rotation | Turn auto-rotate on and turn the phone both ways, on the vault and with the shop open. | It stays portrait (the manifest locks it); nothing reloads or flickers; the board is kept. |
| 13 | Background and resume | Mid-merge press Home; wait 1 minute; come back. Then Home, open five heavy apps (camera, maps, a game), come back. | The first time the same screen comes back. After the heavy apps, a reload is allowed but the board, gold and gems are what they were, and timers (Gold Rush, the chest) have counted the time away. |
| 14 | Low storage | Fill the phone to under 500 MB free (large videos, or `adb shell dd if=/dev/zero of=/sdcard/fill bs=1m count=<n>`, deleted afterwards). Play: forge, merge, buy with a test card, force-stop, reopen. | No crash. The progress made before the force-stop is there after it. If the save fails, the player is told rather than losing it silently. |
| 15 | Airplane mode | Turn on airplane mode, then cold-start. Play a few merges, open the shop, try to watch an ad and to buy. Turn the network back on. | It starts and plays offline. The shop and the ads say they need a connection, with no spinner forever and no crash. Progress is kept when the network comes back. |
| 16 | The WebView-version screen | The rv_api29 emulator (or any phone) with Android System WebView disabled or rolled back below version 90 (Settings > Apps > Android System WebView > uninstall updates), then open the app. | A plain native screen: "Update Android System WebView", the version found and the one needed, and an Update button that opens the WebView's Play listing. No white screen, no crash. With the WebView updated, the game starts. |
| 17 | Accessibility (Pre-launch report) | Play Console > Testing > Pre-launch report for the build > Accessibility. Then on the phone: TalkBack on (the age gate, the shop's close), font size at the largest, display size at the largest. | No new warnings since the last release, or each one written down with a reason: the canvas is one view to TalkBack, so it is expected to be flagged. The age gate's buttons are read out and work with TalkBack. At the largest font and display size the HUD, the dock and the shop's buttons are not clipped or overlapping. Touch targets are 48 dp or more. |
| 18 | The descent (AB#444 slice 4) | Clear a floor (make its capstone) and choose Go down; then Begin again on a cleared floor; then, with Settings > Accessibility > Remove animations on, Go down again. Profile HWUI rendering on as bars through each. | The descent plays about 3 s: relics sink into the Floor seal, the vault falls, the new floor rises and its generators build in, with no flash of the old or new vault being rebuilt; Begin again is shorter and does not fall; with animations removed it is a fade with the floor name. Skip appears at about 1.2 s and Back skips from then. Bars under the 16 ms line apart from the swap frame; record the fps here. Measured so far only in headless Chromium on the build machine (e2e/descent.spec.ts): 57 to 58 fps, 2.84 s. |

Checks 8, 9 and 11 are waiting on AB#4724 (AdMob) and AB#4728 (the back button). Until those merge, their rows are
run for what exists and marked "not yet in the build".
