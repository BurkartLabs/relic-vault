# Changelog

All notable changes to Relic Vault are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Write each change under **Unreleased** as it merges. `npm version` dates
those notes as the new version (docs/RELEASE.md). The Google Play release notes are written from them.

## [Unreleased]

### Added

- Release versioning: versionCode from package.json's version, the `npm version` hook, this changelog and
  docs/RELEASE.md (AB#4732).
- A privacy policy and terms of play, linked from Settings, and Delete My Data (AB#4726).

### Changed

- Settings shows the build's own version, not a fixed "v1.0" (AB#4732).
- A faster start on a slow phone: the relics of floors 3 to 9, the shop's art and the album's cards are painted the
  first time a screen shows them, not at boot, and kept for the session. No change to how anything looks (AB#4737).

## [1.0.0] - 2026-09-19

### Added

- The Relic Vault preview: the merge vault, procedural art, economy surfaces, telemetry and the QA smoke suite. See
  SHIPNOTES.md for what it contained.
