# Form builder

Build shareable lead-capture and client intake forms with an MIT-licensed stack:
the drag-drop field editor is native to this workspace and rendering uses
SurveyJS `survey-core` + `survey-react-ui` (MIT). SurveyJS Creator (the
commercial drag-drop builder) is deliberately not used, so this plugin needs
no per-developer license.

Responses never write to the CRM on their own. Each response waits in the
review queue until a person accepts it into the canonical intake pipeline or
rejects it. The plugin starts disabled.

## Collect your first response

1. In **Plugins**, enable **Form builder**, then open `/admin/forms`. Use an
   authorized workspace.
2. Create a draft. Start from a template or add fields: text, long text,
   dropdown, radio, checkbox, yes/no and rating. Choice fields need at least
   one option. Names stay lowercase slugs and must be unique.
3. Watch the live preview, save the draft, then **Publish**. The share link
   looks like `/f/<64-hex-characters>`.
4. Open the link in a private window and submit a test response with a real
   email shape.
5. Back in **Responses**, accept the response to create a canonical lead
   through identity resolution, or reject it. Accepting a response without an
   email is refused on purpose.

Run `npm run test:form-builder` for the schema, submission and review
fixtures. The public demo has no complete form-intake simulation. Browser QA
uses controlled fictional transport around the real UI and never sends records
externally; verify the actual intake workflow in a configured test workspace.

## AI, permissions and data

The central assistant builds forms through five registered tools that reuse
the same tenant-bound services as the interface:

- `list_forms` and `read_form_submissions` read definitions and responses.
- `prepare_form_draft` validates AI-authored content and returns the exact
  normalized draft with a review digest. It writes nothing.
- `propose_form_draft` stages that exact digest for human approval. Approved
  execution creates a new draft or updates the named draft; it never publishes.
- `propose_form_publish` stages publication of the reviewed draft digest.
  Approved execution rechecks the live schema against the digest, the draft
  status and the module state before creating the share link.

Ask for a form in conversation ("build a lead-capture form with name, work
email and project details"), review the prepared draft, approve it, then
approve publication as a second decision. Accepting a response into the
pipeline stays a human action in `/admin/forms`; no AI tool writes leads, so
the assistant cannot approve its own intake. Preparation and rendering make no
paid model or provider call.

The public link needs no login. The token is the credential: only published
forms resolve, answers are validated against a bounded shape (40 fields, short
text), posts are rate-limited, and repeat posts with the same request identity
return the original receipt instead of a duplicate. A hidden honeypot field
silently discards automated submits without recording them. Every recorded
response and its operator notice linking to `/admin/forms` commit together.
If either write fails, the entire submission rolls back and the visitor can
retry the same request without duplicates. Required fields, types, choices,
dates, ratings and email answers are validated against the locked definition.

## Disable and recover

Disable in **Plugins** to hide navigation, gate `/admin/forms` and its API,
and retire public links: published links return not-found while the module is
off. Existing forms, responses and receipts remain; use the
normal lead controls for anything already accepted.

If publishing is refused, the stored definition failed validation: open the
draft, fix the named field, save and publish again. If accepting is refused,
the response has no usable email or was already reviewed. After an uncertain
result, reuse the same request identity for a retry; do not manufacture a new
one to bypass the uncertainty.

Acceptance commits one review decision and one durable intake action together.
The UI reports whether intake completed or needs attention. Inspect the action
in Tasks & approvals; after correcting the cause, select Retry approved intake
on the reviewed response. It preserves the same unexpired action, source
identity and recorded effects.
Expired actions require operator reconciliation before any replacement work.
Draft saves and publication use the version read by the editor, so stale
requests cannot overwrite a newer form. Form rendering uses shared workspace
and public-site theme tokens rather than a separate fixed palette.
Run `npm run test:form-builder:postgres` for concurrent duplicate, review,
rollback, tenant and stale-version checks in an isolated local database.

## Extend and upgrade

[`form-builder.ts`](../../src/lib/revenue-os/form-builder.ts) owns validation
and state; [`FormsWorkspace.tsx`](../../src/components/admin/FormsWorkspace.tsx)
and [`SurveyRunner.tsx`](../../src/components/forms/SurveyRunner.tsx) are
adapters. Supported element types are `text`, `comment`, `dropdown`,
`radiogroup`, `checkbox`, `boolean`, `rating` and one level of `panel`.
Expressions, calculated values, file uploads and multi-page branching are out
of scope for this version. Run `npm run build:extensions`,
`npm run verify:extensions`, `npm run verify:module-contract` and
`npm run test:form-builder` after edits. Follow the
[documentation contract](../../docs/contracts/PLUGIN-DOCUMENTATION.md).
