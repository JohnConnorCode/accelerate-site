# Runtime error handling adoption guard

`npm run verify:runtime-boundaries` also checks empty catch blocks and empty
`.catch` callback blocks under `src/lib/revenue-os`. CI runs the scanner's
behavioral fixtures. Run it alone with
`node scripts/verify-runtime-error-adoption.mjs`.

The exact per-file counts in `scripts/runtime-error-baseline.json` record existing
sites. A new file has no allowance. New sites fail; removing a site requires
lowering its file's count, and deleting the last site requires deleting the entry.
Zero, fractional and padded allowances fail. Do not regenerate or enlarge the
baseline to make new silent failures pass; improve the error path instead.

This is a syntactic adoption check, not proof of logging quality, correct recovery,
Promise types or complete error handling. It detects inline empty blocks, including
comment-only blocks and wrapped arrow/function callbacks. It cannot follow callback
identifiers, judge a nonempty handler or recognize every way to discard an error.
A `.catch` method is checked syntactically even on an object that is not a Promise.
Per-file counts cannot detect moving or replacing one existing site within the same
file. Review semantics separately. No existing exception behavior is changed here.

The pattern follows the SD Command audit: ratchet measurable engineering debt
through shared verification, without copying business-specific runtime policies.
