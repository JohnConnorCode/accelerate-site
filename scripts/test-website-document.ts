import assert from "node:assert/strict";
import { websiteFixture } from "./lib/website-fixture";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parseWebsiteDocument, websitePathSchema } from "../src/lib/site-studio/website-document";
import { parseWebsiteCommand } from "../src/lib/site-studio/website-commands";
import { installationRoutes } from "../src/lib/site-studio/installation-routes";
import { isSiteContentHref } from "../src/lib/site-studio/links";

const fixture = websiteFixture;
assert.deepEqual(parseWebsiteDocument(fixture), fixture);
const reject = (value: unknown) => assert.throws(() => parseWebsiteDocument(value));
reject({ ...fixture, assets: [{ id: "invalid", src: "#not-an-image", alt: "Invalid" }] });
const page = fixture.pages[0];
assert.ok(page);
const withBody = (body: unknown) => ({
  ...fixture,
  pages: [{ ...page, content: { kind: "article", body } }],
});
reject({ ...fixture, tenantId: "foreign-tenant" });
reject({ ...fixture, credentials: { key: "not-portable" } });
reject(withBody([{ type: "html", html: "<script />" }]));
reject(
  withBody([{ type: "paragraph", content: [{ text: "Bad link", href: "javascript:alert(1)" }] }]),
);
reject(withBody([{ type: "image", assetId: "missing", alt: "Missing" }]));
reject({ ...fixture, pages: [page, { ...page, id: "duplicate-route" }] });
reject({ ...fixture, pages: [page, { ...page, path: "/other" }] });
reject({
  ...fixture,
  collections: [
    {
      id: "articles",
      title: "Articles",
      entries: [
        {
          id: "one",
          path: "/",
          title: "Article",
          summary: "",
          body: [],
          tags: [],
          metadata: page.metadata,
        },
      ],
    },
  ],
});
reject({
  ...fixture,
  theme: { ...fixture.theme, accent: "red; background:url(https://example.test)" },
});
reject({ ...fixture, identity: { ...fixture.identity, name: "x".repeat(8_000_001) } });
for (const path of [
  "//evil.test",
  "/api/foo",
  "/admin",
  "/t/acme",
  "/auth/callback",
  "/demo/x",
  "/proposal/private-token",
  "/plan/private-token",
  "/plan-builder",
  "/foo?bar",
  "/foo/../bar",
  "/foo/",
  "/%2f%2fevil",
])
  assert.equal(websitePathSchema.safeParse(path).success, false, path);
for (const link of [
  "javascript:alert(1)",
  "data:text/html,bad",
  "//evil.test",
  "/\\evil.test",
  "https://user:secret@example.test",
  " https://example.test",
  "https://example.test/\npath",
])
  assert.equal(isSiteContentHref(link), false, link);
for (const link of ["/", "/contact?from=home#form", "#work", "https://example.test/path"])
  assert.equal(isSiteContentHref(link), true, link);
assert.throws(() =>
  parseWebsiteCommand({
    operation: "publish",
    expectedVersion: 1,
    requestKey: "bad",
    revisionId: "bad",
  }),
);
assert.throws(() =>
  parseWebsiteCommand({
    operation: "unpublish",
    expectedVersion: -1,
    requestKey: "11111111-1111-4111-8111-111111111111",
  }),
);

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pages(join(dir, entry.name))
      : entry.name === "page.tsx"
        ? [join(dir, entry.name)]
        : [],
  );
}
const root = "src/app/(marketing)";
assert.deepEqual(installationRoutes.map((route) => route.source).sort(), pages(root).sort());
for (const route of installationRoutes)
  assert.equal(route.path, "/" + relative(root, route.source).replace(/(?:\/)?page\.tsx$/, ""));
console.log(
  "PASS: complete route inventory, portable snapshot validation, duplicate paths and identities, bounded content, asset references, safe links, application route protection and literal rich text.",
);

assert.equal(
  websitePathSchema.safeParse("/site-preview").success,
  false,
  "Private preview route cannot be published over",
);
