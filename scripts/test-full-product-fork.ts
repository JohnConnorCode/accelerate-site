import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { distributionProfile } from "../src/lib/distribution/profile";
import { isAgencyAsset, isAgencyPage } from "../src/lib/distribution/routes";
import { createNeutralWebsite } from "../src/lib/site-studio/neutral-website";
import { createBundledWebsite } from "../src/lib/site-studio/website-seed";
import { parseWebsiteDocument } from "../src/lib/site-studio/website-document";
import { assertWebsiteForms, websiteFormTokens } from "../src/lib/site-studio/website-forms";
import { websiteTextFields } from "../src/lib/site-studio/website-authoring";
import { middleware } from "../src/middleware";
import { tenant } from "../src/config/tenant";
import { buildSearchIndex } from "../src/lib/search";

async function main() {
  assert.equal(distributionProfile({}), "neutral");
  assert.equal(distributionProfile({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "branded" }), "branded");
  assert.doesNotMatch(JSON.stringify(tenant), /acceleratewith|John Connor|john-accelerate/i);
  assert.equal(tenant.capabilities.publicBooking, false);
  assert.ok(
    buildSearchIndex().every(
      (entry) =>
        entry.group === "Docs" || entry.href === "/" || entry.href === "/demo/command-center",
    ),
  );
  const document = createNeutralWebsite();
  assert.deepEqual(createBundledWebsite(), document);
  assert.equal(document.pages[0]!.content.kind, "document");
  assert.doesNotMatch(JSON.stringify(document), /acceleratewith|John Connor|\/images\//i);
  for (const path of [
    "/about",
    "/services",
    "/team/john-connor",
    "/learn/example",
    "/work/example",
    "/%61bout",
  ])
    assert.equal(isAgencyPage(path), true, path);
  for (const path of [
    "/admin",
    "/docs",
    "/demo/command-center",
    "/f/token",
    "/api/public/forms/token",
    "/site-assets/photo.jpg",
  ])
    assert.equal(isAgencyPage(path), false, path);
  for (const path of [
    "/images/john.jpg",
    "/work/example/image.webp",
    "/logo.png",
    "/%69mages/john.jpg",
  ])
    assert.equal(isAgencyAsset(path), true, path);
  assert.equal(isAgencyAsset("/site-assets/photo.jpg"), false);
  const root = "http://localhost:3000";
  const about = await middleware(new NextRequest(`${root}/about`));
  assert.equal(new URL(about.headers.get("x-middleware-rewrite")!).pathname, "/site-pages/about");
  assert.equal((await middleware(new NextRequest(`${root}/images/john.jpg`))).status, 404);
  assert.equal(
    (await middleware(new NextRequest(`${root}/_next/image?url=%2Fimages%2Fjohn.jpg&w=640&q=75`)))
      .status,
    404,
  );
  assert.equal(
    (await middleware(new NextRequest(`${root}/docs`))).headers.get("x-middleware-rewrite"),
    null,
  );
  assert.throws(() =>
    parseWebsiteDocument({
      ...document,
      pages: [{ ...document.pages[0], path: "/site-pages/about" }],
    }),
  );
  const token = "a".repeat(64);
  const page = document.pages[0]!;
  assert.equal(page.content.kind, "document");
  if (page.content.kind !== "document") throw new Error("Expected editable homepage");
  page.content.document.root.push({
    id: "inquiry",
    type: "section",
    children: [{ id: "inquiry-form", type: "form", props: { token, heading: "Get in touch" } }],
  });
  parseWebsiteDocument(document);
  assert.deepEqual(websiteFormTokens(document), [token]);
  assert.ok(websiteTextFields(page).every((field) => field.value !== token));
  const form = {
    id: "form",
    tenantId: "owner",
    schema: { elements: [{ name: "email", type: "text" as const }] },
    name: "Contact",
  };
  await assertWebsiteForms(document, "owner", async () => form);
  await assert.rejects(
    assertWebsiteForms(document, "other", async () => form),
    /published form from this workspace/,
  );
  await assert.rejects(
    assertWebsiteForms(document, "owner", async () => null),
    /published form from this workspace/,
  );
  await assert.rejects(
    assertWebsiteForms(document, "owner", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  await assertWebsiteForms(createNeutralWebsite(), "owner", async () => {
    throw new Error("Unused providers must not be contacted");
  });
  console.log(
    "Full-product fork: neutral defaults, shared seed, route/asset isolation, reserved paths, form ownership/unavailability, and protected AI bindings passed.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
