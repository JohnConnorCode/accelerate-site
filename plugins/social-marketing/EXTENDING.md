# Extend Social Marketing

Use this guide when adding a source, channel, automation or workspace feature.
The [operator guide](README.md) explains the supported user journey. The
[external-service packaging guide](../../docs/contributing/OPEN-SOURCE-SERVICE-PLUGINS.md)
explains how to reuse the architecture for a different project.

## What runs today

Social Marketing supports LinkedIn company pages, text or one PNG/JPEG image,
three-post source-excerpt preparation, exact human-approved batches, host-owned
schedules and provider receipts. It is an optional bundled module backed by a
separately deployed Postiz service. It is not an arbitrary plugin-code loader.

| Owner      | Source                                              | Responsibility                                                                  |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Module     | `extensions/social-marketing.module.json`           | Enablement, settings, routes, tools, upstream provenance and docs               |
| Domain     | `src/lib/revenue-os/social-marketing.ts`            | Validated drafts, exact previews, proposals and execution                       |
| Provider   | `src/lib/revenue-os/postiz-adapter.ts`              | Fixed HTTPS host, encrypted organization credentials, bounded provider protocol |
| Automation | `src/lib/revenue-os/social-marketing-work.ts`       | Weekly drafts, due dispatch, reconciliation and metrics                         |
| Database   | `migrations/20260912170924-social-marketing.sql`    | Tenant ownership, immutable revisions, atomic approval and one-time attempt     |
| Interface  | `src/components/admin/SocialMarketingWorkspace.tsx` | Shared admin/demo task UI                                                       |
| Media      | `src/lib/revenue-os/media-assets.ts`                | Private immutable image identity and content verification                       |

Paths are relative to the application repository. UI routes, AI tools and cron
handlers call these owners. Neither browser code nor an AI tool receives the
Postiz API key or a general-purpose provider request method.

## Compose with existing features

| Existing feature              | Working composition                                                                                                               | Additional integration work                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace knowledge and Drive | The assistant can use its existing authorized knowledge tools, then pass reviewed title, URL and excerpt into social preparation. | Automatic discovery of new Drive material needs a bounded source selector, permissions check and draft deduplication. No Drive-to-social trigger ships here.                     |
| Site Studio                   | Use the public URL and approved excerpt of a published page as a source.                                                          | A publish-event trigger must resolve the actual published revision and create drafts only; private website drafts must not become public copy implicitly.                        |
| Campaigns and CRM             | A human or assistant can coordinate messaging with the existing campaign context.                                                 | Automatic enrollment, lead capture and revenue attribution are not social-plugin features. Add canonical record links and consent-aware services before claiming those outcomes. |
| Opportunity Radar             | Review an eligible finding and explicitly supply its public source to a draft.                                                    | No automatic discovery-to-publication bridge exists. Any source selection must preserve Radar's evidence and category restrictions.                                              |
| Work engine                   | Weekly draft preparation, due publishing and receipt polling use durable WorkItems today.                                         | Add new work kinds through the same executor, cancellation and tenant-bound scheduler.                                                                                           |
| AI and MCP                    | The same four social tools read, prepare, preview and propose changes.                                                            | New operations need shared domain services and registered tools with correct impact and approval requirements.                                                                   |
| Activity and reporting        | Social changes have operation receipts and audit entries; Results shows publication and provider metrics.                         | Cross-channel dashboards must consume those facts. There is no automatic conversion or ROI attribution.                                                                          |

An assistant can help connect the steps conversationally. That does not establish
an unattended trigger or grant permission to publish private workspace knowledge.
The exact resulting post is public content and needs human review.

## Add an automation

Use `social_prepare_week` as the draft-only example. It uses a tenant/calendar-week
key, deterministic draft IDs and a saved operation receipt. A retry finds the
receipt instead of producing another batch. The configured paragraphs are reused
until an operator updates them; this version does not discover fresh topics.

A new source-triggered draft worker should:

1. Resolve the active tenant and enabled module, then read a bounded authorized
   source revision. Preserve its canonical source ID, URL and supporting excerpt.
2. Use a deduplication key containing tenant, source revision and operation. Store
   the saved result so a retry can return it.
3. Call the shared preview and draft service. Creating a draft grants no authority
   to publish; AI mutations still enter the shared action queue.
4. Surface a useful draft and a truthful receipt. Failures must be visible and
   redact credentials and source content from diagnostics.
5. Prove source changes, duplicate delivery, disablement and cross-tenant refusal.

Do not add a second scheduler inside Postiz. Accelerate sends `now` only when an
approved host schedule is due. A provider timeout is not a retry signal: a
persisted attempt with an uncertain outcome remains reconciliation work.

## Add another social channel

Upstream support alone does not make a channel supported in Command Center.
Add and verify a channel-specific contract for required settings, text limits,
media formats, consent, page/account identity, publication receipts and metrics.
Replace the current explicit `linkedin-page` checks with a reviewed allowlist,
update the preview to expose channel-specific consequences, and ensure the
provider payload is built only inside the adapter.

Update the database receipt URL validation when adding another destination;
it currently requires a LinkedIn URL. Add contract fixtures for every accepted
and refused payload and prove live account isolation. Preserve existing LinkedIn
records and previews across migration. Brand and channel changes invalidate
older approvals. Never expose upstream's unrestricted post endpoint to callers.

Video, personal LinkedIn profiles, comments, direct messages, automatic reposting,
conversion attribution and unattended publishing are outside this release.
Each requires a separate product contract and verification, not a settings toggle.

## Change the Postiz release

Prepare a new isolated release directory. Review the upstream license, changelog,
API shapes and migrations; apply the organization identity patch to the new pin.
Build the exact modified source, retain its source archive, record image digests
and prove backup restoration before changing the running service. Run old-record
and two-organization fixtures, then a controlled approved publication. A green
mocked adapter test is not evidence of upstream API compatibility on a live host.

## Verify a change

Run `test:social-postiz` for provider/credential boundaries and
`test:social-postgres` for durable publication transactions. Run
`node scripts/qa-social-marketing.mjs` under `resources:run` for the real
credential-free desktop/mobile approval journey; it preserves screenshots and
failure state in the system temporary directory. Full CI also checks source
contracts, migration upgrades, lint, types, build and public docs.

Live service health, LinkedIn authorization, two-organization isolation,
backup restoration and two internal weekly batches have their own operational
receipts. Until those exist, keep customer activation off.

### Preserve the service boundary

The deployment applies `identity.patch` and `service-hardening.patch` to an exact
upstream revision. Keep the shared post-mapping media ownership checks when adding
channels. Public upload URLs and public owner registration are denied by Caddy;
LinkedIn image bytes come from the private local volume. A new provider that
requires a publicly fetched image needs an explicit, scoped delivery design and
isolation tests before enabling it. Run `verify-hardening.mjs` against newly
prepared source and the disposable service workflow before recording a new image.
