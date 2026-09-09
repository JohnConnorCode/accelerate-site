import assert from "node:assert/strict";
import {
  createWebsitePage,
  suggestedWebsitePath,
  applyWebsiteTextEdits,
  websiteTextFields,
} from "../src/lib/site-studio/website-authoring";
import { fictionalWebsite, demoWebsiteSuggestion } from "../src/lib/admin/demo/website-runtime";
import { parseWebsiteDocument } from "../src/lib/site-studio/website-document";
import { DEFAULT_SITE_MODEL, siteModel } from "../src/lib/site-studio/models";
const original = fictionalWebsite("Example Workshop");
const page = createWebsitePage(original, {
  title: "Consulting",
  path: "/consulting",
  starter: "service",
});
const website = parseWebsiteDocument({ ...original, pages: [...original.pages, page] });
assert.equal(original.pages.length, 1, "creation cannot mutate its source");
assert.equal(suggestedWebsitePath(website, "Consulting"), "/consulting-2");
for (const path of ["/", "/admin/test", "/api/page", "//evil.example", "/auth/callback"])
  assert.throws(() => createWebsitePage(website, { title: "Bad", path, starter: "article" }));
const clone = createWebsitePage(website, {
  title: "Consulting copy",
  path: "/copy",
  starter: "service",
  cloneId: page.id,
});
assert.notEqual(clone.id, page.id);
assert.deepEqual(clone.content, page.content);
assert.notEqual(clone.content, page.content);
for (const field of [
  "path",
  "id",
  "__proto__.polluted",
  "content.kind",
  "content.document.root.0.id",
])
  assert.throws(() => applyWebsiteTextEdits(page, [{ field, text: "bad" }]));
const title = websiteTextFields(page).find((field) => field.key === "metadata.title")!;
const edited = applyWebsiteTextEdits(page, [{ field: title.key, text: "Better consulting" }]);
assert.equal(edited.path, page.path);
assert.deepEqual(edited.content, page.content);
assert.equal(page.metadata.title, "Consulting");
assert.throws(() =>
  applyWebsiteTextEdits(page, [
    { field: title.key, text: "One" },
    { field: title.key, text: "Two" },
  ]),
);
assert.equal(DEFAULT_SITE_MODEL, "meta/muse-spark-1.3");
assert.equal(siteModel("nex-agi/nex-n2.5-mini:free").completion, 0);
assert.throws(() => siteModel("unknown/free-model"));
assert.equal(
  demoWebsiteSuggestion({
    page,
    instruction: "Improve this",
    mode: "edit",
    model: DEFAULT_SITE_MODEL,
  }).status,
  200,
);
assert.equal(
  demoWebsiteSuggestion({ page, instruction: "Improve this", mode: "edit", model: "unknown" })
    .status,
  400,
);
console.log(
  "Website authoring: creation, clone isolation, collisions, reserved paths, bounded AI edits and model choice passed.",
);
