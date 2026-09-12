import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SocialCard } from "../src/components/social/SocialCard";
import { DocsFigure } from "../src/components/docs/DocsFigure";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tenant, fromEmail } from "../src/config/tenant";
import { distributionProfile } from "../src/lib/distribution/profile";
import { SYSTEM_PROMPT } from "../src/lib/chat/system-prompt";
import { emailWrapper } from "../src/lib/email/templates";
import { generatePlanHTML } from "../src/lib/plan-document";
import {
  nativeTemplateDefaults,
  nativeTemplateSchemas,
} from "../src/lib/site-studio/native-templates";
import type { DigitalGrowthPlan } from "../src/lib/types";
assert.equal(
  tenant.brand.name,
  "Harbor Operations",
  "Run this check inside the actual exported starter",
);
assert.equal(
  distributionProfile({}),
  "neutral",
  "A fresh clone stays neutral without ignored environment files",
);
const metric = {
  estimatedLeadIncrease: "Not estimated",
  estimatedTimeSaved: "Not estimated",
  estimatedRevenueImpact: "Not estimated",
};
const plan: DigitalGrowthPlan = {
  executiveSummary: "Fictional fixture only.",
  recommendations: [],
  implementationRoadmap: [],
  roiProjection: { ninetyDay: metric, twelveMonth: metric, disclaimer: "No promise of results." },
  investmentSummary: {
    oneTimeCosts: [],
    monthlyCosts: [],
    totalOneTime: 0,
    totalMonthly: 0,
    budgetNotes: "No purchase.",
  },
  nextSteps: [],
};
const html = generatePlanHTML(plan, "Sample Customer", "Sample Person");
const social = renderToStaticMarkup(
  createElement(SocialCard, {
    title: tenant.brand.name,
    eyebrow: tenant.brand.name,
    businessName: tenant.brand.name,
    businessDomain: tenant.brand.domain,
    businessTagline: tenant.brand.tagline,
  }),
);
for (const rendered of [
  html,
  social,
  emailWrapper("Fixture content"),
  SYSTEM_PROMPT,
  fromEmail(),
]) {
  assert.match(rendered, /Harbor Operations/);
  assert.doesNotMatch(rendered, /Accelerate|acceleratewith\.us|John Connor|john@/i);
}
for (const [key, value] of Object.entries(nativeTemplateDefaults))
  nativeTemplateSchemas[key]!.parse(value);
for (const path of [
  "public/images/john.jpg",
  "public/work",
  "public/resources",
  "deployment-target.json",
  "src/content/articles",
  "src/app/(marketing)/team",
  "src/app/(marketing)/work",
])
  assert.equal(existsSync(path), false, path);
assert.doesNotMatch(readFileSync("src/content/team.ts", "utf8"), /John Connor|linkedin\.com/);
assert.equal(
  DocsFigure({
    src: "/images/docs/workspace/setup.png",
    alt: "Original screenshot",
    caption: "Original screenshot",
  }),
  null,
);
const setupTemplate = readFileSync(".env.example", "utf8");
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_HOST",
  "ADMIN_EMAIL",
  "BOOTSTRAP_FOUNDER_EMAIL",
])
  assert.ok(setupTemplate.includes(`${key}=`), key);
assert.match(setupTemplate, /^SUPABASE_SERVICE_ROLE_KEY=$/m);
assert.match(setupTemplate, /^OPENROUTER_API_KEY=$/m);
const hosting = JSON.parse(readFileSync("vercel.json", "utf8"));
assert.equal(hosting.git.deploymentEnabled, false);
assert.deepEqual(hosting.crons, []);
assert.equal(existsSync(".github/workflows/ci.yml"), false);
assert.equal(tenant.capabilities.publicBooking, false);
assert.equal(tenant.booking.schedulerUrl, null);
console.log(
  "PASS: actual artifact AI prompt, email and document render configured identity; sample content validates; protected media/content and hosting target absent; scheduler remains disabled.",
);
