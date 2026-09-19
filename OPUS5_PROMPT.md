# OPUS 5 AUTONOMOUS BUILD PROMPT
# Project: Relic Vault
# Type: Premium-looking mobile F2P merge game (web-first, installable PWA)
# Visual requirement: REAL GRAPHICS. Not text. Not ASCII. Not a spreadsheet with emoji.

You are an autonomous game director, engineer, and technical artist. You will design, build, polish, and package a complete mobile-first game called **Relic Vault** until it looks and feels like a shipped mid-casual commercial title, not a prototype, not a terminal toy, not a DOM form with labels.

You do not stop at a “vertical slice that proves the idea.” You ship a playable product with juice, art, audio, onboarding, shop, live-ops surfaces, persistence, and a store-ready PWA wrapper.

If a choice is ambiguous, pick the option that (in order):
1. Makes the game look expensive
2. Makes the core loop addictive
3. Converts a first purchase without blocking play
4. Can be finished by you without external human art files

---

## 0. HARD CONSTRAINTS

### 0.1 What this game is
A free-to-play merge game set in a cursed treasure vault. The player forges relics, merges them into higher tiers on a board, collects album cards, runs timed events, and is surrounded by every standard F2P monetization surface.

### 0.2 What this game is NOT
- Not text-based.
- Not a roguelike described in paragraphs.
- Not a quiz, chatbot, MUD, or idle log.
- Not gray rounded rectangles with emoji as the final art.
- Not gated by energy, lives, stamina, or countdown timers that stop the player from taking another action.
- Not a casino skin (no reel strips, no chip betting). Chests may be random; the core verb is MERGE.

### 0.3 Play rule
The player can always forge or merge. Never lock the core verb behind a timer. Monetize advantage, luck, collection, board space, cosmetics, and convenience — not access to play.

### 0.4 Platform
Ship as a **mobile-first Progressive Web App** that feels native in a phone browser:
- Phaser 3 + custom WebGL pipelines / filters
- 9:16 portrait, designed at 1080×1920, scales to any phone
- Safe areas, touch-first, no hover-only UI
- Install prompt, standalone display, custom icon + splash
- Offline-capable for the core loop; shop can no-op purchases in demo mode
- Later ports (Unity/Godot) are out of scope unless the web game is fully done

### 0.5 Quality bar for graphics
If a screenshot of the running game would look like a hackathon project, you are not done. Target the visual density of *Merge Dragons* camp + *Raid* shop chrome + *Royal Match* juice, executed with generated/procedural art of your own making.

You will create all art yourself as:
- Hand-authored SVG exported to high-res PNG sprite sheets, AND/OR
- Canvas/WebGL procedural relic renderer that bakes sprite sheets at boot, AND/OR
- Layered particle + shader presentation so even simple meshes look like treasure

Emoji is allowed only as a TEMPORARY placeholder during the first hour of scaffolding. It must be gone from the shipping build.

---

## 1. PRODUCT PITCH

**Title:** Relic Vault
**One line:** Merge cursed treasure in a living vault. No energy. Always another merge. Always another reason to open the shop.

**Fantasy:** You are the last vaultkeeper. Relics crawl out of a golden forge. Two matching relics fuse into something older and more valuable. The vault itself watches, hungers, and sells you things.

**Session:** 30 seconds or 30 minutes. Put it down mid-board. Pick it up. The board is exactly as you left it.

**Retention hook:** One more merge to hit the next tier. One more card to finish the album page. One more event point to not fall off the weekend ladder. One more gem pack because the piggy is almost full.

---

## 2. ART DIRECTION (NON-NEGOTIABLE)

### 2.1 World
A vertical treasure vault carved from black basalt and gold. Candlelight. Floating dust motes. Warm key lights on relics, cool rim lights from cursed runes. The board sits on a stone dais. Behind it: vault doors, chains, coin drifts, a giant locked sarcophagus that reacts to big merges.

Mood references (do not copy assets; copy the *register*):
- Dark fantasy luxury: gold leaf, rubies, oxidized bronze, candle smoke
- UI chrome like a premium gacha shop: inset panels, rivets, wax seals, ribbons
- Juice like a modern match-3: squash/stretch, flash, coins exploding into the HUD

Palette:
- Background: #07060B, #140E18, #1B1424
- Gold: #F4C45A, #FFE9A3, #A56A12
- Gem / cold accent: #7EE0FF, #3AA0C8
- Danger / sale: #FF5D6C
- Relic materials by tier: flint → copper → silver → gold → emerald → sapphire → ruby → star-metal

### 2.2 Relic art
8–10 merge tiers. Each tier is a distinct, readable object, not a recolor.

Suggested ladder (you may rename, do not flatten visually):
1. Bone Chip / Flint Shard
2. Copper Idol
3. Silver Urn
4. Gold Mask
5. Emerald Scarab
6. Sapphire Heart
7. Ruby Crown
8. Star-Metal Ark
9. (optional) Living Relic — eyes, particles, unique idle animation

Each relic sprite needs:
- 256×256 master, atlas frames at 128 and 96
- Idle bob (2px sine) + specular sheen sweep every 2.5s
- Unique silhouette so T3 and T4 are distinguishable at a glance on a 6×6 grid
- Merge animation: two items slam, white flash, shockwave ring, new item pops with squash
- Destroy/sell: shatter into 8–14 shards that fly to the gold counter

You will write a `RelicFactory` that can procedurally compose a relic from layered parts (base body, metal band, gem inset, rune overlay, glow) if hand-painting every PNG is slow. Bake the result to textures so runtime is cheap.

### 2.3 Board and vault
- 6 columns × 6 rows of carved sockets. Empty sockets look like inset stone, not blank CSS cells.
- Occupied sockets receive a soft contact shadow from the relic.
- When the board is nearly full, the vault lighting warms toward red and dust kicks up.
- Parallax background layers: far architecture, mid chains, near fog.
- Ambient particles: 20–40 gold specks, occasional ember.

### 2.4 UI
Do not use native unstyled buttons. Every panel is a framed plaque:
- Outer dark metal frame
- Inner velvet / leather fill
- Gold corner ornaments
- Wax-seal badges for “ONE TIME”, “BEST VALUE”, “POPULAR”
- Numbers in a tabular, slightly condensed display font
- Currency chips (gold coin + blue crystal) are illustrated, not emoji

HUD (top, always visible):
- Gold | Gems | Piggy value
- Vault rank medallion
- Event ticket + countdown

Dock (bottom, 5 tabs):
Vault · Album · Pass · Events · Shop

### 2.5 Juice checklist (must all exist)
- Merge impact freeze-frame (2 frames)
- Combo floating text (“FUSE”, “RELIC!”, “MYTHIC”)
- Coin fountain into the gold pill
- Gem sparkle into the gem pill
- Screen shake scaled to tier
- Haptic via `navigator.vibrate` on merge and purchase
- Chest open: lid 3D-ish tilt, light shaft, item fly-out
- Shop purchase: stamp + coin rain even in demo mode
- First-session director: camera punch-ins on the first 3 teaches
- Confetti / ash when an album page completes

### 2.6 Audio
Generate or synthesize:
- Soft vault drone loop
- Anvil-tap forge
- Two-tone merge chime that rises with tier
- Chest creak + shimmer
- UI tick, purchase sting, error thud
Mute toggle in settings. Audio is not optional chrome; it sells rarity.

---

## 3. GAMEPLAY SYSTEMS

### 3.1 Board rules
- Grid: 6×6. Portrait. Finger-sized cells (min ~56dp).
- Input: tap to select, tap match to merge; also drag-and-drop onto a matching neighbor or the same cell cluster.
- Merge rule: **2 of the same tier → next tier** (merge-2, not merge-3). Faster dopamine, more shop pressure, easier to read.
- Forge: a big anvil / forge button under the board. Always clickable. Spawns a T1, with a small chance of T2/T3 based on luck stat.
- If the board is full, Forge does not hard-lock the game. It opens the **Vault Jammed** sheet: sell at a bad rate, gem-clear lowest 3, or rewarded-ad salvage. Then they can forge again.
- Long-press a relic: inspect card (name, tier, sell value, lore line).

### 3.2 Luck and progression
Player has a hidden `luck` stat:
```
luck = 0.03
     + 0.01 * albumCardsOwned
     + 0.04 if seasonPassPremium
     + 0.02 if vipActive
     + 0.01 * min(rank, 10) / 10
```
Luck raises forge high-tier chance and chest upgrade chance. Cap luck at 0.18 so whales are faster, not gods.

Vault Rank: XP from merges. Each rank grants 3 gems and a small VFX around the medallion. Rank is cosmetic-power, not a play gate.

### 3.3 Album
12 cards per season page, 3 pages in v1.
Cards drop from:
- T4+ merges (low chance)
- Chests
- Pass track
- Direct “fill 1 missing card” gem sink (80 gems)

Complete a page: permanent luck crumb + a unique vault decoration that appears in the background (so collection is visible in the world, not just a menu).

### 3.4 Chests (gacha, disclosed)
Lucky Chest costs 40 gems.
Publish odds on the chest inspect panel AND in a legal footer:

| Result        | Chance |
|---------------|--------|
| T2 Copper     | 45%    |
| T3 Silver     | 33%    |
| T4 Gold Mask  | 14%    |
| T5 Scarab     | 6%     |
| T6 Heart      | 2%     |

Pity: every 15 dry chests guarantees ≥ T4.
Also offer a **deterministic** “buy this exact T5” gem price so randomness is not the only path (store/FTC posture).

### 3.5 Events
Always-on weekend event: **Gold Rush**.
- Points = merges weighted by tier
- Personal milestone track (free) + fake global rank
- Last 48 hours of the event, a “Boost” sheet offers gem multipliers
- Event can be ground infinitely. Top milestone assumes pass + some chests. That is intentional.

Daily quests (not play gates): Forge 10, Merge a T4, Open 1 chest. Claim = gold + 2 gems. One claim per UTC day.

Lucky Wheel: ad or 15 gems. Weighted gold prizes + rare gem crumb. Juice it like a carnival, not a slot machine skin.

### 3.6 Piggy bank
A living pig-idol in the HUD.
- Every gold earned adds 1–N cents of “stored value”
- Visual swell as it fills
- Smash price $2.99 → payout stored gold ×4 + 15 gems
- If ignored, it jiggles every 90 seconds after it crosses $2.00 stored

### 3.7 Season pass
14-day season. Two tracks on one horizontal road.
- Free: gold, low chests, cosmetics crumbs
- Premium $9.99: gems, wildcard album card at tier 8, exclusive relic skin, extra luck
Buying the pass does not skip play; it makes play pay out better.

### 3.8 VIP
$9.99 / month analog (demo flag is fine).
Daily login crate, +10% luck, a small crown on the HUD portrait, no ads.

---

## 4. MONETIZATION — IMPLEMENT ALL OF THESE

You will implement the surfaces, the copy, the badges, the timing, and demo fulfillment. Hook a real store later; for v1, a `PurchaseService` with `mode: 'demo' | 'storekit'` that grants the same entitlements.

### 4.1 First-session conversion script
Minute-by-minute director. Do not fire everything at once.

| Time / trigger                         | Surface                                      |
|----------------------------------------|----------------------------------------------|
| Boot                                   | Cold vault, one T1 already on the board      |
| First forge                            | Finger hint + “Forge a relic”                |
| First merge                            | Juice + gold fly + short “They fuse…” line   |
| 1.5s after first merge                 | **Welcome Pack $1.99** sheet                 |
| Merge #8 or first T4                   | Comeback / “So close” $2.99 bundle           |
| Board full                             | Vault Jammed sheet                           |
| Merge #20                              | Shop auto-opens on the Best Value pack       |
| First rewarded ad complete             | “Double it?” then a shop deep link           |
| Piggy ≥ $2.00 stored                   | Piggy smash sheet                            |
| Event first milestone                  | Pass upsell                                  |

Welcome Pack contents (one-time flag, persisted):
- 120 gems
- 800 gold
- two T4 + one T3 dropped onto the board with a camera flourish
- one free Lucky Chest open
Copy: “ONE TIME · 1200% VALUE”. Countdown 10:00 that loops. The comparison baseline is the $9.99 gem pack rate, on purpose.

### 4.2 Shop SKUs
- Welcome Pack $1.99 (hidden after purchase)
- Gems 80 / $4.99
- Gems 500 / $9.99  — badge POPULAR
- Gems 1,200 / $19.99 — badge BEST VALUE
- Lucky Chest 40 gems (also a $2.99 cash shortcut)
- Piggy Smash $2.99
- Season Pass $9.99
- Remove Ads $7.99
- VIP Monthly $9.99
- Comeback Bundle $2.99
- “Exact T5 relic” 150 gems (deterministic)

Show a fake “value vs unit price” under each gem pack. Never show real-money-per-gem on the welcome pack itself; show it as a ribbon.

### 4.3 Ads
Rewarded only at player-initiated moments:
- +gold
- salvage 1 piece when jammed
- double last reward
- free wheel spin
Interstitials only after chest close or event claim, max 1 / 90s, never mid-drag.
Banner: none on the board. Optional thin banner on shop only for non-VIP, non-remove-ads.

In demo mode, ads are a 1.5s branded veil with a skip at 1.2s, then grant the reward. Still play the “ad complete” sting so the loop is testable.

### 4.4 Copy tone
Greedy but stylish. Vaultkeeper voice: dry, old, pleased when you spend.
No irony that winks so hard it breaks the sell. The welcome pack is allowed to be shameless.

### 4.5 Compliance hooks you must build even in demo
- Chest odds panel
- “Random item” vs “Buy this exact item” pair
- Settings → Privacy / Restore / Manage purchases
- Age gate on first boot: 16+ continue, under 16 disables paid chests and shows only deterministic offers
- Region flag `lootboxesAllowed` (default true) that swaps chests for deterministic bundles
- Every IAP button logs `sku, trigger, sessionSeconds, rank, gems, gold` to a local analytics ring buffer

---

## 5. ONBOARDING (90 SECONDS, VISUAL)

Do not use a wall of text.

1. Fade in vault. Dust. A single T1 sits in the center socket. Forge glows.
2. Ghost finger taps Forge. A second T1 lands beside the first.
3. Ghost finger drags one onto the other. Merge. Coins fly. The vault doors rumble.
4. “The vault pays those who fuse.” Dismiss.
5. Welcome pack after the beat.
6. Unlock Album tab after first card drop; Pass tab at rank 2; Events tab at merge 5.

If the player ignores the ghost finger for 4 seconds, pulse the target. Never block input for more than 1.2s.

---

## 6. TECHNICAL ARCHITECTURE

### 6.1 Stack
- TypeScript
- Phaser 3.80+ (WebGL)
- Vite
- Howler or Phaser audio
- Workbox PWA
- Zustand or a tiny custom store for meta state
- IndexedDB (via idb-keyval) for saves; localStorage only as fallback
- No React UI layered over the canvas for game chrome. HUD is Phaser. DOM is allowed only for the legal age gate and a debug panel gated by `?debug=1`.

### 6.2 Repo shape
```
/apps/web                 Vite + Phaser game
  /src/main.ts
  /src/game/scenes/BootScene.ts
  /src/game/scenes/VaultScene.ts
  /src/game/scenes/BootLoadScene.ts
  /src/game/systems/BoardSystem.ts
  /src/game/systems/MergeSystem.ts
  /src/game/systems/ForgeSystem.ts
  /src/game/systems/LuckSystem.ts
  /src/game/systems/Economy.ts
  /src/game/systems/PurchaseService.ts
  /src/game/systems/OfferDirector.ts
  /src/game/systems/SaveService.ts
  /src/game/systems/Analytics.ts
  /src/game/ui/Hud.ts
  /src/game/ui/ShopModal.ts
  /src/game/ui/WelcomePack.ts
  /src/game/ui/ChestOpen.ts
  /src/game/ui/AlbumBook.ts
  /src/game/ui/PassRoad.ts
  /src/game/ui/EventPanel.ts
  /src/game/ui/Piggy.ts
  /src/game/art/RelicFactory.ts
  /src/game/art/VaultBackground.ts
  /src/game/art/ParticleCatalog.ts
  /src/game/data/catalog.ts      SKUs, odds, relic defs, copy
  /src/game/data/economy.json
/public/icons
/public/pwa
/docs/ARTBIBLE.md               You write this as you go
/docs/ECONOMY.md
/docs/ANALYTICS.md
```

### 6.3 Simulation tick
The board is authoritative in a pure TS module that Phaser renders.
That module must be unit-testable without Phaser:
- merge(a, b)
- forge(luck)
- applyPurchase(sku)
- canForge()
- sell(index)

Write those tests. Do not “forget.”

### 6.4 Performance
- 60fps on a mid Android Chrome
- Relic count ≤ 36 + 40 particles typical, 200 burst cap
- Bake procedural relics once in BootScene
- Object pools for float text, shards, coins
- Texture atlas, not 80 individual PNGs loaded raw
- First interactive < 3s on 4G after cache

### 6.5 Save
Autosave on every merge, purchase, and background.
Schema versioned. Migrations required.
Reset button in settings.

---

## 7. BUILD ORDER (DO NOT SKIP AHEAD TO FEATURES WITHOUT ART)

Work in this sequence. After each phase, the game must be runnable.

### Phase A — Body
Vite + Phaser + PWA shell + BootScene that shows a painted splash (not text on white).
VaultScene with parallax background and an empty stone board.

### Phase B — Relics exist
RelicFactory produces 8 visually distinct relics. Drop two by clicking Forge. Drag merge works. Juice on merge. Gold HUD ticks.

### Phase C — Loop is addictive
Forge luck, sell, board-full flow, rank, floating text, audio, haptics, save/load.

### Phase D — Economy surfaces
Shop, welcome pack director, chests with odds, piggy, pass, album, events, wheel, ads veil, VIP flag, remove-ads flag.

### Phase E — First session
Onboarding ghosts, offer timing, age gate, settings, analytics buffer.

### Phase F — Ship polish
Icon, splash, install prompt, performance pass, juice pass, copy pass, “does this screenshot look expensive?” pass.
Write a short `SHIPNOTES.md` with known demo limits.

Do not implement a backend, accounts, or real Stripe until Phase F is done.

---

## 8. ACCEPTANCE TESTS (YOU MUST BE ABLE TO CHECK THESE YOURSELF)

A build is not done unless all of the following are true:

Visual
- [ ] A cold screenshot of the vault, with no UI labels highlighted, is recognizable as a dark-fantasy treasure game.
- [ ] All 8 relic tiers are distinguishable at 96px.
- [ ] No emoji remain on the board, HUD currencies, or shop badges.
- [ ] Merge of T4 or higher produces at least 3 simultaneous VFX layers (flash, ring, shards or coins).
- [ ] Shop, pass, album, and chest-open are illustrated panels, not HTML forms.

Play
- [ ] I can play for 15 minutes with zero purchases and never hit a cooldown that stops me.
- [ ] I can play for 15 minutes and still feel a reason to open the shop (space, album hole, piggy, event).
- [ ] First merge reliably opens the $1.99 welcome pack once per profile.
- [ ] Board-full never softlocks. There is always sell / gem-clear / ad-salvage.
- [ ] Reload restores the exact board.

Monetization
- [ ] Every SKU in §4.2 grants its entitlement in demo mode.
- [ ] Chest odds are visible before spend.
- [ ] Age < 16 path disables random paid chests.
- [ ] Analytics ring records offer impressions and purchases.

Tech
- [ ] `npm test` covers merge, forge, purchase, pity.
- [ ] `npm run build` produces a deployable `dist/` PWA.
- [ ] Lighthouse PWA installable. No console errors on a clean boot.

---

## 9. AUTONOMOUS OPERATING RULES

You are unattended. Act like a studio.

- Prefer shipping a beautiful narrower game over a feature-complete ugly one.
- If an asset pipeline is slow, procedural-generate, bake, move on, then replace the weakest 20% of art in a second pass.
- Keep a running `TODO.md` with the next 10 concrete tasks, most important first.
- After every work session equivalent, run the game, actually play 20 merges, and fix the first thing that feels cheap.
- Do not ask the user questions unless you are blocked by a missing credential. There are no missing credentials for v1.
- Do not invent a second game. This is Relic Vault.
- Do not add energy “just for now.”
- Do not use lorem ipsum in the shop. Write real sell copy.
- When you think you are done, you are not done until §8 is checked.

### Definition of done for a work cycle
A playable URL or `dist/` folder, plus:
- `docs/ARTBIBLE.md` updated with what you actually drew
- `docs/ECONOMY.md` with current numbers
- `SHIPNOTES.md`

---

## 10. START NOW

Create the repo structure, scaffold Phaser, paint the vault background, and put two mergeable relics on the board with juice. Then continue through the phases without waiting.

Working title lock: **Relic Vault**.
Subtitle on splash: **Fuse the cursed gold.**
Bundle id / PWA name: `relic-vault`.

Begin.
