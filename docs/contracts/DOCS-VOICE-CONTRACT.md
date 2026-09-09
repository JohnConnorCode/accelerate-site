# Public docs voice contract

This is the durable source of truth for prose in `src/content/docs/**/*.mdx`.
Read it before writing or reviewing any docs page. It inherits the site's
one-voice system from [`MARKETING-POSITIONING-CONTRACT.md`](./MARKETING-POSITIONING-CONTRACT.md)
and states it as checks, not aspirations, because the unmeasurable version of
this guidance (the older `docs/contributing/DOCUMENTATION-STYLE.md`) let five
separate rewrites drift into two incompatible registers, both wrong.

## The voice

The person who builds and runs these systems, describing what happens, to a
peer who owns a business. Not a systems engineer writing a spec. Not a SaaS
marketer writing a benefit list. If a sentence could not be said out loud by
someone standing next to you at the screen, rewrite it.

## The nine checks

1. **Open on the situation, not the definition.** The first paragraph names a
   real moment in a business before it names a feature or a route. Do not
   open with "X is Y at `/admin/z`."
2. **State what it is worth, once, near the top.** Every page says in plain
   prose what the screen saves the reader or what it prevents. No dollar
   figures, no percentages, no invented statistics.
3. **Write sentences with connective tissue.** Use because, so, once, after,
   which means. Target a mean sentence length of 18-24 words. A page whose
   mean sentence length is under 14 words reads as a list of assertions, not
   an explanation, and fails review.
4. **Gloss jargon in the sentence that introduces it.** A tool id, a route, or
   a status value gets one clause of plain-language explanation the first
   time it appears on the page. Never assume the reader has read another page
   first.
5. **One caveat block per page, at the end, under a `## What to check`
   heading.** Move every "this does not mean," "not proof of," and "confirm
   before" sentence there, and rewrite each as positive instruction: not
   "completing a task does not prove the email sent" but "confirm the receipt
   reads delivered before you tell the customer." A page may carry at most
   one negative-definition sentence outside that block.
6. **Approvals read as graduated autonomy, never as a brake.** Say what
   actually happens in this product: an action starts at `always_ask`, and
   after **3 approvals over at least 7 days** the system proposes moving it
   up a rung, never skipping one, always with a person confirming. Frame
   approval as the mechanism that lets the system take on more work as it
   earns trust, not as a stop placed in front of automation. Never write
   "waits for your yes," "nothing moves without you," "nothing leaves
   without approval," or any variant. That framing is banned outright, not
   just discouraged, per the founder's explicit ruling: approvals exist to
   let automation take on more, not as a leash.
7. **Every page describing an `/admin/*` screen carries a screenshot.** Use
   `DocsFigure` with `width={1440} height={1000}` (the shape every existing
   capture uses; do not rely on the component's smaller defaults). The
   caption identifies what the reader is looking at and says the data is
   fictional. See `scripts/capture-docs-screenshots.mjs` for how the image
   was made and how to remake it.
8. **Tables hold data, not links.** A reference table of fields, defaults, or
   limits is good docs. A table whose only content is `[Page](url) |
description` is a list dressed as a table; write it as prose with inline
   links instead.
9. **Use the components already in the docs MDX map** (`Callout`,
   `StepByStep`/`Step`, `CodeBlock`, `ComparisonTable`, `QuoteBlock`, in
   addition to `DocsFigure`) to break up a long page instead of running six
   paragraphs of grey text. `CTACard` and `ToolRecommendation` remain
   forbidden in docs; the verifier rejects them.

## Standing site rules that apply here too

- No em dashes (`—`). `scripts/test-house-style-copy.ts` enforces this.
- No antithesis ("X is not Y. It is Z.") anywhere. `scripts/test-no-fabricated-claims.ts`
  enforces the rhetorical figure; it deliberately does not flag a plain factual
  negation like "a draft is not a sent message," which is fine writing and
  belongs in a What to check block per rule 5.
- None of the killed vocabulary: leads (use contacts, customers, inquiries),
  ROI as a claim, bottleneck(s), seamless, flawless, rigorous, superlative
  scale claims.
- No link to `/contact` or `/plan-builder` from a docs page. The verifier
  rejects this: a docs page that ends in a booking call reads as marketing,
  not documentation.

## Facts to use instead of guessing

These are real, current product facts. Cite them instead of writing vague
claims like "the system learns over time."

- **Autonomy ladder** (`src/lib/revenue-os/autonomy-policy.ts`):
  `prohibited → always_ask → ask_until_trusted → standing_permission → autonomous`,
  tracked per capability.
- **Trust graduation** (`src/lib/revenue-os/trust-graduation.ts`): after 3
  approvals across at least 7 days of observation, the system proposes moving
  an action up one rung. It never skips a rung; a person confirms every
  promotion.
- **Six hard floors that never move regardless of trust level**: account
  deletion, credential changes, deleting financial history, exporting the
  customer database, high-value refunds, major financial transfers.
- **Reversibility classes** for the 20 action types
  (`src/lib/revenue-os/action-reversibility-contract.ts`): 4 reversible with
  a tested automatic undo, 9 compensable, 7 permanently non-autonomous
  (sending an email, activating a campaign, and sending an invoice are in
  that last group by design, not by accident).
- **47 capabilities in six categories** (`src/content/command-center.ts`),
  each with an authored one-line promise. 8 of the 47 are gated.
- **77 registered AI tools**, of which exactly 3 can act outside the
  workspace: `propose_send_email`, `propose_conversation_reply`,
  `propose_campaign_activation`. Everything else reads or writes internal
  records that still require approval before they take effect externally.
- **The six fictional demo businesses** (`src/lib/admin/demo/scenario-profiles.ts`):
  Northline Roofing & Exteriors (Evan Cole, roofing), Alder Ridge Injury Law,
  Ledgerstone Accounting & Advisory, Hearthline Realty Group, Common Table
  Community Network, SuperDebate Demo. Use one by name in a worked example
  instead of "a fictional studio."
- **Real defaults worth citing verbatim**: the collections reminder cooldown
  is 72 hours, adjustable from 1 to 720. Opportunity Radar sends at most 5
  outreach messages a day with a 168-hour cooldown per contact. A contact
  import takes up to 500 rows. A workflow plugin creates at most 10 tasks per
  approval. All ten bundled plugins ship with `defaultEnabled: false`.

## Mechanical requirements (unchanged from the existing verifier)

- Frontmatter `title` and `description` must match `src/content/docs/manifest.ts`
  exactly, character for character. Every rewritten page is a two-file edit.
- `updated` must be `YYYY-MM-DD` and reflect the actual edit date.
- Every internal `/docs/...` link must resolve to a real manifest route.
  Slugs do not change in this project; there is no redirect layer in this
  repository, so a renamed slug is a hard 404.
- `DocsCapabilityCatalog` and `DocsAiToolCatalog` may each appear on exactly
  one page in the whole tree.
- `public/docs-llms.txt` is generated, not hand-edited. Run `npm run docs:llms`
  after any `.mdx` or `manifest.ts` change and commit the result. Never
  hand-resolve a merge conflict in this file: take either side, then
  regenerate.

## A before/after, for calibration

Before (`src/content/docs/contacts/overview.mdx`, 132 words):

> Contacts at `/admin/contacts` is the identity ledger. Website submissions,
> list imports, chat, and mail all resolve here before they become
> conversations or deals.
>
> **Intake.** New rows can arrive from the public site, from a CSV or pasted
> list, or from a provider sync. Imports go through a review batch. The
> system normalizes and proposes records. Nothing is written until that
> review is accepted.
>
> **Identity.** Canonical IDs win over email joins. Two records that look
> like one person become a merge proposal. The operator decides. Ambiguous
> identity is review work.

After:

> Most businesses carry the same customer three or four times over. Once
> from a website form in March, once because somebody pasted a trade-show
> list into a spreadsheet, once inside a Gmail thread nobody else can see.
> Each copy holds a third of the story, so when that customer calls, whoever
> picks up the phone starts from a third of the story.
>
> Contacts is where a person or a company exists once. Every route that
> brings a new name into the business arrives here first: your website
> forms, the public chat assistant, a list you paste in, and any mailbox you
> have connected. A name is matched against the people you already know
> before it becomes a conversation or a deal.
>
> **What this is worth.** When a customer is one record, everything attached
> to them travels together: the thread from last spring, the proposal they
> never answered, the task your foreman still owes them. Somebody new to the
> account opens one page and is current in a minute, and the system can
> answer questions about that customer because it is reading one history
> instead of four fragments.
>
> ## When two records look like the same person
>
> The workspace shows you both records side by side with the evidence for
> the match, and waits for you. That is deliberate: a merge you did not
> intend quietly destroys history you will need later, while a duplicate
> that sits unmerged for a day costs you thirty seconds. As the matches you
> accept build a pattern, more of them clear on their own, and the ones that
> reach you are the genuinely ambiguous cases.

Same facts. Roughly triple the length. A reader now knows why the screen
exists before it tells them what it does.
