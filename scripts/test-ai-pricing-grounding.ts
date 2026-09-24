#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  APPROVED_SERVICE_PRICES,
  approvedPricingPromptContext,
  assertApprovedPrice,
  assertApprovedPriceComponent,
  assertApprovedPricingRows,
} from "../src/lib/ai/approved-pricing";
import { PLAN_SYSTEM_PROMPT } from "../src/lib/ai/prompts";
import { validateProposal } from "../src/lib/ai/proposal-draft";

assert.ok(APPROVED_SERVICE_PRICES.length > 0, "the approved service catalog must not be empty");
const first = APPROVED_SERVICE_PRICES[0]!;
assert.doesNotThrow(() =>
  assertApprovedPrice({ item: first.name, oneTime: first.oneTime, monthly: first.monthly }),
);
assert.doesNotThrow(() =>
  assertApprovedPricingRows([{ item: first.name, oneTime: first.oneTime, monthly: first.monthly }]),
);
assert.doesNotThrow(() =>
  assertApprovedPriceComponent({ item: first.name, amount: first.oneTime, kind: "oneTime" }),
);
assert.throws(
  () =>
    assertApprovedPrice({ item: first.name, oneTime: first.oneTime + 1, monthly: first.monthly }),
  /not an approved catalog price/i,
);
assert.throws(
  () => assertApprovedPrice({ item: "Invented enterprise bundle", oneTime: 12000, monthly: 1000 }),
  /not an approved catalog price/i,
);
assert.throws(
  () =>
    assertApprovedPriceComponent({ item: first.name, amount: first.oneTime + 1, kind: "oneTime" }),
  /not an approved catalog oneTime amount/i,
);
assert.match(approvedPricingPromptContext(), new RegExp(first.name));
assert.match(PLAN_SYSTEM_PROMPT, /only source permitted for money/i);
assert.match(PLAN_SYSTEM_PROMPT, /Founder scope confirmation required/i);
assert.match(
  readFileSync("src/app/api/generate-plan/route.ts", "utf8"),
  /assertApprovedPricingRows/,
  "the growth plan route must reject model pricing outside the catalog before it reaches a draft",
);
assert.throws(
  () =>
    validateProposal({
      sections: [
        {
          title: "Investment",
          content: null,
          items: null,
          pricing: [{ item: "Invented enterprise bundle", monthly: 1000, oneTime: 12000 }],
        },
      ],
    }),
  /not an approved catalog price/i,
  "proposal drafts must reject model pricing outside the catalog",
);
assert.match(
  readFileSync("src/app/api/admin/proposals/generate/route.ts", "utf8"),
  /validate: validateProposal/,
  "the proposal route must validate drafts against the catalog before they reach the founder",
);

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "typed-catalog",
        "exact-price-match",
        "catalog-component-match",
        "invented-price-rejection",
        "prompt-catalog",
        "scope-required-fallback",
        "route-enforcement",
      ],
    },
    null,
    2,
  ),
);
