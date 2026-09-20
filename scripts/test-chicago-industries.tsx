import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ChicagoHeadquarters } from "../src/components/sections/ChicagoHeadquarters";
import { verticals } from "../src/content/verticals";
import { workflowRecipes } from "../src/content/workflow-recipes";
import { installationRoutes } from "../src/lib/site-studio/installation-routes";

assert.equal(verticals.length, 20);
assert.equal(workflowRecipes.length, 40);
for (const vertical of verticals) {
  assert.equal(workflowRecipes.filter((recipe) => recipe.industry === vertical.slug).length, 2);
  assert(
    vertical.group && vertical.updatedAt && vertical.workflowExample && vertical.customBoundary,
  );
  const route = installationRoutes.find((item) => item.path === `/industries/${vertical.slug}`);
  assert(route);
  const source = readFileSync(route.source, "utf8");
  assert(
    source.includes("publishedWebsiteOverride") && source.includes("publishedWebsiteMetadata"),
  );
}
const profile = process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE;
try {
  process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE = "neutral";
  assert.equal(renderToStaticMarkup(<ChicagoHeadquarters />), "");
  process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE = "branded";
  const html = renderToStaticMarkup(<ChicagoHeadquarters />);
  assert.match(html, /1 W Monroe Street, Chicago, IL/);
  assert.match(html, /https:\/\/ferrischicago.com\//);
  assert.doesNotMatch(html, /openingHours|walk-in|appointment|606/);
} finally {
  if (profile === undefined) delete process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE;
  else process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE = profile;
}
const layout = readFileSync("src/app/layout.tsx", "utf8");
const organization = layout.slice(layout.indexOf("const organizationJsonLd = identity"));
assert(!organization.slice(0, organization.indexOf("  : {")).includes("chicagoHeadquarters"));
const chicago = readFileSync("src/app/(marketing)/chicago/page.tsx", "utf8");
assert(
  chicago.indexOf("if (published) return published") <
    chicago.indexOf('distributionProfile() === "neutral") notFound()'),
);
console.log(
  "PASS: 20 industries, 40 recipes, search discovery, route ownership and headquarters isolation.",
);

const inclusion = JSON.parse(readFileSync("distribution/inclusion-manifest.json", "utf8"));
assert(inclusion.excludePrefixes.includes("src/app/(marketing)/chicago/"));
const neutralHeadquarters = readFileSync(
  inclusion.replacements["src/components/sections/ChicagoHeadquarters.tsx"],
  "utf8",
);
assert.match(neutralHeadquarters, /return null/);
assert.doesNotMatch(neutralHeadquarters, /Ferris|Monroe|ferrischicago/);
assert(inclusion.includePaths.includes("src/content/workflow-recipes.ts"));
assert(inclusion.includePaths.includes("src/content/demo-workflows.ts"));
