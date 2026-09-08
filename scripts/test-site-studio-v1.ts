import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactElement, ReactNode } from "react";
import {
  parseSiteDocument,
  collectAssetIds,
  collectRawUrls,
  SITE_DOCUMENT_SCHEMA_VERSION,
  type SiteDocument,
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
import {
  createSiteDraft,
  discardSiteDraft,
  DraftNotFoundError,
  MAX_ATTACHED_ASSETS,
  SlugInUseError,
} from "../src/lib/site-studio/drafts";
import {
  StaleDraftError,
  reviseSiteDraft,
} from "../src/lib/site-studio/revision";
import {
  buildSectionSystemPrompt,
  buildSectionUserPrompt,
  regenerateSection,
} from "../src/lib/site-studio/regenerate";
import { assertDocumentSize, MAX_SITE_DOCUMENT_BYTES } from "../src/lib/site-studio/document";
import { siteSlugSchema } from "../src/lib/site-studio/document";
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

  // Draft service: creation rules live in the domain, not the route.
  const serviceDir = mkdtempSync(join(tmpdir(), "site-studio-service-"));
  const serviceStore = new FileSiteDraftRepository(serviceDir);
  const brief = {
    serviceName: "Bookkeeping automation",
    audience: "Owners",
    outcome: "Evenings back.",
  };
  const noGenerator = async () => {
    throw new Error("generator must not run in template mode");
  };
  const created = await createSiteDraft(
    serviceStore,
    { brief, mode: "template" },
    noGenerator,
  );
  assert.equal(created.slug, "bookkeeping-automation");
  assert.equal(created.source, "template");
  assert.ok(
    (created.brief ?? "").includes("Bookkeeping automation"),
    "brief is recorded for review",
  );
  await assert.rejects(
    createSiteDraft(serviceStore, { brief, mode: "template" }, noGenerator),
    (error: unknown) =>
      error instanceof SlugInUseError && /choose another slug/.test(error.message),
    "duplicate slugs are refused with recovery guidance",
  );
  assert.throws(() => siteSlugSchema.parse("Bad Slug!"), /Slugs use/);
  await assert.rejects(
    createSiteDraft(serviceStore, { brief, mode: "template", slug: "nope--bad" }, noGenerator),
    /Slugs use/,
    "the service enforces slug shape even for direct callers",
  );

  // Explicit title, slug, and attached gallery.
  const galleryAsset = SITE_ASSET_CATALOG[1]!;
  const withGallery = await createSiteDraft(
    serviceStore,
    {
      title: "Custom title",
      slug: "custom-slug",
      brief,
      mode: "template",
      assetIds: [first.id, galleryAsset.id],
    },
    noGenerator,
  );
  assert.equal(withGallery.title, "Custom title");
  const gallerySection = withGallery.document.root.find(
    (section) => section.id === "attached-images",
  );
  assert.ok(gallerySection, "attached images land in their own section");
  assert.equal(gallerySection.children.length, 2);
  assert.ok(
    gallerySection.children.every(
      (child) => child.type === "image" && resolveSiteAsset(child.props.assetId),
    ),
    "every attached image resolves to the catalog",
  );
  await assert.rejects(
    createSiteDraft(
      serviceStore,
      { brief, mode: "template", slug: "bad-asset", assetIds: ["invented/missing"] },
      noGenerator,
    ),
    /catalog id/,
    "non-catalog images are refused before anything saves",
  );
  assert.equal(
    serviceStore.list().filter((draft) => draft.slug === "bad-asset").length,
    0,
    "refused creates leave no partial draft",
  );

  // AI mode uses the injected generator; failures propagate untouched.
  const aiMade = await createSiteDraft(
    serviceStore,
    { brief, mode: "ai", slug: "ai-page" },
    async () => template,
  );
  assert.equal(aiMade.source, "ai");
  assert.equal(aiMade.document.metadata.slug, "ai-page");
  await assert.rejects(
    createSiteDraft(
      serviceStore,
      { brief, mode: "ai", slug: "ai-broken" },
      // Deliberately runtime-invalid output; the cast models a misbehaving
      // generator that type-checking cannot catch for us.
      async () => ({ ...validBody, root: [] }) as unknown as SiteDocument,
    ),
    /"root"/,
    "invalid generator output fails validation before save",
  );
  await assert.rejects(
    createSiteDraft(serviceStore, { brief, mode: "ai", slug: "ai-down" }, async () => {
      throw new Error("AI generation is not configured for this workspace.");
    }),
    /not configured/,
    "provider failures propagate with the setup message intact",
  );

  // Direction flows into the recorded brief; the gallery bound holds for
  // direct callers; corrupt store files never break listing.
  const directed = await createSiteDraft(
    serviceStore,
    {
      brief: { ...brief, extra: "Keep three sections" },
      mode: "template",
      slug: "directed-page",
    },
    noGenerator,
  );
  assert.ok(
    (directed.brief ?? "").includes("Keep three sections"),
    "additional direction reaches the recorded brief",
  );
  await assert.rejects(
    createSiteDraft(
      serviceStore,
      {
        brief,
        mode: "template",
        slug: "too-many-images",
        assetIds: Array.from({ length: MAX_ATTACHED_ASSETS + 1 }, () => first.id),
      },
      noGenerator,
    ),
    /at most 8 images/,
    "the gallery bound holds for direct callers too",
  );
  writeFileSync(join(serviceDir, "corrupt.json"), "not json{{{");
  writeFileSync(join(serviceDir, "notes.txt"), "ignored");
  assert.ok(
    serviceStore.list().every((draft) => draft.slug !== "corrupt"),
    "corrupt and non-draft files never break listing",
  );
  assert.equal(serviceStore.get("corrupt"), null);

  // Revision: typed patches against stable ids, validated server-side.
  const revisable = await createSiteDraft(
    serviceStore,
    { brief, mode: "template", slug: "revisable-page" },
    noGenerator,
  );
  const heroId = "hero-main";
  const revised = await reviseSiteDraft(serviceStore, revisable.id, {
    patches: [
      { op: "setProp", nodeId: heroId, path: "heading", value: "Evenings, returned." },
      { op: "setStyle", nodeId: "hero", path: "background", value: "surfaceDark" },
    ],
    expectedChecksum: revisable.checksum,
  });
  assert.notEqual(revised.checksum, revisable.checksum, "accepted patches refresh the checksum");
  assert.equal(
    (revised.document.root[0]?.children.find((node) => node.id === heroId) as { props: { heading: string } })
      .props.heading,
    "Evenings, returned.",
  );
  assert.equal(revised.document.root[0]?.styles?.background, "surfaceDark");
  await assert.rejects(
    reviseSiteDraft(serviceStore, revisable.id, {
      patches: [{ op: "setProp", nodeId: heroId, path: "heading", value: "Stale attempt" }],
      expectedChecksum: revisable.checksum,
    }),
    (error: unknown) => error instanceof StaleDraftError,
    "stale checksums refuse instead of overwriting newer work",
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, "00000000-0000-4000-8000-000000000000", {
      patches: [{ op: "setProp", nodeId: heroId, path: "heading", value: "X" }],
    }),
    (error: unknown) => error instanceof DraftNotFoundError,
    "unknown drafts fail honestly",
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, revised.id, {
      patches: [{ op: "setProp", nodeId: "no-such-node", path: "heading", value: "X" }],
    }),
    /Unknown node/,
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, revised.id, {
      patches: [{ op: "setProp", nodeId: heroId, path: "inventedProp", value: "X" }],
    }),
    /has no prop/,
    "patches cannot invent props",
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, revised.id, {
      patches: [{ op: "setStyle", nodeId: heroId, path: "fontFamily", value: "Comic Sans" }],
    }),
    /Unknown style token/,
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, revised.id, {
      patches: [{ op: "setProp", nodeId: heroId, path: "heading", value: "See https://invented.example/x" }],
    }),
    /invents links/,
    "human revisions get structural validation, including link honesty",
  );
  const moved = await reviseSiteDraft(serviceStore, revised.id, {
    patches: [
      {
        op: "insert",
        parentId: "what-you-get",
        node: { id: "extra-note", type: "text", props: { text: "Inserted note." } },
      },
    ],
  });
  assert.ok(
    moved.document.root.some((section) =>
      section.children.some((node) => node.id === "extra-note"),
    ),
    "inserted nodes land in the named section",
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, moved.id, {
      patches: [
        {
          op: "insert",
          parentId: "what-you-get",
          node: { id: "extra-note", type: "text", props: { text: "Duplicate." } },
        },
      ],
    }),
    /already in use/,
    "node ids stay unambiguous",
  );
  const replaced = await reviseSiteDraft(serviceStore, moved.id, {
    patches: [
      {
        op: "replace",
        nodeId: "extra-note",
        node: { id: "extra-note", type: "text", props: { text: "Replaced note." } },
      },
    ],
  });
  await assert.rejects(
    reviseSiteDraft(serviceStore, replaced.id, {
      patches: [
        {
          op: "replace",
          nodeId: "extra-note",
          node: { id: "different-id", type: "text", props: { text: "Sneaky." } },
        },
      ],
    }),
    /stable addresses/,
    "replacement keeps the original node id",
  );
  const renamed = await reviseSiteDraft(serviceStore, replaced.id, {
    patches: [{ op: "updateMetadata", title: "New title", slug: "renamed-page" }],
  });
  assert.equal(renamed.title, "New title");
  assert.equal(renamed.slug, "renamed-page");
  assert.equal(
    serviceStore.list().filter((draft) => draft.slug === "revisable-page").length,
    0,
    "a slug change leaves no orphan behind",
  );
  await assert.rejects(
    reviseSiteDraft(serviceStore, renamed.id, {
      patches: [{ op: "updateMetadata", slug: "custom-slug" }],
    }),
    (error: unknown) => error instanceof SlugInUseError,
    "metadata slug changes respect slug ownership",
  );
  const pruned = await reviseSiteDraft(serviceStore, renamed.id, {
    patches: [{ op: "remove", nodeId: "extra-note" }, { op: "move", nodeId: "questions", toIndex: 0 }],
  });
  assert.ok(
    !pruned.document.root.some((section) =>
      section.children.some((node) => node.id === "extra-note"),
    ) && pruned.document.root[0]?.id === "questions",
    "remove deletes and move reorders",
  );

  // Discard removes exactly one draft with a receipt summary behind.
  const doomed = await createSiteDraft(
    serviceStore,
    { brief, mode: "template", slug: "doomed-page" },
    noGenerator,
  );
  const receipt = await discardSiteDraft(serviceStore, doomed.id);
  assert.deepEqual(
    receipt,
    { id: doomed.id, slug: "doomed-page", title: doomed.title },
    "discard returns the removed identity as its receipt",
  );
  assert.equal(serviceStore.get(doomed.id), null);
  assert.ok(
    serviceStore.list().some((draft) => draft.slug === "renamed-page"),
    "discard leaves neighboring drafts untouched",
  );
  await assert.rejects(
    discardSiteDraft(serviceStore, doomed.id),
    (error: unknown) => error instanceof DraftNotFoundError,
    "double discard fails honestly",
  );

  // Stored documents stay transferable: maximal schema-valid payloads stop
  // at the byte bound on the create path. Leaf edits cannot reach it (prop
  // lengths cap far below), so revision re-checks as defense in depth.
  const bulkSections = Array.from({ length: 40 }, (_, section) => ({
    id: `bulk-${section}`,
    type: "section" as const,
    children: Array.from({ length: 20 }, (_, child) => ({
      id: `bulk-${section}-${child}`,
      type: "text" as const,
      props: { text: "x".repeat(2000) },
    })),
  }));
  const bulkDoc = { ...template, root: bulkSections } as unknown as SiteDocument;
  assert.throws(
    () => assertDocumentSize(bulkDoc),
    /limit is 500 KB/,
    "oversized documents are refused with the bound named",
  );
  assert.ok(
    new TextEncoder().encode(JSON.stringify(template)).length < MAX_SITE_DOCUMENT_BYTES,
    "ordinary pages sit far below the bound",
  );
  await assert.rejects(
    createSiteDraft(serviceStore, { brief, mode: "ai", slug: "too-big" }, async () => bulkDoc),
    /limit is 500 KB/,
    "creation enforces the bound before anything saves",
  );
  assert.equal(
    serviceStore.list().filter((draft) => draft.slug === "too-big").length,
    0,
    "oversized creates leave no partial draft",
  );

  // Section regeneration: surgical AI improvement with provable scoping.
  const regenBase = await createSiteDraft(
    serviceStore,
    { brief, mode: "template", slug: "regen-page" },
    noGenerator,
  );
  const systemPrompt = buildSectionSystemPrompt();
  assert.ok(systemPrompt.includes("Never invent prices"), "regeneration carries grounding rules");
  assert.ok(systemPrompt.includes(first.id), "regeneration exposes catalog ids");
  const heroSection = regenBase.document.root.find((section) => section.id === "hero")!;
  const userPrompt = buildSectionUserPrompt(heroSection, "More premium, less copy");
  assert.ok(userPrompt.includes("hero") && userPrompt.includes("More premium"));
  const siblingsBefore = JSON.stringify(
    regenBase.document.root.filter((section) => section.id !== "hero"),
  );
  const freshHero = {
    id: "hero-main",
    type: "hero",
    props: {
      variant: "split",
      heading: "Evenings, returned.",
      body: "Shorter, sharper.",
      primaryCta: { label: "Talk to us", href: "/contact" },
    },
  };
  const regenerated = await regenerateSection(
    serviceStore,
    regenBase.id,
    "hero",
    { direction: "More premium", expectedChecksum: regenBase.checksum },
    async () => ({ children: [freshHero] }),
  );
  assert.notEqual(regenerated.checksum, regenBase.checksum);
  assert.equal(regenerated.source, "template", "regeneration preserves draft provenance");
  assert.deepEqual(
    JSON.stringify(regenerated.document.root.filter((section) => section.id !== "hero")),
    siblingsBefore,
    "sibling sections are byte-identical after regeneration",
  );
  assert.equal(
    (regenerated.document.root.find((section) => section.id === "hero")?.children[0] as { props: { heading: string } })
      ?.props.heading,
    "Evenings, returned.",
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "no-such-section", {}, async () => ({
      children: [freshHero],
    })),
    /Unknown section/,
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => ({
      children: [{ id: "bad", type: "marquee-3d", props: {} }],
    })),
    /invalid/,
    "non-registry leaves are refused",
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => ({
      children: [freshHero, { ...freshHero }],
    })),
    /unique/,
    "duplicate regenerated ids are refused",
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => ({
      children: [{ ...freshHero, id: "what-you-get-grid" }],
    })),
    /collides outside/,
    "scoping is enforced against sibling ids",
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => ({
      children: [{ ...freshHero, props: { ...freshHero.props, body: "Save $5,000 today." } }],
    })),
    /invents a metric/,
    "regenerated metrics are refused like generated ones",
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => ({
      children: [
        {
          id: "link-note",
          type: "text",
          props: { text: "Details at https://invented.example/x" },
        },
      ],
    })),
    /invents links/,
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => ({
      children: [{ id: "pic", type: "image", props: { assetId: "invented/missing" } }],
    })),
    /catalog/,
    "regenerated images resolve to the catalog",
  );
  await assert.rejects(
    regenerateSection(
      serviceStore,
      regenerated.id,
      "hero",
      { expectedChecksum: regenBase.checksum },
      async () => ({ children: [freshHero] }),
    ),
    (error: unknown) => error instanceof StaleDraftError,
    "regeneration honors optimistic concurrency",
  );
  await assert.rejects(
    regenerateSection(serviceStore, regenerated.id, "hero", {}, async () => {
      throw new Error("provider down");
    }),
    /failed before validation/,
  );

  console.log(
    "Site Studio v1: schema, tokens, catalog, renderer, store, template, generation contract, job registration, draft service, revision, discard, size bound, and regeneration passed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
