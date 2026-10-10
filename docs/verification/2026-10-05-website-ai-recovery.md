# Website AI review and recovery

This change targets the installation website builder in Site Studio. It preserves
its owner authorization, private draft saves, explicit publication, validation,
model selection, price ceilings, quotas and usage receipts.

## Findings and implementation

- Creating a page previously derived its address on every title edit, including
  after a custom address was entered. Automatic suggestions now stop after the
  address is edited.
- Generated documents allow 40 root sections, but the editor previously allowed 100. Add section now uses the content kind's existing schema limit and shows
  the count; native pages retain their 100-section limit.
- Page tools and section starter state previously survived page switches. React
  keys scope the tools to the selected page and the starter to its content kind.
- A pending suggestion previously prevented closing the AI dialog. Cancel,
  closing and Escape abort the request. The suggestion route forwards the
  Request signal through both generation paths to the existing OpenRouter
  gateway. An aborted request has no retry; provider charges may still apply.
  Request identity and cancellation checks also reject late replies locally.
- Review previously compared against the current page. The comparison now uses
  the original preparation snapshot; a visible warning and disabled Apply
  protect newer edits, with a defensive check in the apply handler.
- New layouts previously offered only a text comparison. The existing live
  preview now renders the candidate at actual 390, 768 and 1440 pixel widths,
  before local application. Layout-only suggestions explain why there is no
  text difference.
- Shared dialog CSS hid every iframe, including previews inside dialogs. It now
  hides background route previews; portalled dialog previews remain visible.

No new dependencies, model execution path, database schema, publication writer
or external messaging operation was introduced.

## Verification boundaries

`test:website-ai-recovery` executes the actual component, service, adapter and
route sources with controlled React hooks and model transport. It checks custom
addresses, section limits, page keys, cancellation, late replies, unmounts,
stale application, authorization ordering and signal propagation in both model
paths. The existing Site Studio suite covers document validation, tenant scope,
private revision receipts, publication, history and compatible models.

`qa-website-ai-recovery.mjs` uses the production application and fictional
Northline workspace. Four contexts cover desktop and phone, normal and reduced
motion. Controlled suggestion replies exercise cancellation races, failure and
retry, page switching, layout-only review and stale review. Native keyboard
interaction covers cancellation, preview selection and Escape. Fictional draft
saves use the existing runtime and validate the section limit, without publishing
or contacting protected APIs. Computed visibility assertions distinguish a
rendered candidate from a hidden iframe. Screenshots require visual inspection.

These checks do not establish live model availability, refund behavior,
production database readiness or a production deployment. CI, review, merge and
deployment remain separate facts. Local receipts are retained outside source.

## Release content review

The Site Studio guide, plugin README, public feature description, FAQ and product
changelog describe the new controls, private result, cancellation cost caveat and
recovery. The guide's existing fictional Site Studio entry-point figure remains
accurate. The docs index, source inventories and public check count are updated.
