import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import {
  parseSiteDocument,
  collectAssetIds,
  collectRawUrls,
  SITE_DOCUMENT_SCHEMA_VERSION,
} from "../src/lib/site-studio/document";
import { resolveSectionStyle, resolveContainerStyle } from "../src/lib/site-studio/tokens";
import {
  SITE_ASSET_CATALOG,
  resolveSiteAsset,
  assertCatalogAsset,
  describeCatalogForPrompt,
} from "../src/lib/site-studio/assets";
import { SitePageRenderer } from "../src/lib/site-studio/renderer";
import { servicePageTemplate } from "../src/lib/site-studio/templates";
import {
  FileSiteDraftRepository,
  draftChecksum,
} from "../src/lib/site-studio/store";
import {
  buildPageSystemPrompt,
  buildPageUserPrompt,
  generatePageDocument,
} from "../src/lib/site-studio/generate";
import { AI_JOBS } from "../src/lib/ai/model-registry";

async function main() {
  // Document schema: valid parses, invalid is refused with named errors.
  const template = servicePageTemplate({
    serviceName: "Bookkeeping automation",
    audience: "Home service owners",
    outcome: "The office runs while the crew builds.",
  });
  assert.equal(parseSiteDocument(template).metadata.slug, "bookkeeping-automation");
  assert.throws(() => parseSiteDocument({ ...template, engine: "puck" }), /engine/);
  assert.throws(
    () =>
      parseSiteDocument({
        ...template,
        root: [
          { id: "bad", type: "marquee-3d", props: {}, styles: { background: "surface" } },
        ],
      }),
    /type/,
  );
  assert.throws(
    () =>
      parseSiteDocument({
        ...template,
        root: [
          {
            id: "s1",
            type: "section",
            children: [{ id: "b1", type: "button", props: { label: "Go", href: "javascript:alert(1)" } }],
          },
        ],
      }),
    /Links must be/,
  );
  assert.throws(
    () => parseSiteDocument({ ...template, metadata: { ...template.metadata, slug: "Bad Slug!" } }),
    /Slugs use/,
  );

  // Tokens resolve deterministically; unknown tokens cannot be constructed.
  assert.deepEqual(resolveSectionStyle({ background: "surfaceDark" }), {
    background: "var(--site-surface-dark, #1a1714)",
    color: "var(--site-paper, #faf8f4)",
  });
  const container = resolveContainerStyle({ maxWidth: "narrow" });
  assert.equal(container.maxWidth, "44rem");
  assert.equal(container.margin, "0 auto");

  // Asset catalog: every entry carries src plus alt, ids resolve, unknown refused.
  assert.ok(SITE_ASSET_CATALOG.length >= 10, "catalog covers the verticals");
  for (const asset of SITE_ASSET_CATALOG) {
    assert.ok(asset.src.startsWith("/images/"), `catalog src is local: ${asset.id}`);
    assert.ok(asset.alt.length > 0, `catalog alt recorded: ${asset.id}`);
  }
  const first = SITE_ASSET_CATALOG[0]!;
  assert.equal(resolveSiteAsset(first.id)?.src, first.src);
  assert.equal(resolveSiteAsset("nope/missing"), null);
  assert.throws(() => assertCatalogAsset("nope/missing"), /catalog id/);
  assert.ok(describeCatalogForPrompt().includes(first.id));

  // Renderer: validated documents compose registered output with copy,
  // images, and CTAs. Element trees are asserted directly so the suite runs
  // under the same server conditions as every other domain test.
  const textsOf = (node: ReactNode, into: string[] = []): string[] => {
    if (typeof node === "string") into.push(node);
    else if (Array.isArray(node)) for (const child of node) textsOf(child, into);
    else if (node && typeof node === "object") {
      const element = node as ReactElement<{ children?: ReactNode }>;
      textsOf(element.props?.children, into);
    }
    return into;
  };
  const findAll = (
    node: ReactNode,
    predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
    into: Array<ReactElement<Record<string, unknown>>> = [],
  ): Array<ReactElement<Record<string, unknown>>> => {
    if (Array.isArray(node)) {
      for (const child of node) findAll(child, predicate, into);
      return into;
    }
    if (node && typeof node === "object") {
      const element = node as ReactElement<Record<string, unknown>>;
      if (typeof element.type === "string" && predicate(element)) into.push(element);
      findAll(element.props?.children as ReactNode, predicate, into);
    }
    return into;
  };
  const page = SitePageRenderer({ document: template });
  const copy = textsOf(page).join(" ");
  assert.ok(copy.includes("Bookkeeping automation"));
  const images = findAll(page, (element) => element.type === "img");
  assert.ok(images.length > 0, "hero image resolves to a catalog img element");
  assert.equal(images[0]!.props.src, first.src);
  assert.equal(images[0]!.props.alt, first.alt);
  const links = findAll(page, (element) => element.type === "a");
  assert.ok(links.some((link) => link.props.href === "/contact"), "CTA href renders");
  const sections = findAll(
    page,
    (element) => element.props["data-site-section"] === "hero",
  );
  assert.equal(sections.length, 1, "sections carry stable ids");
  const assetIds = collectAssetIds(template);
  assert.ok(assetIds.length > 0 && assetIds.every((id) => resolveSiteAsset(id)));
  assert.deepEqual(collectRawUrls(template), [], "no invented links in template copy");

  // Unknown assets degrade to an honest fallback, never a broken image.
  const broken = servicePageTemplate({
    serviceName: "X",
    audience: "Y",
    outcome: "Z",
  });
  assert.ok(broken.root[0]?.type === "section" && broken.root[0].children[0]?.type === "hero");
  const heroProps = (broken.root[0].children[0] as { props: Record<string, unknown> }).props;
  heroProps.assetId = "invented/missing";
  const brokenPage = SitePageRenderer({ document: broken });
  const fallbacks = findAll(
    brokenPage,
    (element) => element.props["data-site-fallback"] === "unknown-asset",
  );
  assert.ok(fallbacks.length > 0, "unknown asset renders an honest fallback");
  assert.equal(
    findAll(brokenPage, (element) => element.type === "img").length,
    0,
    "no broken img element is emitted",
  );

  // Store round-trips drafts with checksums and stable slug identity.
  const dir = mkdtempSync(join(tmpdir(), "site-studio-"));
  const store = new FileSiteDraftRepository(dir);
  const saved = store.save({
    title: "Bookkeeping automation",
    slug: "bookkeeping-automation",
    document: template,
    source: "template",
    brief: "v1 fixture",
  });
  assert.equal(saved.status, "draft");
  assert.equal(saved.checksum, draftChecksum(template));
  assert.equal(store.get(saved.id)?.slug, "bookkeeping-automation");
  assert.equal(store.get("not-a-real-id"), null);
  assert.equal(store.get("../escape"), null);
  const resaved = store.save({
    title: "Bookkeeping automation",
    slug: "bookkeeping-automation",
    document: template,
    source: "ai",
  });
  assert.equal(resaved.id, saved.id, "slug reuse keeps one draft identity");
  assert.equal(store.list().length, 1);

  // Generation contract: prompts carry rules plus catalog; output validates.
  const system = buildPageSystemPrompt();
  assert.ok(system.includes(first.id), "prompt exposes catalog ids");
  assert.ok(system.includes("Never invent prices"), "prompt carries grounding rules");
  const user = buildPageUserPrompt({
    serviceName: "Bookkeeping automation",
    audience: "Owners",
    outcome: "Evenings back.",
  });
  assert.ok(user.includes("Bookkeeping automation"));
  const validBody = {
    title: "Bookkeeping automation",
    slug: "bookkeeping-automation",
    description: "Shop-floor numbers without the evening paperwork.",
    root: [
      {
        id: "hero",
        type: "section",
        children: [
          {
            id: "hero-main",
            type: "hero",
            props: {
              variant: "split",
              heading: "Bookkeeping automation",
              body: "Evenings back.",
              primaryCta: { label: "Talk to us", href: "/contact" },
              assetId: first.id,
            },
          },
        ],
      },
    ],
  };
  const generated = await generatePageDocument(
    { serviceName: "Bookkeeping automation", audience: "Owners", outcome: "Evenings back." },
    async () => validBody,
  );
  assert.equal(generated.metadata.slug, "bookkeeping-automation");
  assert.equal(generated.schemaVersion, SITE_DOCUMENT_SCHEMA_VERSION);
  await assert.rejects(
    generatePageDocument(
      { serviceName: "X", audience: "Y", outcome: "Z" },
      async () => ({
        ...validBody,
        root: [
          {
            id: "hero",
            type: "section",
            children: [
              {
                id: "copy",
                type: "text",
                props: { text: "See more at https://invented.example/deal" },
              },
            ],
          },
        ],
      }),
    ),
    /invents links/,
  );
  await assert.rejects(
    generatePageDocument(
      { serviceName: "X", audience: "Y", outcome: "Z" },
      async () => ({
        ...validBody,
        root: [
          {
            id: "hero",
            type: "section",
            children: [
              { id: "copy", type: "text", props: { text: "Save $5,000 a month, guaranteed." } },
            ],
          },
        ],
      }),
    ),
    /invents a metric/,
  );
  await assert.rejects(
    generatePageDocument(
      { serviceName: "X", audience: "Y", outcome: "Z" },
      async () => {
        throw new Error("provider down");
      },
    ),
    /failed before validation/,
  );

  // Gateway registration for the repository adapter.
  const job = AI_JOBS.find((entry) => entry.key === "site-page-draft");
  assert.ok(job, "site-page-draft job is registered");
  assert.equal(job.consequential, false);
  assert.equal(job.requiresJson, true);

  console.log(
    "Site Studio v1: schema, tokens, catalog, renderer, store, template, generation contract, and job registration passed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
