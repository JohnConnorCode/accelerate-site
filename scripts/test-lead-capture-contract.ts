#!/usr/bin/env tsx
/**
 * Every public route that captures a lead must react to a failed write.
 *
 * The anti-pattern this catches is a one-line `if (dbError) console.error(...)`
 * followed by `return { success: true }`. The visitor is told we have their
 * details, we do not, and nobody finds out. This has already regressed once:
 * the project's own notes recorded "all lead routes hardened" while four of
 * them were still swallowing.
 *
 * Reacting means one of two things, both acceptable:
 *   - refuse the request, so the visitor can retry, or
 *   - complete the visitor's request but escalate to the operator with enough
 *     detail to recover the lead by hand (right when the visitor came for a
 *     download or a generated plan, and failing them would be the worse trade).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LEAD_ROUTES = [
  "src/app/api/send-contact-email/route.ts",
  "src/app/api/subscribe/route.ts",
  "src/app/api/partner-apply/route.ts",
  "src/app/api/resource-download/route.ts",
  "src/app/api/generate-plan/route.ts",
  "src/app/api/qualify/route.ts",
  "src/app/api/chat/route.ts",
];

const REACTS = /status:\s*5\d\d|admin_notifications|recordAudit|throw /;

/**
 * The guard's own body, and only that. An earlier version scanned a fixed
 * window of following lines, which silently passed a bare
 * `if (dbError) console.error(...)` because the route's outer catch block
 * happened to contain a 500 a few lines below. A guard that cannot fail on the
 * bug it targets is worse than no guard.
 */
function guardBody(source: string, guardIndex: number): string {
  const open = source.indexOf("{", guardIndex);
  const lineEnd = source.indexOf("\n", guardIndex);
  // No brace before the end of the line means a single-statement guard.
  if (open === -1 || (lineEnd !== -1 && open > lineEnd)) {
    return source.slice(guardIndex, lineEnd === -1 ? source.length : lineEnd);
  }
  let depth = 1;
  let index = open + 1;
  while (index < source.length && depth > 0) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") depth -= 1;
    index += 1;
  }
  return source.slice(guardIndex, index);
}

const failures: string[] = [];
let guardsChecked = 0;

for (const file of LEAD_ROUTES) {
  const source = readFileSync(file, "utf8");
  const errorVars = new Set<string>();
  for (const match of source.matchAll(/error:\s*([A-Za-z_][A-Za-z0-9_]*)\s*[},]/g)) {
    if (match[1]) errorVars.add(match[1]);
  }
  for (const variable of errorVars) {
    const guard = new RegExp(`if\\s*\\(\\s*${variable}\\s*\\)|if\\s*\\(\\s*${variable}\\.`, "g");
    let match: RegExpExecArray | null;
    while ((match = guard.exec(source))) {
      guardsChecked += 1;
      const body = guardBody(source, match.index);
      if (!REACTS.test(body)) {
        const line = source.slice(0, match.index).split("\n").length;
        failures.push(
          `${file}:${line} guards "${variable}" but only logs. A failed lead write must refuse the request or escalate to the operator.`,
        );
      }
    }
  }
}

assert.ok(
  guardsChecked > 0,
  "found no error guards in the lead routes, so this contract is not actually checking anything",
);

if (failures.length) {
  console.error(`Lead capture contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({ routes: LEAD_ROUTES.length, guardsChecked, result: "passed" }, null, 2),
  );
}
