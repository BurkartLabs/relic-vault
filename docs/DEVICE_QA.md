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
| Real low-end Android device (Pixel-class) | **TODO**: no device, SDK or emulator on the build machine yet. Run this page's method on one and fill in a row below. |
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
