# Command Center organization review

## Delivered

The admin workspace now follows the owner-first organization in the Accelerate Admin App Organization Spec:

| Area | Destinations | Owner job |
| --- | --- | --- |
| Command | Today, Tasks | See attention and complete owned work |
| Sales | Leads, Pipeline, Proposals, Follow-ups | Create and move revenue |
| Customers | Conversations, Clients, Appointments | Serve customer relationships |
| Marketing | Campaigns, Content, Website | Reach customers and improve the site |
| Money | Money, Revenue | Handle cash and understand performance |
| Intelligence | Analytics, Opportunity Radar, Ask Accelerate | Understand and decide |
| System | Integrations, Business & Brand, Settings | Keep the workspace ready |

Today is a cross-functional view over canonical records. Its presentation states are **Do**, **Approve**, **Decide**, and **Consider**. Proposal follow-up, meeting preparation, messages, tasks, and actionable system concerns are Do work. Prepared external or record-changing actions are Approve. Identity questions and other human choices can be Decide. Optional signals remain Consider when a source explicitly marks them as optional. Tasks and approvals keep their own IDs, lifecycle, and receipts; Today does not create a duplicate queue.

The new Tasks page provides one home for assigned work and approvals, while the Money page groups invoice, collection, reporting, and recovery entry points. Follow-ups remains a compatibility route to the existing recovery workflow. Campaigns, Content, Leads, and Feature Board now have contextual tabs that keep related jobs together without multiplying sidebar concepts. The Feature Board header explains its relationship to the Command Center roadmap and links to Today, Tasks, and Ask Accelerate.

The normal rail uses customer language. Ask Accelerate replaces AI Workspace and Ask AI in the admin shell, setup copy, screenshot metadata, command palette checks, and AI workspace checks. Business & Brand replaces Branding; Website replaces Website Grades; Appointments replaces Bookings in user-facing copy. Specialized routes such as Inbox, Contact intake, Email Studio, Email Sequences, Activity, Setup Center, and Feature Board remain reachable under More tools for compatibility and advanced operation.

The public Learn dropdown is restored in the shared desktop and mobile header with Articles & guides and Free downloads. This preserves the earlier topic-oriented navigation while keeping Command Center as the product entry point.

## Documentation

Public Command Center docs now cover the owner-first map, the shared record-to-result loop, Today’s four states, Tasks and approvals, Ask Accelerate, contextual work, and capability availability. The docs manifest and generated `public/docs-llms.txt` are in sync. Existing routes and deep links remain valid; renamed destinations are presentation labels or compatibility links rather than destructive route changes.

## Boundaries

No database migration or production data change is required for this organization pass. Social and recurring subscriptions are not promoted to first-class links because this repository has no verified corresponding workspace surfaces; the adaptive navigation rule keeps unavailable capabilities out of the default rail. Existing campaign, invoice, and client surfaces remain available through their current routes and contextual entry points.

## Verification

- `npm run typecheck`
- `npm run verify:module-contract`
- `npm run verify:module-route-guards`
- `npm run verify:extensions`
- `npm run test:admin-breadcrumbs`
- `npm run test:command-center-demo-contract`
- `npm run test:admin-demo-contract`
- `npm run test:admin-command-palette`
- `npm run test:admin-layout`
- `npm run verify:docs -- --strict`
- `npm run docs:llms:check`
- `CIRCLE_NODE_TOTAL=1 npm run build` — 446 static pages generated successfully
- `npm run qa:admin-demo` — all six fictional businesses, 28 routes, desktop/mobile, themes, deep links, reset, and simulated operations
- `npm run test:navigation-runtime` — navigation contract, persistent profile, public mobile drawer, and reduced motion
- `PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=../../../accelerate-site/.env.local scripts/qa-ai-command-workspace.mjs` — authenticated Ask Accelerate desktop/mobile/dark/reduced-motion checks
- `npm run qa:admin-layout-continuity`
- `npm run qa:admin-mobile-navigation`
- Playwright smoke on the final build — Tasks excludes replies and meetings from completion controls, Money renders, and the `/follow-ups` compatibility link preserves the demo scenario while redirecting to Recovery.

Browser artifacts are in `/tmp/accelerate-full-admin-demo`, `/tmp/accelerate-public-navigation-profile`, `/tmp/accelerate-persistent-profile-qa`, `/tmp/accelerate-ai-command`, `/tmp/accelerate-admin-layout-continuity`, and `/tmp/accelerate-admin-mobile-navigation`.

This is a local candidate only. Merge, deployment, live route checks, and provider reconciliation remain separate release steps.
