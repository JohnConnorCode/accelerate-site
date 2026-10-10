import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { businessAreas, commandCenterPositioning } from "../src/content/command-center-business";
import {
  commandCenterComparisons,
  comparisonReviewedAt,
} from "../src/content/command-center-comparisons";
import { homeCommandCenterContent } from "../src/content/site-studio/home";
import { navItems, footerLinks } from "../src/content/navigation";
import { docsFigureSource } from "../src/lib/docs";
import { createBundledWebsite } from "../src/lib/site-studio/website-seed";
import {
  parseWebsiteDocument,
  type WebsiteDocument,
} from "../src/lib/site-studio/website-document";
import { siteDocumentSchema, type SiteLeafNode } from "../src/lib/site-studio/document";

// Prepare an importable private draft from an owner's export. This script has
// no database connection, credentials, publication pointer or publish operation.
const args = process.argv.slice(2);
const input = args.indexOf("--website");
const output = args.indexOf("--output");
if (
  args.some((arg, index) => index % 2 === 0 && !["--website", "--output"].includes(arg)) ||
  args.length % 2 ||
  (input >= 0 && !args[input + 1]) ||
  (output >= 0 && !args[output + 1])
) {
  throw new Error(
    "Use --website <current-export.json> --output <private-draft.json>, or omit --website for the bundled review draft.",
  );
}
const website =
  input >= 0
    ? parseWebsiteDocument(JSON.parse(readFileSync(args[input + 1]!, "utf8")))
    : createBundledWebsite();
const heading = (id: string, text: string): SiteLeafNode => ({
  id,
  type: "heading",
  props: { level: 2, text },
});
const text = (id: string, value: string): SiteLeafNode => ({
  id,
  type: "text",
  props: { text: value },
});
const button = (id: string, label: string, href: string): SiteLeafNode => ({
  id,
  type: "button",
  props: { label, href, variant: "secondary" },
});
function page(
  url: string,
  title: string,
  description: string,
  children: SiteLeafNode[],
): WebsiteDocument["pages"][number] {
  const id = url.slice(1).replaceAll("/", "-");
  return {
    id,
    path: url,
    metadata: { title, description, noIndex: false },
    content: {
      kind: "document",
      document: siteDocumentSchema.parse({
        schemaVersion: 1,
        engine: "site-studio",
        engineVersion: 1,
        metadata: { title, slug: id, description },
        root: children.map((child) => ({
          id: `section-${child.id}`,
          type: "section",
          children: [child],
        })),
      }),
    },
  };
}
const areas: SiteLeafNode = {
  id: "business-areas",
  type: "featureGrid",
  props: {
    title: "The business work you can do",
    items: businessAreas.map((area) => ({ title: area.title, body: area.description })),
  },
};
const pages = [
  page("/open-source", "Build on Command Center", commandCenterPositioning.description, [
    {
      id: "intro",
      type: "hero",
      props: {
        variant: "editorial",
        eyebrow: "For builders and agencies",
        heading: "Build business Apps. Start with a working foundation.",
        body: commandCenterPositioning.description,
        primaryCta: {
          label: "Adapt a working follow-up report",
          href: "/docs/extend/first-change",
        },
        secondaryCta: { label: "Explore the platform", href: "/demo/command-center" },
      },
    },
    heading("foundation", "Spend development effort on your business's own process"),
    text(
      "reuse",
      "Reuse customer identity, conversations, opportunities, tasks, access and business services. Build an industry report, specialized workspace or custom lifecycle, then make supported operations available to AI through the shared tools.",
    ),
    button("app-design", "Understand App design", "/docs/extend/apps"),
    heading("ownership", "Own the installation and handoff"),
    text(
      "requirements",
      "The application source is MIT licensed. A connected installation uses your own Supabase project and provider accounts, with hosting and usage costs. Current custom App development uses the source and an external coding agent. General-purpose App creation inside the workspace remains planned.",
    ),
    button("setup", "Read the self-hosting guide", "/docs/self-hosting"),
  ]),
  page(
    "/command-center",
    "Command Center | Open-source AI business platform",
    commandCenterPositioning.description,
    [
      {
        id: "intro",
        type: "hero",
        props: {
          variant: "editorial",
          eyebrow: commandCenterPositioning.category,
          heading: "Run your business. Build what it needs.",
          body: commandCenterPositioning.description,
          primaryCta: {
            label: "Follow a client workflow",
            href: "/demo/command-center/northline-roofing/today?workflow=client",
          },
          secondaryCta: { label: "Build on the platform", href: "/docs/extend/first-change" },
        },
      },
      areas,
      ...businessAreas.map((area) =>
        button(area.id, `Explore ${area.title}`, `/command-center/features/${area.id}`),
      ),
      heading("builder", "Adapt the platform to your business"),
      text(
        "foundation",
        "Reuse customer identity, conversations, work, permissions and business services. Add a report, workflow or custom App with your coding agent, then verify the working result. General-purpose App creation inside the workspace remains planned.",
      ),
      button("exercise", "Adapt a working follow-up report", "/docs/extend/first-change"),
      button("comparison", "Compare alternatives", "/command-center/compare"),
    ],
  ),
  page(
    "/command-center/features",
    "Command Center features",
    commandCenterPositioning.description,
    [
      {
        id: "intro",
        type: "hero",
        props: {
          variant: "editorial",
          heading: "Customer work, connected across the business.",
          body: commandCenterPositioning.description,
        },
      },
      areas,
      ...businessAreas.map((area) =>
        button(area.id, `Explore ${area.title}`, `/command-center/features/${area.id}`),
      ),
    ],
  ),
  ...businessAreas.map((area) =>
    page(
      `/command-center/features/${area.id}`,
      `${area.title} | Command Center`,
      area.description,
      [
        {
          id: "intro",
          type: "hero",
          props: {
            variant: "editorial",
            eyebrow: area.title,
            heading: area.headline,
            body: area.description,
            primaryCta: { label: "Try it in the demo", href: area.demoHref },
            secondaryCta: { label: "Read the practical guide", href: area.guideHref },
          },
        },
        text("outcome", area.outcome),
        {
          id: "screenshot",
          type: "image",
          props: {
            assetId: `cc-${area.id}`,
            alt: area.imageAlt,
            caption: "The actual interface with fictional demo records.",
          },
        },
        {
          id: "tasks",
          type: "featureGrid",
          props: {
            title: "What you can do",
            items: area.tasks.map((task) => ({ title: task.title, body: task.detail })),
          },
        },
        ...area.tasks.map((task, index) => button(`guide-${index}`, task.title, task.href)),
        heading("example", area.example.title),
        text("steps", area.example.steps.join("\n\n")),
        text("result", area.example.result),
        heading("setup", "Start with the right setup"),
        text("requirements", area.setup),
        heading("build", "Adapt it to your business"),
        text("builder", area.builder),
        button("build-guide", "Build with a coding agent", "/docs/extend/ai-authoring"),
      ],
    ),
  ),
  page(
    "/command-center/compare",
    "Compare Command Center and alternatives",
    "Choose between a CRM, business suite, app builder and an adaptable business platform.",
    [
      {
        id: "intro",
        type: "hero",
        props: {
          variant: "editorial",
          heading: "Choose the platform around the work you need.",
          body: `Official product descriptions reviewed ${comparisonReviewedAt}. This guide explains strengths and fit; it does not certify feature parity or quoted pricing.`,
        },
      },
      ...commandCenterComparisons.flatMap((item, index) => [
        heading(`choice-${index}`, item.name),
        text(
          `strength-${index}`,
          `${item.category}. ${item.strength}\n\n${item.choose}\n\n${item.fit}`,
        ),
        ...item.sources.map((source, i) =>
          button(`source-${index}-${i}`, source.title, source.href),
        ),
      ]),
      button("trial", "Try your workflow in the demo", "/demo/command-center"),
    ],
  ),
];
for (const area of businessAreas) {
  const asset = {
    id: `cc-${area.id}`,
    src: docsFigureSource(`/images/docs/${area.image}.png`),
    alt: area.imageAlt,
    width: 1440,
    height: 1000,
  };
  website.assets = [...website.assets.filter((item) => item.id !== asset.id), asset];
}
for (const replacement of pages) {
  const existing = website.pages.find((item) => item.path === replacement.path);
  if (existing) Object.assign(existing, { ...replacement, id: existing.id });
  else website.pages.push(replacement);
}
const home = website.pages.find((item) => item.path === "/");
if (home?.content.kind === "native") {
  const product = home.content.sections.find(
    (section) => section.template === "home-command-center",
  );
  if (product) product.fields = structuredClone(homeCommandCenterContent);
}
const productNav = website.navigation.find((item) => item.href === "/command-center");
const productLinks = navItems.find((item) => item.href === "/command-center")!.children!;
if (productNav)
  productNav.children = [
    ...productLinks.map(({ label, href }) => ({ label, href })),
    ...(productNav.children ?? []).filter(
      (item) => !productLinks.some((link) => link.href === item.href),
    ),
  ];
const footer = website.footer.columns.find((column) => column.heading === "Command Center");
if (footer)
  footer.links = [
    ...footerLinks.find((column) => column.heading === "Command Center")!.links,
    ...footer.links.filter(
      (item) =>
        !footerLinks
          .find((column) => column.heading === "Command Center")!
          .links.some((link) => link.href === item.href),
    ),
  ];
const draft = parseWebsiteDocument(website);
const destination =
  output >= 0
    ? args[output + 1]!
    : "docs/verification/command-center-overhaul/site-studio-draft.json";
if (input >= 0 && path.resolve(args[input + 1]!) === path.resolve(destination))
  throw new Error("Choose a separate output file to preserve the owner's current export.");
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(draft, null, 2) + "\n");
console.log(
  `Prepared ${pages.length} product page drafts and the native homepage product section in ${destination}. No site was saved or published.`,
);
