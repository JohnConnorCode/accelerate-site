# Social Marketing

Prepare LinkedIn company-page posts from reviewed source material, approve the
exact content and time, and inspect provider-backed publication results. This
optional plugin starts disabled. Its Postiz service runs separately; enabling
the module does not provision hosting or connect a LinkedIn account.

## Publish a reviewed post

1. Follow the [deployment guide](deployment/README.md). Enable **Social Marketing**
   in **Plugins**, then open **Social Marketing → Setup**. Connect the API key for
   this workspace's own Postiz organization. Complete LinkedIn consent in Postiz.
2. Set brand guidance and time zone in plugin settings. In **Drafts**, choose
   **New draft**. Select a company page, enter the post and publication time, and
   attach the title, HTTPS URL and excerpt supporting its claims. Optionally
   upload one PNG or JPEG up to 3 MB. The image remains private until dispatch.
3. Save the draft. Saving a change invalidates earlier publication approval.
   Select one or more posts and choose **Review selected**. Check every word,
   image, company page, time and time zone, then approve the exact changes.
4. **Calendar** shows the retained schedule. The existing work-engine cron wakes
   the durable work item when due. A late wake-up beyond ten minutes requires
   a new schedule and approval. Dispatch checks configuration, connection and
   approver membership; it creates one durable publication attempt before Postiz.
5. **Results** distinguishes an accepted submission from a verified publication.
   Only a provider result with the LinkedIn URL is shown as published. Available
   provider metrics are collected daily; unavailable data is not shown as zero.

For a fictional example, Northline Roofing supplies three factual maintenance
paragraphs and its own source URL. **Prepare three-post week** creates three
editable excerpt posts spaced two days apart. Enable **Prepare weekly drafts** and supply the weekly page ID, source title, URL
and three paragraphs in plugin settings to prepare one batch automatically each
calendar week. Update those paragraphs regularly. This deterministic preparation does
not spend model credits or invent claims. Confirm times around daylight-saving
changes. The AI tools can also draft in context using existing workspace knowledge;
all changes still pass through preview, proposal and human approval.

## Settings and automation

Open **Setup → Edit plugin settings** to use the shared Integrations settings form.

| Setting                     | Purpose and default                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand guidance              | Audience, voice and claims for editorial review and assistant context. Empty initially; it is not an automatic content-policy validator.                                         |
| Time zone                   | IANA zone for the automatic weekly boundary; defaults to `America/Chicago`. Each draft stores its own zone and exact instant. The manual editor labels the browser's local zone. |
| Prepare weekly drafts       | Off initially. When on, prepares one three-post batch per calendar week, starting two days after the worker runs.                                                                |
| Weekly LinkedIn page ID     | Copy the page ID from Setup. Required for recurring preparation.                                                                                                                 |
| Weekly source title and URL | Identify the reviewed public source. The URL must use HTTPS.                                                                                                                     |
| Weekly source paragraphs    | Three reviewed paragraphs separated by blank lines. Reused until updated; no automatic fresh-topic discovery.                                                                    |

Try these requests through the assistant or an authorized MCP client:

- “Inspect Social Marketing and tell me which company pages are available.”
- “Prepare three editable posts from these three approved paragraphs, with this
  source URL, starting on this date in America/Chicago. Do not schedule them yet.”
- “Preview scheduling these draft IDs and revisions. Show the exact text, image,
  page and time, then propose the batch for my review.”
- “Show unresolved publication attempts and explain which have verified URLs.”

Source preparation returns drafts; saving them through AI is a proposed change.
A manual **Prepare three-post week** action saves drafts directly. Neither
preparation path authorizes publication. Keep the work-engine cron active and
inspect Work for failures if a weekly batch does not appear. After correcting
a failed weekly setup, use **Prepare three-post week** to create the missing
batch; the weekly deduplication key prevents repeated automatic batches.

## Permissions, costs and recovery

UI, AI and MCP share `get_social_workspace`, `prepare_social_week`,
`preview_social_change` and `propose_social_change` with the existing approval
queue and domain service. API keys are tenant-bound encrypted provider credentials,
never public module settings. Secure credential entry and image upload are human
handoffs. Source excerpts, published copy and approved images leave the workspace
only as part of the reviewed public post. Hosting, LinkedIn/provider access and
ordinary AI chat may incur costs; there is no unlimited free publishing promise.

Cancel a schedule before dispatch. After dispatch, inspect Postiz and the saved
attempt; an unknown outcome is never automatically resubmitted. In Results, enter the exact
Postiz post ID and review the matched page, text and provider history to associate
its receipt without another send. Editing, rotating
credentials or changing workspace configuration requires renewed review. Disable
stops new drafts and submissions while `/admin/social/history` retains authorized
history and receipt reconciliation. Re-enabling does not automatically approve
missed schedules. Disconnecting credentials also stops provider reads until the
connection is restored. Failed posts require a newly reviewed draft rather than
an untracked resend.

The full admin demo uses these same screens with fictional, session-local data;
no real social account is contacted. A demo result, passing build or source bundle
does not establish production readiness. The live host, two-tenant isolation,
backup restoration, approved LinkedIn publication and two weekly pilot batches
require recorded integration and observation evidence before customer launch.

The hardened service deployment keeps Postiz upload URLs off the public proxy and
refuses public owner registration. Use native Social Marketing for draft previews;
the upstream media gallery cannot display its public upload URLs. Operators can
run the [disposable service verification](deployment/README.md#run-the-disposable-service-verification)
to collect startup and recovery evidence before configuring a real account.

## Extend this pattern

The manifest's optional `upstream` block records repository, license, exact commit,
connector, deployment guide and optionally the released image digest. Existing
manifests remain valid. Treat each new open-source service as a separate reviewed
connector deployment; do not download or execute arbitrary repositories inside
Accelerate. Copy the declarative pattern, register narrow tools and keep tenancy,
approvals, work items and receipts in the host runtime. See
[Extending Accelerate](../../docs/contributing/EXTENDING.md), the
[AI/admin contract](../../docs/contracts/ADMIN-AI-PARITY.md), `postiz-adapter.ts`,
`social-marketing.ts`, `social-marketing-work.ts` and the additive migration.

Read [Extend Social Marketing](EXTENDING.md) for the concrete service map,
working cross-feature compositions, source-triggered automation design, adding
channels and upgrade verification. Read the [open-source service packaging
guide](../../docs/contributing/OPEN-SOURCE-SERVICE-PLUGINS.md) before integrating
the next upstream project.
