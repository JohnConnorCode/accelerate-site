# Write documentation people can use

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
