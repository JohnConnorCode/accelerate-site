# Write documentation people can use

For public docs prose (`src/content/docs/**/*.mdx`), read
[`docs/contracts/DOCS-VOICE-CONTRACT.md`](../contracts/DOCS-VOICE-CONTRACT.md)
first. It states the voice as nine checkable rules with a before/after
example, replacing the general guidance below wherever the two disagree.

A guide should help its reader complete a task, interpret a result or recover
from a failure. Open with that purpose and the screen or command to use.

## Write the guide from the current implementation

Read the route, service and controls before describing behavior. Distinguish a
working feature from a planned capability. Record the inspected files and commit
in the review evidence. If the interface has a limitation, explain its practical
effect where the reader will encounter it.

Use the names shown in the interface. Explain technical terms when they affect a
decision; put implementation details in developer references. A download list
is a download list. Do not call it a resource library if it cannot manage assets.

## Give the reader a complete task

Include the starting location, required access or inputs, ordered actions, the
expected saved result and recovery for a likely failure. Use an example when it
removes ambiguity. Link to the next relevant guide instead of repeating its
instructions.

Reference pages can use tables or generated catalogs. Explain what the entries
mean and how to check availability. Overview pages should help readers choose a
task; they do not need to repeat every feature description.

## Use direct language

Prefer “Open Revenue and check the client status” to “Unlock financial clarity.”
Prefer “Record an owner and due date” to “Keep things moving.” Avoid slogans,
sales pitches, repeated cautionary contrasts and descriptions that only rename
the heading. State the action and its effect in complete sentences.

Do not use a word count or required heading count as a substitute for usefulness.
A short reference can be complete; a long guide can still omit the first step.

## Review before submitting

1. Follow the task against the current UI or executable command. Check labels,
   required inputs, success and failure states. Record what was actually tested.
2. Check numbers and data-source claims against the service. Never equate a
   client agreement, accepted proposal, invoice and collected payment.
3. Keep the docs manifest title/description aligned with the page, regenerate
   `npm run docs:llms`, and run `npm run verify:docs` and `npm run docs:llms:check`.
4. Compile changed MDX. Use browser QA when layout, components, navigation or
   interaction changes; inspect desktop and mobile rendering for those changes.
5. Give the reviewer the task, changed pages, source checks and any verification
   limitation. A content checker proves structure, not factual correctness.

## Explain why the product is worth learning

Public entry pages should connect the product's promise to a visible workflow:
an open-source AI command center, shared business context, an owned deployment
and database, and capabilities the reader can extend. Explain what the reader can
accomplish before detailing implementation restrictions. Use connected paragraphs
and concrete examples; a sequence of short commands is not a product introduction.

Show real interface screenshots using fictional data. Captions should identify
what the reader is seeing and whether actions are simulated. Include useful alt
text and a full-size view. Pair a screenshot with an explanation of what to notice;
do not rely on small UI text to carry the guide on mobile.

Every bundled plugin example needs a dedicated public subpage, linked from the
plugin index and its manifest. Explain both the first useful task and the pattern
a developer or coding assistant can adapt. Distinguish a registration scaffold,
a read-only report, an approved workflow and a dedicated business workspace.
Keep existing operator and source references accessible.

Describe extensibility confidently and accurately. Owning the source lets a team
build more capabilities; it does not mean every provider is already supported,
that AI can execute arbitrary actions, or that a planned worker is running.
Put practical limits where they affect the workflow, alongside the next useful
step. Keep product documentation distinct from the broader agency offer.
