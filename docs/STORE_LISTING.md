# Store listing: Google Play, Main store listing (AB#4729)

Everything Play Console's **Main store listing** page asks for, ready to paste. Each text field sits in a `text` block.
`apps/web/src/storeListing.test.ts` holds each one to Play's limit and checks every graphic is at Play's exact size.
Change the copy here, and the test tells you if it no longer fits.

Everything below is true of the build as it stands. Nothing in it describes a feature before it ships.

## App name

Play's limit: 30 characters.

```text
Relic Vault
```

## Short description

Play's limit: 80 characters.

```text
Merge cursed relics in a living vault. No energy: the forge never locks.
```

## Full description

Play's limit: 4,000 characters.

```text
Deep under the city there is a vault, and the vault is hungry.

Relic Vault is a merge game. Forge a relic, drag it onto its twin, and the two fuse into something older: flint becomes copper, copper becomes silver, and so on up to the Living Relic at the top of the ladder. Every merge pays gold, shakes the vault a little harder, and quick chains build a combo.

THERE IS ALWAYS ANOTHER MERGE
There is no energy and no timer on the forge. It never locks, and you never wait for it to refill. Play for two minutes or two hours.

TEN FLOORS DOWN
Each floor of the vault has its own ladder of relics, its own generator and its own Keeper's chapter. Clear a floor and choose: go down to the next, or restore this one for permanent Renown.

PATRONS, THE ALBUM AND EVENTS
Patrons want relics you already hold, and pay gold and progress for them. Every relic you discover goes into the album, page by page. Timed events like the Gold Rush give your merges a ladder of rewards to climb.

CHESTS, WITH THE ODDS SHOWN
Chests hold relics. The chance of every result is printed in the shop, on the chest's own card and in Settings, and a chest that has not paid out for a while is guaranteed to. Players under 16, and players in regions without random chests, are offered exact items instead.

FREE TO PLAY, HONESTLY PRICED
Relic Vault is free, with optional in-app purchases: gems, a season pass and a monthly Vault VIP subscription. It shows ads between some moments and a small banner in the shop. Rewarded ads are always your choice. A one-time purchase, Silence the Criers, removes the interstitials and the banner for good.

The vault remembers your name. Come and fill it.
```

## Graphics

| Play asks for | File | Size and format |
|---|---|---|
| App icon | `screenshots/store/icon-512.png` | 512×512, 32-bit PNG. Full bleed: Play applies its own mask. |
| Feature graphic | `screenshots/store/feature-graphic-1024x500.png` | 1024×500, 24-bit PNG (no alpha). No small text. |
| Phone screenshots (8) | `screenshots/store/phone-01-…` to `phone-08-…` | 1080×1920, 24-bit PNG |
| 7-inch tablet screenshots (4) | `screenshots/store/tablet7-…` | 1200×1920, 24-bit PNG |
| 10-inch tablet screenshots (4) | `screenshots/store/tablet10-…` | 1600×2560, 24-bit PNG |
| Video | `video/trailer.mp4`, uploaded to YouTube with `video/trailer.vtt` | 30.7 s, 1080×1920 |

Play takes the video as a YouTube URL, which the Board adds once the trailer is uploaded.

How to rebuild them:

```sh
node apps/web/tools/make-icons.mjs                                       # icon and feature graphic
npm run dev                                                              # one dev server, then:
node apps/web/tools/play.mjs http://127.0.0.1:5173/ screenshots/tmp/store store   # 8 phone, 8 tablet, contact sheet
node apps/web/tools/record.mjs http://127.0.0.1:5173/ video/build/raw   # fresh footage of this build
node apps/web/tools/make-trailer.mjs                                    # video/trailer.mp4 and trailer.vtt
```

The phone screenshots, in Play's order, with their captions:

1. Forge your first relic: the first forge, with the Keeper's ghost finger.
2. Two become one: a tier-6 merge, caught in its burst.
3. Ten floors down: floor 2, its own ladder and generator.
4. Open cursed chests: a chest revealing a Sapphire Heart.
5. Complete the album: the Forge Road page, begun.
6. Climb the event ladder: the Gold Rush ladder.
7. Prices shown up front: the Vault Shop.
8. All odds shown: the odds and disclosures sheet, from Settings.

The tablet sets are shots 1 to 4.

## Tags

Play lets an app choose up to five tags from its own list. These ten are ranked; choose the first five that Play
offers.

```text
Merge
Puzzle
Casual
Fantasy
Collecting
Relaxing
Treasure
Single player
Stylized
Mystery
```

## What's new (template)

Play's limit: 500 characters. Replace the angle brackets each release, and keep it to what changed for a player.

```text
<Version>: <the one change a player will notice first>.
- <a second change, in a player's words>
- <a fix, said as what now works>
Thank you for playing. The vault remembers.
```

## Trailer shot list

30 seconds, 1080×1920, with no captions burned in. `apps/web/tools/make-trailer.mjs` cuts it from
`video/trailer.json`. Each footage shot names a segment of `video/segments.json`, the clip within it, and a range in
fresh footage recorded by `record.mjs`. The captions below go to YouTube as `video/trailer.vtt`.

| # | Seconds | Shot | Source | Caption (in the .vtt) |
|---|---|---|---|---|
| 1 | 2.5 | Title card: the icon and the wordmark | — | Relic Vault. |
| 2 | 7.0 | First forge, then the first merge with the ghost finger | `02-first-verb`, 5.5–12.5 s | Forge a relic. Drag one onto its twin. |
| 3 | 15.0 | The loop: merges, combos x3 to x5, RELIC! bursts | `03-loop`, 14–29 s | Two of a kind become one older relic. Quick chains build combos. No energy: the forge never locks. |
| 4 | 3.2 | A chest opens on an Emerald Scarab | `04-monetization` clip 2, 9.8–13 s | Open chests. Their odds are always shown. |
| 5 | 3.0 | End card: the wordmark, FREE TO PLAY | — | Relic Vault. Free to play, with optional purchases. |
