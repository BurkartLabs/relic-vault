# Relic Vault release 1: publish on Google Play (the Board's own steps)

Feature AB#4711 (Proposed) · product relic-vault · migrated from Azure DevOps on 2026-09-30 (AB#4889)

## What it is

Where it sits: under the Relic Vault epic AB#268, opened by the Board on 2026-09-27: "pivot towards getting Relic Vault ready for release... available on the Android App Store... show ads when it's supposed to... payment and store actually working." Sibling of the Builder Feature (release 2).
What it is: every step only the Board can take, because it needs the Board's identity, card, or console login: the Google Play developer account, the Play Console app and listing, the content declarations, Play App Signing and the first upload, the 12-tester closed test, AdMob, the Google Payments merchant profile and in-app products, RevenueCat, the production rollout and the first weeks of monitoring. Each child is written as a plain ordered list of the steps in the order to take them, with what to hand back to the repo at the end.
Why it matters: GOVERNANCE "Gates": store, paid ads and domain spend are Board only. Nothing in this Feature can be delegated to an agent, and several steps have hard clocks (14 days of closed testing) so they should start before the Builder work finishes, not after.
Order: account first (the 14-day clock cannot start without it), then AdMob and Payments in parallel with the Builder Feature, then closed testing on the first real build, then production.

## Acceptance

_To be written: the Feature had no acceptance criteria in Azure DevOps._

## Checklist

Each heading replaces a Requirement or Bug, which Azure DevOps keeps (Closed, tagged folded, linked here); its lines are its Acceptance. A checked line was Resolved and has not been verified. 10 open, 0 resolved.

### Board: open and verify the Google Play developer account (Requirement AB#4713, Proposed)

What: Where it sits: Release 1, step 1 of 9. Everything else in this Feature waits on this account, and the 14-day closed test cannot start without it, so it goes first. / Steps, in order: / - Go to play.google.com/console and sign in with the Google account you want to own the app for good (it is hard to move an app between accounts later; a dedicated account like relicvault@... is fine). / - Choose the account type. Personal is quicker (no D-U-N-S number) but Play will show your email and phone number… (the rest: AB#4713)

- [ ] Play Console opens to a verified developer account with the fee paid.
- [ ] A comment on this item records the account type and public developer name.

### Board: create the Relic Vault app in Play Console and fill the store listing (Requirement AB#4714, Proposed)

What: Where it sits: Release 1, step 2 of 9. Needs the account (step 1) and the store copy and graphics that Builder story "Store listing asset pipeline" produces under release 2 (docs/STORE_LISTING.md and the export folder). / Steps, in order: / - Play Console, All apps, Create app: name "Relic Vault", default language English (United States), App type Game, Free. Accept the developer programme policies and US export laws. / - Grow, Store presence, Main store listing: paste the short description (80… (the rest: AB#4714)

- [ ] Main store listing is saved with icon, feature graphic, at least 4 phone screenshots, short and full description, category and contact email.
- [ ] Play Console shows no warnings on the Store listing page.

### Board: answer the app-content declarations (data safety, content rating, ads, target audience) (Requirement AB#4715, Proposed)

What: Where it sits: Release 1, step 3 of 9. Every answer here must match what the app actually does; docs/DATA_SAFETY.md (Builder story "Privacy policy, terms and data-safety inventory") lists the exact data the app collects so you can copy from it rather than guess. A wrong declaration is the most common reason a first release is rejected. / Steps, in order: / - Play Console, Policy, App content, Privacy policy: paste the public URL of the policy page (release 2 hosts it outside the invite wall). / -… (the rest: AB#4715)

- [ ] Every App content section shows complete in Play Console.
- [ ] The content rating certificate names the "Includes Random Items" descriptor and the app declares ads.
- [ ] The Data safety answers match docs/DATA_SAFETY.md row for row, or the differences are commented on this item.

### Board: Play App Signing, first Android App Bundle upload, and install on your phone (Requirement AB#4716, Proposed)

What: Where it sits: Release 1, step 4 of 9. Needs the signed .aab that release 2's "Capacitor Android shell" and "CI builds a signed AAB" stories produce. This is the first time the game exists as an Android app. / Steps, in order: / - Decide the package name with the Builder before the first upload; it can never change. Proposed: com.orchestrata.relicvault. / - Generate the upload keystore once, on your machine, not in the repo: keytool -genkeypair -v -keystore relic-vault-upload.jks -alias upload… (the rest: AB#4716)

- [ ] An internal-testing release is live and installed from Play on the Board's phone.
- [ ] Package name recorded on this item and identical to the one in android/app/build.gradle.
- [ ] Pre-launch report reviewed, findings filed as Bugs.

### Board: closed testing (12 testers for 14 days) and the production-access application (Requirement AB#4717, Proposed)

What: Where it sits: Release 1, step 5 of 9. Applies to personal developer accounts created after 2023-11-13; organization accounts skip it. Only closed testing counts, and Play checks since 2026 that the testers actually used the app. Start this the day the first real build exists: the clock is 14 continuous days. / Steps, in order: / - Play Console, Testing, Closed testing, Create track (or use the default Alpha track). Create a release with the current .aab, release notes describing what to try. / -… (the rest: AB#4717)

- [ ] Dashboard shows production access granted, or the account is an organization account (recorded on this item) and the step did not apply.
- [ ] Belgium excluded from the track's countries.

### Board: AdMob account, ad units, app-ads.txt, and the consent message (Requirement AB#4718, Proposed)

What: Where it sits: Release 1, step 6 of 9. Can run in parallel with the Builder's "AdService abstraction and AdMob adapter" story; the Builder needs the IDs from step 6 and the Board needs the app in Play (step 4) to finish linking. The IDs (app ID and ad unit IDs) are not secrets and are committed to the repo config. / Steps, in order: / - Go to admob.google.com, sign in with the same Google account as Play Console, accept the terms, choose your country and time zone (this fixes the payment currency).… (the rest: AB#4718)

- [ ] A comment on this item carries the App ID and rewarded + interstitial unit IDs.
- [ ] GDPR and US messages published in Privacy and messaging.
- [ ] public/app-ads.txt is served at the developer website domain listed in Play (verify in a browser) and AdMob shows the app as Ready after launch.

### Board: Google Payments merchant profile, in-app products, subscription, and RevenueCat (Requirement AB#4719, Proposed)

What: Where it sits: Release 1, step 7 of 9. Needs the app in Play Console (step 4). Product IDs are chosen here and mirrored in the Builder's "PurchaseService Play adapter" story; the recommended ID for each SKU is listed so both sides use the same string. Prices come from the catalog (catalog.ts:45-73). / Steps, in order: / - Play Console, Setup, Payments profile: create a Google Payments merchant profile (legal name, address, tax info, bank account for payouts). Without it the in-app products pages… (the rest: AB#4719)

- [ ] Nine in-app products and one subscription are Active in Play Console with the IDs above.
- [ ] RevenueCat project shows the Play app connected (green) and the three entitlements.
- [ ] A test purchase of each product succeeds on the internal build and a refund revokes the entitlement.

### Board: production release and staged rollout (Requirement AB#4720, Proposed)

What: Where it sits: Release 1, step 8 of 9. Needs production access (step 5), the declarations (step 3) and a build that passed device QA (release 2). This is the GOVERNANCE production deploy: the Board's button, and the Board's alone. / Steps, in order: / - Confirm the Live gates in GOVERNANCE "Gates" are met or waived: Depth Critic DEEP ENOUGH and Monetization Critic HEALTHY, per the Decision under release 2 (today 3.0 and 2.8, both below 3.5). / - Play Console, Production, Countries and regions: all… (the rest: AB#4720)

- [ ] The app is at 100% production rollout with vitals under the thresholds.
- [ ] Belgium excluded.
- [ ] A comment records the version and dates.

### Board: the first month live, what to watch and when (Requirement AB#4721, Proposed)

What: Where it sits: Release 1, step 9 of 9. A standing checklist rather than a one-off; close it after the first month with what you saw. Most of these have email alerts that are off by default. / Steps, in order: / - Play Console, Settings, Notifications (or the Play Console app on your phone): turn on policy, vitals and review notifications. / - Weekly: Android vitals (crashes, ANRs, excessive wakeups), the Pre-launch report for each new build, and Policy status (an unanswered policy email can remove… (the rest: AB#4721)

- [ ] Notifications enabled in Play Console and AdMob.
- [ ] A first-month comment on this item with the six numbers.

### Board: restore relic-vault CI (parallelism grant or a self-hosted agent), re-enable the pipeline, confirm the preview deploys (Requirement AB#4762, Proposed)

What: Where it sits: Release 1 (AB#4711), step 0: it comes before everything else because nothing deploys and no AAB can be built by CI until it is done. Fixes Bug AB#4761. / Steps, in order: / - Decide which of the two you want. Free hosted grant: 1,800 minutes a month on Microsoft's machines, 2-3 business days to approve, enough for validate + preview but the Android build stage will be slow and may exceed the monthly minutes. Self-hosted agent on your PC: free, unlimited, fast, Android SDK cached, but… (the rest: AB#4762)

- [ ] relic-vault-ci is enabled and the latest main run is green in both validate and preview.
- [ ] /privacy.html and /terms.html load anonymously on the live Static Web App; the root still requires sign-in.
- [ ] Bug AB#4761 is Resolved with the option chosen recorded.

## Demo script

_To be written._
