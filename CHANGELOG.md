# Changelog

Notable changes to this repository — the codebase, tooling, and open-source infrastructure. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Product-facing updates (features, fixes, and improvements to the live application) are tracked separately at [/changelog](https://www.acceleratewith.us/changelog) and [src/content/changelog.ts](src/content/changelog.ts).

## [Unreleased]

### Fixed

- Homepage marquee ("how we help" ticker) sat invisible for 8.3s before fading in; reduced to 0.3s.

### Added

- Prettier formatting, enforced in CI.
- Product changelog page gained category filtering and full-text search.

### Changed

- `src/lib/revenue-os/README.md` now documents all domain modules.

## [0.1.0] — 2026-08-31

- Initial open-source release.
