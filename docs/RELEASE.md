# Cutting a release

AB#4732. One version number, package.json's, drives everything: `versionName` is that version, and `versionCode` is
`major*10000 + minor*100 + patch` (1.2.3 is 10203). A patch is 1 higher, a minor 100, a major 10000, so minor and
patch stay 0-99. `scripts/version.mjs` computes it and refuses anything Play could not order.

## In five lines

1. `git switch -c release/X.Y.Z origin/main`. Check that CHANGELOG.md's **Unreleased** section says what changed.
2. `npm version patch` (or `minor`, `major`). It bumps package.json, dates the Unreleased notes as the new version,
   writes `android/version.properties`, commits, and tags `vX.Y.Z`.
3. `git push -u origin HEAD --follow-tags`, then open the pull request, approve it and set it to auto-complete.
4. From the merged main, `npm run build`, then build and sign the Android App Bundle.
5. Upload it in Play Console with release notes from the template below, and move the changelog link into the listing
   if it changed.

`android/app/build.gradle` reads `versionName` and `versionCode` from `android/version.properties` (AB#4723), which
`npm run build` rewrites from package.json every time, so a build always carries package.json's version.

## Play release notes template

Plain text, at most 500 characters (Play's limit per language). Write for players, from the changelog, newest first:

```
<en-US>
What's new in Relic Vault X.Y.Z:
- <the change a player will notice first, in a few words>
- <the next>
- <fixes, in one line: "Fixes a crash when ...">
Thanks for keeping the vault. Found something cursed? Tell us from the Play listing.
</en-US>
```

Count before pasting: `node -e "console.log(require('fs').readFileSync(0,'utf8').length)" < notes.txt` must print 500
or less.
