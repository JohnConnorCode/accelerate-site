# Site Studio: AI-editable public website on the business runtime

Status: **planned capability, not shipped behavior.** Nothing in this document
describes a working feature. The executable specification lives in twelve
backlog cards (initiative `Site Studio`, workstream `site`); this document is
the design record they implement. Card index is at the bottom.

## 1. Proposition

Fork Accelerate and you get not only the business operating system, but an
AI-editable public website connected directly to it. Today the public site is
hard-coded React per route. Site Studio makes everything inside the page
`<main>` data-driven and AI-editable while the surrounding application shell
stays stable.

The core loop an owner should get:

> "Create a page for our bookkeeping automation service. Match the rest of the
> site, make it conversion-focused, use our existing case studies where
> relevant, and add it under Services."

Accelerate creates the page, writes and designs it, wires the CTA and form to
the existing inbound pipeline, adds the navigation entry, generates metadata,
shows a preview, and records a revision. Then targeted edits ("make the hero
more premium, cut copy 30%") change only that portion. Then "publish it" moves
the published pointer atomically.

## 2. Verified starting position

These codebase facts were checked against `main` and constrain the design:

- `src/components/layout/MarketingChrome.tsx:11-33` owns Header, `<main
  id="main-content">`, and Footer for every public page via
  `src/app/(marketing)/layout.tsx`. The seam is real: keep the chrome, make
  `<main>` data-driven.
- The homepage is a hard-coded section order in
  `src/components/v2/studio/Studio.tsx:21-43` (Hero through FinalCta). No
  CMS, no page JSON exists today.
- Articles are MDX files in `src/content/articles`, loaded by `src/lib/mdx.ts`
  with date-based scheduling only. No drafts, no versions. RSS, sitemap, and
  the `/api/revalidate` hook derive from the same loader, so any migration
  must preserve URLs, feeds, sitemap entries, and metadata behavior.
- The action queue already implements the publish policy we need:
  `proposeAction` with dedupe keys (`src/lib/revenue-os/actions.ts:54-126`),
  an allowlisted action table (`action-executor.ts:42-67`), expiry sweeps,
  atomic single-claimant approval, and terminal receipts. Publishing is an
  external effect and stays always-ask; draft generation is an internal write.
- Module enablement, nav gating, and AI-tool gating already exist
  (`src/lib/revenue-os/modules.ts`, `module-guard.ts`, generated extension
  manifests). The editor should ride this system, not build a second one.
- Analytics has a canonical attribution path (`canonical-attribution`,
  shipped). Page-outcome measurement reuses `website_events` plus that path,
  never a parallel funnel.
- No Puck, Tiptap, Storybook, Sandpack, or storage buckets exist today.
  Public images are static files under `public/`. Next.js 16, React 19.

## 3. Architecture decisions

**3.1 Store validated documents, never executable JSX.** AI-generated JSX
would bypass route thinness, domain-service ownership, SSR determinism, and
auditability. The canonical page is a React-shaped JSON document: typed nodes
with props, tokenized styles, and children. The model manipulates data; a
registered renderer produces React. This is the decision everything else
hangs on.

**3.2 Puck is the editor, not the architecture.** Puck (MIT, React-native,
JSON documents) supplies canvas, drag/drop, selection, and property editing.
Accelerate owns versions, publishing, permissions, AI editing, style guide,
assets, routes, collections, analytics, actions, audit, and extensions.
Stored documents sit inside an Accelerate envelope with a schema version, so
Puck's internal format never becomes the permanent public contract. The
envelope and an independent renderer land *before* the editor integration.

**3.3 Admin-only, lazy-loaded editor.** Puck ships only under `/admin/site/*`
via dynamic import. Public routes import the tiny renderer alone, with no
dependency path to editor code. If the editor dependency ever disappeared,
published sites keep rendering.

**3.4 Semantic sections first, atoms under Advanced.** The registry biases to
meaningful sections (Hero, LogoCloud, FeatureGrid, Process, Testimonials,
CaseStudies, Pricing, FAQ, CTA, LeadForm, RichTextSection, ImageText,
Gallery) with controlled variants — roughly 8–12 sections per page instead of
hundreds of layout nodes. Cheaper inference, easier versioning, responsive by
construction, harder to break. Low-level primitives stay available but are
not the default AI vocabulary.

**3.5 Structured style tokens, not Tailwind classes.** Stored pages cannot
reference build-time Tailwind classes invented after deployment. Styles use
named tokens (`surfaceDark`, `xl`, `contentWide`) plus bounded literal
values; the renderer maps them to CSS variables and existing utilities. A
versioned SiteStyleGuide (colors, type, spacing, imagery rules, voice rules,
forbidden language, accessibility and SEO rules) is the context the AI
designs against, and every version records which guide version produced it.

**3.6 Patch-based AI editing.** The model proposes typed patches (set prop,
set style, insert, remove, move, replace, update metadata) against node IDs,
not full-page regenerations. Smaller blast radius, reviewable diffs, cheaper
calls. Full-tree replacement requires an explicit redesign command. Patches
validate server-side against component schemas; model JSON is never trusted.

**3.7 Revisions with pointer publishing.** Pages, posts, and templates share
one generalized document model with version rows. Publishing moves a
`publishedVersionId` pointer; rollback creates a new version cloned from an
old one and moves the pointer. Published rows are never mutated in place.
Draft previews render through the same renderer behind founder-only auth or a
signed single-use token — never a guessable URL.

**3.8 Business components, not decorative widgets.** LeadForm, BookingCTA,
ContactForm, CaseStudyGrid, and similar instantiate existing pipelines:
inbound capture, identity resolution, attribution. AI never invents a raw
`<form action>`. Registered custom components (built by coding agents as
normal source) are the lane for real interactivity. A sanitized CustomMarkup
escape hatch (HTML plus scoped CSS, no JavaScript) covers unusual static
designs; the sanitizer library and CSP posture are chosen at implementation
time with an evaluation record, not assumed here.

**3.9 No Payload, no Sandpack, Storybook later.** Payload's draft/version
semantics are worth studying; its backend would duplicate Supabase, tenancy,
auth, and audit, so it stays out. Sandpack solves browser IDE editing, which
is not in the MVP. Storybook is dev-only tooling for a future component SDK,
not an application dependency. Tiptap (minimal extensions) arrives only with
the posts migration, and only for long-form bodies — normal copy stays plain
`text` props.

**3.10 Module placement.** The public renderer is core platform code because
it serves marketing routes. The editor is an extension module following the
established `extensions/*.module.json` path, inheriting nav hiding, route
guards, AI-tool gating, and the approval queue automatically.

**3.11 Portability.** `site:export` / `site:import` keep the open-source
story intact: fresh clones run from a bundled snapshot, connected installs
treat Supabase as truth, and operators can round-trip edits back into the
repo. Opaque database content must not replace forkable code.

## 4. Data model

All rows carry non-null `tenant_id`; uniqueness and replay keys are
tenant-composite; child rows use composite foreign keys; new tables register
in `schema-contract.ts` and arrive via additive ordered migrations per the
multi-tenancy contract:

- `sites`, `site_documents` (kind page/post/template, collection key, slug,
  parent, draft and published version pointers, status)
- `site_document_versions` (body, metadata, style guide version, source
  human/AI/import/rollback, command, agent run, parent, checksum)
- `site_collections` (field schema, detail template, index page, SEO rules,
  URL pattern), `site_routes`, `site_navigation`, `site_redirects`
- `site_style_guides` (versioned), `site_templates` plus template versions,
  `site_assets` (Supabase Storage object reference, dimensions, alt text,
  attribution, uploader, tags, focal point, usage)

No tenant may read another tenant's drafts; published content is public by
definition but only through the renderer, never raw table access.

## 5. AI protocol

New `site.*` tools register in `ai-tools.ts` with impact tiers:
`read_page`, `read_style_guide`, `list_components`, `read_component_schema`,
`search_templates`, `propose_patch`, `render_preview`, `publish`, `rollback`.
Generation defaults to template-first (search, then patch) rather than
blank-page synthesis. Every factual public claim must resolve to approved
content, a verified claim, or an explicit user instruction — the same
no-invention rule the static copy guards enforce today, extended to runtime
publishing. Draft work can earn standing permission over time; publishing,
deletion, and domain/analytics/destination changes stay approval-gated through
the existing queue with fresh action types.

## 6. Publish safety

Before any publish: component schema validation, broken-link check, SEO and
metadata validation, accessibility checks, responsive render at 390/768/1440
via the existing Playwright infrastructure, and a public-data safety check
(no private CRM facts leak into public claims). Screenshot evidence is opened
and inspected, following the repository's visual-work rules. Slug changes
write redirects. The current `<Studio />` homepage stays as a fallback until
screenshot parity proves the migration.

## 7. Lean dependency delta

| Need | Decision |
| ---- | -------- |
| Visual editor + public render basis | Puck, admin-only |
| Custom markup safety | One HTML sanitizer, chosen with evaluation record |
| Long-form bodies (posts phase only) | Tiptap core + minimal extensions |
| Everything else (versions, publish, auth, AI, analytics, QA) | Existing Accelerate systems |
| Payload, GrapesJS, Webstudio | Study only; no runtime dependency |
| Storybook | Dev-only, with the future component SDK |
| Sandpack | Dropped from scope |

## 8. Homepage migration order

Infrastructure first with no production rendering change; register existing
home sections as components; import current order as Homepage Version 1; add
props and schemas until content is editable; prove screenshot parity
side-by-side; switch `/` to the renderer with `<Studio />` retained as
fallback; migrate MDX articles preserving URLs, feeds, and sitemap; migrate
remaining static routes; then editor, AI commands, collections, and portable
export. Each step keeps the previous rendering reachable until its parity
proof lands.

## 9. Card index

All cards: initiative `Site Studio`, workstream `site`, milestone Later,
priority high unless noted. Numeric phase is the legacy filter; northstar
alignment is stated per card.

| Key | Title | Phase | Depends on |
| --- | ----- | ----- | ---------- |
| `site-studio-document-schema` | Versioned site document schema and independent renderer | 3 | multi-tenancy contract |
| `site-studio-version-publish` | Draft, version, preview, publish, and rollback substrate | 3 | schema, action executor, multi-tenancy |
| `site-studio-style-guide` | Versioned site style guide with voice and token rules | 3 | schema |
| `site-studio-component-registry` | Semantic component registry with business components | 5 | schema, plugin/module contract |
| `site-studio-puck-editor` | Admin-only Puck editing canvas with preview | 5 | schema, publish, registry, admin shell |
| `site-studio-ai-patches` | Patch-based AI page editing with claim grounding | 5 | schema, registry, bounded context, tool registry |
| `site-studio-collections-posts` | Collections, posts, Tiptap bodies, MDX migration, navigation | 6 | schema, publish, editor |
| `site-studio-assets` | Supabase-backed asset library with accessibility gates | 6 | schema |
| `site-studio-publish-qa` | Pre-publish validation and Playwright visual QA | 6 | publish, editor |
| `site-studio-page-outcomes` | Page goals measured through canonical attribution | 6 | schema, canonical attribution |
| `site-studio-export-import` | Portable site export/import with bundled snapshot | 6 | schema, publish, instance portability |
| `site-studio-homepage-migration` | Migrate the marketing site onto Site Studio | 6 | schema, publish, registry, editor, collections, QA |

## 10. Open risks and founder decisions

- License pinning: re-verify Puck/Tiptap/sanitizer licenses at integration
  time; pin the OSS Puck core rather than any hosted AI product.
- Promotion order: the recommended claim sequence is schema → publish →
  style guide → registry → editor → AI → collections/assets → QA/outcomes →
  export → migration. Promoting cards out of order recreates the coupling
  this design exists to avoid. Now/Next placement stays a founder call; the
  cards deliberately land in Later so nothing jumps the delivery circuit.
- Deferred by design: scheduled publishing, vision-model design critique,
  site-pack marketplace, Sandpack-class browser IDE. Each needs its own card
  if evidence demands it.
- Live-board application still requires founder review: the import plan is
  generated from these templates and applied explicitly; templates never
  overwrite live definitions.
