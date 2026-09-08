# Admin themes

The admin ships five workspace appearances (Paper, Night, Signal, Studio,
Frost) driven by one token contract. A sixth theme is a checklist, not
archaeology: register it, tokenize it, and prove it.

## Where things live

- `src/lib/admin/appearances.ts` is the single source of truth for theme
  ids, picker labels, and descriptions. The appearance picker, session
  persistence, scenario defaults, and the verifier all read it. Never
  hardcode an appearance id anywhere else.
- `src/app/globals.css` owns every `--admin-*` token. `light` (Paper) is
  the unqualified base scope; every other appearance gets a
  `[data-theme="<id>"]` block.
- `scripts/verify-admin-tokens.mjs` enforces the contract below. It fails
  on a registry id without a token block, a token block without a
  registry entry, a theme missing any required token, and a browser QA
  matrix that drifts from the registry.
- `scripts/qa-admin-layout-continuity.mjs` sweeps every registered
  appearance across desktop and mobile viewports and fails on HTTP 500s
  or console/page errors.

## The token contract

A theme block must define every base token except deliberate globals:
aliases that resolve per-theme through `var()` (`--admin-soft`,
`--admin-line`, the `--admin-card-*-shadow` set) and constant primitives
(`--admin-mobile-dock-index`). Everything with a literal per-theme value
— canvas, surfaces, ink, muted text, accents, borders, radii, shadows,
`color-scheme` — belongs in every block. The verifier computes the
required set from the base scope, so adding a base token automatically
requires it in all themes.

Component code never carries theme-specific values. Surfaces use
`AdminSurface`, dialogs use `.admin-dialog-surface`, controls use
`--admin-control-radius`. Fixed radii (`rounded-[24px]`, `rounded-[20px]`)
and `!rounded-` token overrides are banned in admin code. Nested content
derives inward with `calc(var(--admin-surface-radius) - Npx)`. Distinct
per-theme radius character (sharp Studio, soft Frost) is intentional —
keep it.

Per-theme extras (Frost borderless cards, Signal eyebrows) live beside
the token blocks in clearly commented rules. Prefer tokens over
exceptions; every exception is a future theme's missing case.

## Add a theme

1. Append one entry to `ADMIN_APPEARANCES` in
   `src/lib/admin/appearances.ts`.
2. Add the `[data-theme="<id>"]` token block to `src/app/globals.css`
   covering every required token. Run `npm run verify:admin-tokens`
   and fill whatever it names.
3. Give the picker an icon and preview swatch in
   `AdminAppearancePicker.tsx` (a neutral fallback renders until then,
   but do not ship the fallback).
4. Extend the appearance matrix in
   `scripts/qa-admin-layout-continuity.mjs`, run it against a local
   server, and open the screenshots at desktop and mobile widths.
   Fix overflow, contrast, and console errors before review.
5. Record the theme in the release notes for the change that ships it.

Do not split `light` into a `[data-theme="light"]` block. Do not invent
a second token prefix. Do not ship a theme the continuity sweep has not
rendered.
