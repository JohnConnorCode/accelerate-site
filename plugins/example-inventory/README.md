# Inventory registration example

This is a disabled-by-default module registration demonstration, not an inventory
management product. It registers a page, navigation and public settings. It has
no stock ledger, purchase orders, reorder worker or business-write tools.

Open **Integrations** and enable **Inventory (example)** in the module controls,
then visit `/admin/example-inventory`. Expect an explanatory page. Change the
reorder threshold (0–10,000, default 10), warehouse (`main` or `overflow`) or
reorder toggle through the shared settings controls to see configuration persist.
These illustrative settings do not implement inventory or automatic reordering.
Do not place secrets or private customer data in public module settings.

Disable it in the same controls; navigation disappears and the route is gated.
Configuration remains saved. It makes no provider or model request; hosting and
any surrounding AI chat still have their usual costs. AI setup uses the shared
module preview/propose tools and an exact approved configuration change.

For a missing page or disabled notice, inspect the current module configuration
and compiled manifest before changing routing. Start with the
[extension guide](../../docs/contributing/EXTENDING.md),
[manifest](../../extensions/example-inventory.module.json) and
[page](../../src/app/admin/example-inventory/page.tsx). Run
`npm run test:plugin-modules`, `npm run verify:module-contract` and
`npm run verify:extensions`. These verify registration and gating, not a stock
workflow. A real implementation needs its own live card and end-to-end proof.
Follow the [documentation contract](../../docs/contracts/PLUGIN-DOCUMENTATION.md).
