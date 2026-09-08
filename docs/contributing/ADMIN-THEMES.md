# Admin themes

Admin appearances share geometry, motion and semantic colors while keeping their
own character. Paper, Night, Signal, Studio and Frost live in
`src/lib/admin/themes.json`. The picker and browser matrix derive from this
registry. `npm run themes:generate` produces `src/app/admin-themes.css`, including
the dark utility selector from each definition's `mode`.

## Add a built-in appearance

Copy a definition in `themes.json`, give it a unique id, label and description,
and adjust its tokens. Run `npm run themes:generate`, `npm run test:admin-themes`
and `npm run verify:admin-tokens`. No route or picker changes are required.
The picker generates its swatch from the palette and supplies a neutral icon
for an unfamiliar id. The browser continuity matrix automatically includes it.
Inspect desktop and phone screenshots before handing it off.

Paper owns the unqualified base scope. Every other definition declares all
non-global tokens. Generated CSS must stay current; verification checks without
rewriting it. Components use `AdminSurface`, `.admin-dialog-surface`, and theme
radius utilities. Public square-corner styling remains the fallback outside
admin. Fixed pixel radius classes and token overrides are forbidden in admin.

## Create a workspace theme without code

Branding contains a live preview, a compact theme editor, JSON import/export,
and Create with AI. `theme-definition.ts` owns the versioned schema and compiler:
seven hex colors, light/dark mode, a typeface choice, bounded corner radii and a
depth choice. All other tokens derive centrally. Text must meet 4.5:1 contrast
on canvas and surface; navigation must meet it on its own background. Derived
secondary and status colors are adjusted to remain readable. CSS, selectors,
URLs and executable values are not accepted.

The optional `adminTheme` field uses existing workspace branding persistence,
revision checks, UI saves and governed AI preview/proposal/approval. Legacy
branding retains its existing shape when no theme is saved. One custom workspace
theme is active at a time; exported definitions can be reused in other workspaces.
The appearance preference is per device. Demo changes remain scenario-local.
Removing a custom definition falls back to Paper if that appearance was selected.

`AdminThemeProvider` supplies the same validated tokens to the shell and portal
overlays. The query provider is keyed by workspace, preventing tenant cache reuse.
A selected custom dark theme drives the same dark utility variant as a built-in
one. Shared legacy text and surface aliases are scoped to admin so a new theme
cannot inherit the public site's contrast. No route should branch on a theme id.

## Verify a change

The theme unit check covers preset conversion, generated token completeness,
contrast, portable round trips, invalid data and optional legacy branding.
`verify:admin-tokens` enforces registry completeness, generated freshness, fixed
radius restrictions and the decreasing legacy palette budget. Browser QA must
also inspect real text, controls, focus, menus and dialogs: token tests alone
cannot prove rendered contrast or layout.
