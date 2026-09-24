import { verticals } from "../src/content/verticals";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { demoWorkflows } from "../src/content/demo-workflows";
import { productFaqs } from "../src/content/command-center-faq";
import { workflowRecipes } from "../src/content/workflow-recipes";
import { validateDemoContract } from "../src/components/command-center/demo/demo-contract";
import { capabilities, CURRENT_SURFACES } from "../src/content/command-center";

const errors = validateDemoContract();
if (errors.length) throw new Error(`Command Center demo contract failures:\n${errors.join("\n")}`);
if (!capabilities.some((capability) => capability.id === "subscriptions"))
  throw new Error("Command Center capability catalog is missing recurring subscriptions");
if (new Set(CURRENT_SURFACES.map((surface) => surface.n)).size !== CURRENT_SURFACES.length)
  throw new Error("Command Center current surfaces must have unique numbers");

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "rail capability coverage",
        "scenario destinations",
        "integration registry parity",
        "fictional relationship integrity",
      ],
    },
    null,
    2,
  ),
);

// Every industry entry must lead to a complete, actionable guide.
assert.equal(workflowRecipes.length, verticals.length * 2);
assert.equal(new Set(workflowRecipes.map((recipe) => recipe.id)).size, workflowRecipes.length);
const industryCounts = new Map<string, number>();
for (const recipe of workflowRecipes) {
  industryCounts.set(recipe.industry, (industryCounts.get(recipe.industry) ?? 0) + 1);
  const guide = readFileSync(`src/content/docs/recipes/${recipe.id}.mdx`, "utf8");
  for (const section of [
    "Before you start",
    "Complete the workflow",
    "Check the result",
    "Adapt it for your business",
    "What to check",
  ]) {
    assert(guide.includes(`## ${section}`), `${recipe.id}: missing ${section}`);
  }
  assert(guide.includes(`<RecipeIngredients id="${recipe.id}" />`));
  assert(recipe.components.length >= 3, `${recipe.id}: compose multiple capabilities`);
  for (const part of recipe.components) {
    const path = `src/content${part.href}`;
    assert(
      existsSync(`${path}.mdx`) || existsSync(`${path}/overview.mdx`),
      `${recipe.id}: missing ingredient guide ${part.href}`,
    );
  }
}
assert.equal(industryCounts.size, verticals.length);
assert([...industryCounts.values()].every((count) => count === 2));
console.log(
  "Two recipes per registered industry link to complete guides and existing capabilities.",
);

assert.equal(demoWorkflows.length, 3);
assert.equal(productFaqs.length, 7);
assert.equal(
  new Set(workflowRecipes.map((recipe) => recipe.description)).size,
  workflowRecipes.length,
);
for (const workflow of demoWorkflows) {
  assert(existsSync(`public${workflow.image}`), `${workflow.id}: screenshot exists`);
  assert(workflowRecipes.some((recipe) => recipe.id === workflow.recipe));
  assert.equal(workflow.steps.length, 3);
  for (const step of workflow.steps) assert(existsSync(`src/app/admin/${step.route}/page.tsx`));
}
console.log("Three workflow examples link to implemented screens, screenshots and setup recipes.");
