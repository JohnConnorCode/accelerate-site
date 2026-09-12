# Build on the admin core

The core owns composition and usability before theme expression. Use the existing
admin primitives for every admin, tenant and fictional demo route. Public website
content has its own styling system.

## Ownership

- `src/app/admin-foundations.css` owns typography, spacing, density, control sizes,
  page widths and interaction timing. Tokens inherit into portaled overlays.
- `src/app/admin-components.css` owns component recipes and responsive composition.
  Edit a recipe here rather than adding a route-specific override to globals.
- `src/lib/admin/themes.json` remains the preset registry. Generate its CSS with
  `npm run themes:generate`. Existing custom version-1 themes inherit the new
  foundations without changing their stored format.

`AdminSurface`, `AdminButton`, `AdminTable`, `PageHeader`, `AdminDialog`,
`AdminStatusMessage` and `EmptyState` are the core vocabulary. Existing public
Button/Input consumers explicitly opt into the admin recipes inside admin;
their public appearance stays unchanged. Use semantic `admin-field` and
`admin-field-label` classes for native fields. Use a real link for navigation.

## Compose the work

Every route stage receives one of five compositions: overview, collection, board,
workspace or settings. The shared route classifier handles demo and tenant paths.
Collections can use the entire work area; settings have a bounded reading width.

Use `admin-grid` for equal panels, with `admin-grid--metrics`, `--fields` or
`--panels` for the minimum useful width. Auto-fit reclaims absent tracks. Use
`admin-split` for a primary area and context, `--equal` for equal work areas, and
`--master` for a list/detail composition. Children wrap by available space,
retain DOM order and grow when a sibling disappears. Do not use dense packing,
which can separate visual and keyboard order.

Today uses `admin-modules` and `data-width="full|primary|support"`. These are
preferred widths, not reserved grid tracks. Saved module order and visibility
remain authoritative. Do not insert spacer modules or blank fixed-height cards.

Tables and boards can scroll inside their own regions. The app viewport must
never scroll horizontally. Native row or form structure may retain its local
grid when columns express actual fields rather than page composition.

## Density and motion

The Appearance panel exposes Comfortable and Compact. Density is stored under
`accelerate:admin:density:v1`, separately from appearance and business records.
A pre-paint script applies it; blocked storage retains the current-page choice.
Coarse pointer targets stay at least 44px. Existing saved Today view density is
preserved as a local view preference.

Control transitions are short and interruptible; reduced motion removes movement.
The existing route stage remains the sole committed-route entrance owner. Do not
add a second page animation to a composition.

## Inspect before handoff

Run `npm run dev -- --webpack` and open `/dev/admin-design` for the production
primitives with fictional data, theme/density switching, an optional panel, empty
state and dialog. This route returns 404 outside development.

`npm run qa:admin-core` owns its local server and browser through the shared
resource gate. It writes route geometry and screenshots to `/tmp/admin-core-qa`.
Open the screenshots. Token completeness alone cannot establish hierarchy or
usable layout. Verify sparse content, long labels, hidden panels, keyboard focus,
mobile widths, overlays and saved preference restoration.
