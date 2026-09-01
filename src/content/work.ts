export type WorkSlug =
  | "work-shelter"
  | "healthcare-real-estate"
  | "superdebate"
  | "sparkblox"
  | "thrive-protocol"
  | "green-goods"
  | "northern-trust";

export type WorkSection = { label: string; title: string; body: string };

export type WorkVisibility = "public" | "archived";

export type WorkServiceId =
  "strategy" | "automation" | "sales" | "engagement" | "content" | "reporting";

export type WorkImage = {
  kind: "image";
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  presentation: "interface" | "photo" | "slide";
  fit?: "cover" | "contain";
  canvas?: "paper" | "ink";
  objectPosition?: string;
};

export type WorkVideo = {
  kind: "youtube";
  youtubeId: string;
  poster: string;
  title: string;
  caption: string;
};

export type WorkDiagram = {
  kind: "diagram";
  variant:
    | "work-shelter-routing"
    | "healthcare-object-map"
    | "healthcare-deal-flow"
    | "superdebate-operating-loop"
    | "superdebate-product-system"
    | "sparkblox-product-stack"
    | "thrive-builder-loop"
    | "green-goods-proof-flow";
  title: string;
  caption: string;
};

export type WorkMedia = WorkImage | WorkVideo | WorkDiagram;

export type WorkVisualBlock = {
  afterSection: number;
  eyebrow?: string;
  title?: string;
  intro?: string;
  layout: "single" | "duo" | "triptych" | "filmstrip" | "interface-grid";
  width?: "contained" | "wide" | "bleed";
  tone?: "paper" | "ink" | "accent";
  frame?: WorkArtDirection["mediaFrame"];
  media: WorkMedia[];
};

export type WorkArtDirection = {
  world: "workshop" | "stage" | "clinical" | "archive" | "brief" | "field" | "enterprise";
  hero: "wide" | "portrait" | "system" | "window" | "document";
  rhythm: "editorial" | "cinematic" | "architectural" | "stacked" | "notebook";
  mediaFrame: "edge" | "film" | "window" | "paper";
};

export type WorkProject = {
  slug: WorkSlug;
  visibility: WorkVisibility;
  name: string;
  category: string;
  cardHeadline: string;
  cardDescription: string;
  proof?: string;
  proofLabel?: string;
  showProofOnCard?: boolean;
  industry: string;
  role: string;
  relationship: string;
  timeline: string;
  description: string;
  capabilities: string[];
  serviceIds: WorkServiceId[];
  accent: "ink" | "red" | "blue" | "green" | "violet" | "gold" | "slate";
  composition: "operations" | "platform" | "company" | "ecosystem" | "field" | "motion";
  artDirection: WorkArtDirection;
  cardMedia: WorkImage | WorkDiagram;
  heroMedia: WorkMedia;
  sections: WorkSection[];
  visualBlocks: WorkVisualBlock[];
  carryForward: string;
  related: WorkSlug[];
  seoTitle: string;
  seoDescription: string;
};

const image = (
  src: string,
  alt: string,
  caption: string,
  options: Pick<WorkImage, "fit" | "canvas" | "objectPosition"> & {
    presentation?: WorkImage["presentation"];
  } = {},
): WorkImage => {
  const dimensions = workImageDimensions[src];
  if (!dimensions) throw new Error(`Missing portfolio image dimensions for ${src}`);
  return {
    kind: "image",
    src,
    alt,
    caption,
    presentation: options.presentation ?? "interface",
    ...dimensions,
    ...options,
  };
};

const workImageDimensions: Record<string, { width: number; height: number }> = {
  "/work/work-shelter/brand-partners.webp": { width: 2122, height: 1444 },
  "/work/work-shelter/campaign-admin-help.webp": { width: 2776, height: 1638 },
  "/work/work-shelter/catalog-experience.webp": { width: 2786, height: 1630 },
  "/work/work-shelter/command-center-dashboard.webp": { width: 2776, height: 1628 },
  "/work/work-shelter/customer-site-hero.webp": { width: 2770, height: 1632 },
  "/work/work-shelter/factory-floor.jpg": { width: 1800, height: 1441 },
  "/work/work-shelter/factory-team.jpg": { width: 1600, height: 1025 },
  "/work/work-shelter/orders-workspace.webp": { width: 2794, height: 1636 },
  "/work/work-shelter/products-inventory.webp": { width: 2784, height: 1626 },
  "/work/work-shelter/quote-flow-overview.webp": { width: 2100, height: 1424 },
  "/work/work-shelter/quote-flow-detail.webp": { width: 2582, height: 1406 },
  "/work/work-shelter/sewing-work.jpg": { width: 1800, height: 1441 },
  "/work/superdebate/admin-dashboard.webp": { width: 2792, height: 1638 },
  "/work/superdebate/admin-email.webp": { width: 2778, height: 1634 },
  "/work/superdebate/admin-events.webp": { width: 2776, height: 1618 },
  "/work/superdebate/admin-roadmap.webp": { width: 2790, height: 1622 },
  "/work/superdebate/club-crowd.webp": { width: 900, height: 1125 },
  "/work/superdebate/debate-judging.webp": { width: 2880, height: 1800 },
  "/work/superdebate/featured-debate-podium.webp": { width: 1024, height: 1536 },
  "/work/superdebate/online-debate.webp": { width: 1536, height: 1024 },
  "/work/superdebate/online-product.webp": { width: 2784, height: 1614 },
  "/work/superdebate/product-home.webp": { width: 2792, height: 1622 },
  "/work/sparkblox/analytics.webp": { width: 1768, height: 857 },
  "/work/sparkblox/configure.webp": { width: 2056, height: 1002 },
  "/work/sparkblox/create.webp": { width: 2056, height: 1002 },
  "/work/sparkblox/manage.webp": { width: 1768, height: 857 },
  "/work/sparkblox/no-code-platform.webp": { width: 1920, height: 1080 },
  "/work/sparkblox/product-thesis.webp": { width: 1920, height: 1080 },
  "/work/sparkblox/unlimited-canvas.webp": { width: 1920, height: 1080 },
  "/work/thrive-protocol/verification-hero.webp": { width: 2760, height: 1588 },
  "/work/thrive-protocol/verification-pipeline.webp": { width: 2400, height: 1454 },
  "/work/thrive-protocol/xion-program.jpg": { width: 800, height: 487 },
  "/work/green-goods/field-methodology.webp": { width: 1920, height: 1358 },
  "/work/green-goods/product-screens.webp": { width: 1440, height: 900 },
  "/work/green-goods/project-context.webp": { width: 2400, height: 1200 },
  "/work/northern-trust/7IIi7cutMzY.webp": { width: 480, height: 360 },
  "/work/northern-trust/DKmFuTVYvj4.webp": { width: 480, height: 360 },
  "/work/northern-trust/NWuMI7CY1Cc.webp": { width: 480, height: 360 },
  "/work/northern-trust/ahSfTIIveBI.webp": { width: 480, height: 360 },
  "/work/northern-trust/impact-return-matrix.webp": { width: 800, height: 789 },
};

const diagram = (variant: WorkDiagram["variant"], title: string, caption: string): WorkDiagram => ({
  kind: "diagram",
  variant,
  title,
  caption,
});

export const workProjects: readonly WorkProject[] = [
  {
    slug: "work-shelter",
    visibility: "public",
    name: "WORK+SHELTER",
    category: "AI OPERATIONS · CUSTOM SYSTEMS",
    cardHeadline: "Giving the founder back the work only she can do.",
    cardDescription:
      "Rebuilding client, production, communication, and reporting workflows around the moments that actually require human judgment.",
    proof: "80% reduction in U.S. client-management hours",
    industry: "International manufacturing",
    role: "Fractional CTO",
    relationship: "Ongoing operating work by Accelerate",
    timeline: "2024–present",
    description:
      "Ongoing technology leadership for an international manufacturer coordinating clients and production across Chicago and Delhi.",
    capabilities: [
      "Fractional technology leadership",
      "Customer website",
      "Custom command center",
      "AI-enabled operations",
    ],
    serviceIds: ["automation", "reporting"],
    accent: "red",
    composition: "operations",
    artDirection: { world: "workshop", hero: "wide", rhythm: "editorial", mediaFrame: "edge" },
    cardMedia: image(
      "/work/work-shelter/customer-site-hero.webp",
      "WORK+SHELTER customer website introducing its ethical made-to-order manufacturing offer over a row of colorful workwear",
      "WORK+SHELTER customer experience",
      { fit: "cover", objectPosition: "50% 46%" },
    ),
    heroMedia: image(
      "/work/work-shelter/customer-site-hero.webp",
      "WORK+SHELTER customer website introducing its ethical made-to-order manufacturing offer over a row of colorful workwear",
      "Customer website · manufacturing proposition",
      { fit: "contain" },
    ),
    sections: [
      {
        label: "Context",
        title: "Growth had created a coordination problem.",
        body: "WORK+SHELTER has operated across Delhi and the United States since 2011. Every client relationship crosses briefs, sampling, production, approvals, logistics, and a distributed team. The business was working, but too much context still had to pass through the founder.",
      },
      {
        label: "Analysis",
        title: "The relationship was not the thing to automate.",
        body: "Client trust and production judgment were part of the value. The useful distinction was between routine information movement, production decisions, and moments that genuinely needed founder attention.",
      },
      {
        label: "Intervention",
        title: "Build one technology layer across customer and operating work.",
        body: "As fractional CTO, the work spans the customer website and quote journey, the custom command center, AI-assisted classification, CRM infrastructure, reporting, and automation. Each release is shaped by the data the operation generates, so routine work is prepared by the system while production and relationship judgment remain with the right people.",
      },
      {
        label: "Impact",
        title: "Less administration. The same human relationship.",
        body: "The resulting AI-enabled operating model has reduced U.S. client-management hours by 80%. This is a documented capacity result, not a revenue estimate, and it came from redesigning the operating model rather than installing a single automation.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 0,
        eyebrow: "Inside the operation",
        title: "Real work, spread across people and places.",
        layout: "duo",
        tone: "paper",
        media: [
          image(
            "/work/work-shelter/sewing-work.jpg",
            "WORK+SHELTER garments arranged inside the production facility",
            "Production at WORK+SHELTER",
            { presentation: "photo" },
          ),
          image(
            "/work/work-shelter/factory-floor.jpg",
            "WORK+SHELTER products and materials from the manufacturing operation",
            "Work produced by the Delhi team",
            { presentation: "photo" },
          ),
        ],
      },
      {
        afterSection: 0,
        eyebrow: "Customer experience",
        title: "The operating promise is visible before a quote begins.",
        intro:
          "The current customer experience connects a clear product catalog with evidence of the brands the team has produced for. These are current WORK+SHELTER website screens.",
        layout: "duo",
        width: "wide",
        tone: "paper",
        frame: "window",
        media: [
          image(
            "/work/work-shelter/catalog-experience.webp",
            "WORK+SHELTER product catalog showing totes, aprons, bandanas, and workwear with minimum quantities",
            "Customer website · product catalog",
            { fit: "contain" },
          ),
          image(
            "/work/work-shelter/brand-partners.webp",
            "WORK+SHELTER brand-partner section showing produced goods for Clay AI, Resy, and Northwestern University",
            "Customer website · examples of produced work",
            { fit: "contain" },
          ),
        ],
      },
      {
        afterSection: 1,
        eyebrow: "Simplified operating model",
        title: "Judgment stays human. The routing does not have to.",
        intro:
          "A public abstraction of the operating logic. It is a process diagram, not a screenshot of a private internal system.",
        layout: "single",
        tone: "ink",
        media: [
          diagram(
            "work-shelter-routing",
            "Client work routed by the kind of judgment it requires",
            "Accelerate case-study diagram · simplified operating model",
          ),
        ],
      },
      {
        afterSection: 1,
        eyebrow: "Structured intake",
        title: "The handoff begins with a quote the operation can use.",
        intro:
          "The quote experience gathers product, quantity, customization, files, and contact details before a person reviews the request. The form supports the relationship; it does not pretend to replace the account manager.",
        layout: "single",
        width: "contained",
        tone: "paper",
        frame: "window",
        media: [
          image(
            "/work/work-shelter/quote-flow-overview.webp",
            "WORK+SHELTER quote experience showing its three-step process and first product request",
            "Customer quote flow · overview",
            { fit: "contain" },
          ),
        ],
      },
      {
        afterSection: 2,
        eyebrow: "The operating layer",
        title: "One command center for the work around the order.",
        intro:
          "The custom command center connects the daily check-in, approvals, customer conversations, orders, products, inventory, campaigns, and operational assistance. These screens show a controlled demo state; visible customer names and email addresses are fictional records.",
        layout: "interface-grid",
        tone: "paper",
        frame: "window",
        media: [
          image(
            "/work/work-shelter/command-center-dashboard.webp",
            "WORK+SHELTER command center dashboard showing approvals, unanswered leads, pipeline, inventory attention, and operating metrics",
            "WORK+SHELTER command center · daily operating view",
            { fit: "contain" },
          ),
          image(
            "/work/work-shelter/orders-workspace.webp",
            "WORK+SHELTER orders workspace showing order status, fulfillment context, search, export, and order actions",
            "Orders · controlled demo data",
            { fit: "contain" },
          ),
          image(
            "/work/work-shelter/products-inventory.webp",
            "WORK+SHELTER products and inventory workspace showing stock status, pricing, CSV actions, margins, and saved views",
            "Products and inventory · controlled demo data",
            { fit: "contain" },
          ),
          image(
            "/work/work-shelter/campaign-admin-help.webp",
            "WORK+SHELTER campaign composer with audience eligibility, email layouts, and page-aware read-only admin help",
            "Campaign execution and admin assistance · controlled demo state",
            { fit: "contain" },
          ),
        ],
      },
    ],
    carryForward: "AI is most useful when you understand what should remain human.",
    related: ["superdebate", "healthcare-real-estate"],
    seoTitle: "WORK+SHELTER AI Operations Case Study",
    seoDescription:
      "Fractional CTO work spanning WORK+SHELTER's website, custom command center, and AI-enabled operating model, reducing U.S. client-management hours by 80%.",
  },
  {
    slug: "healthcare-real-estate",
    visibility: "public",
    name: "Healthcare Real Estate Platform",
    category: "CUSTOM SOFTWARE · DEAL OPERATIONS",
    cardHeadline: "Replacing a generic CRM with the way healthcare deals actually move.",
    cardDescription:
      "A two-sided operating platform for advisors, healthcare-facility listings, documents, and vetted private-equity buyers.",
    proof: "40% faster inquiry-to-close",
    industry: "Healthcare real estate",
    role: "UX architect & project manager",
    relationship: "Prior team work",
    timeline: "8-month product build",
    description:
      "A two-sided platform connecting healthcare advisors, facility opportunities, and vetted buyers.",
    capabilities: [
      "Business process modeling",
      "Product strategy",
      "Custom software",
      "Workflow design",
    ],
    serviceIds: ["strategy", "automation"],
    accent: "blue",
    composition: "platform",
    artDirection: {
      world: "clinical",
      hero: "system",
      rhythm: "architectural",
      mediaFrame: "paper",
    },
    cardMedia: diagram(
      "healthcare-object-map",
      "The deal was the center of the product",
      "Accelerate case-study diagram · system model",
    ),
    heroMedia: diagram(
      "healthcare-object-map",
      "The deal was the center of the product",
      "Accelerate case-study diagram · system model",
    ),
    sections: [
      {
        label: "Constraint",
        title: "The old system understood contacts. The business ran on deals.",
        body: "Healthcare real estate transactions involved advisors, vetted buyers, hundreds of facility listings, documents, photography, access rules, and both single-property and portfolio opportunities. An off-the-shelf CRM could store names, but it could not represent the work around them.",
      },
      {
        label: "Analysis",
        title: "Model the business before designing the screens.",
        body: "The team mapped the operating objects, their relationships, the permissions each participant needed, and the actions that moved a deal forward. That model became the product architecture.",
      },
      {
        label: "Architecture",
        title: "One late requirement could have broken the product.",
        body: "Portfolio deals changed the relationship between facilities, documents, buyers, and inquiries. Treating that requirement as an extra screen would have created brittle exceptions. The underlying model was adjusted so single assets and portfolios could move through the same system.",
      },
      {
        label: "Intervention",
        title: "One operating environment for both sides of the transaction.",
        body: "Working with two UI designers and a distributed development team, the project delivered advisor and buyer experiences, listing management, document and photography workflows, permissions, and a visible deal pipeline over eight months.",
      },
      {
        label: "Impact",
        title: "Deals moved faster.",
        body: "The documented result was a 40% reduction in inquiry-to-close time. The gain came from putting the actual transaction model in one operational system, not from adding another layer to the generic CRM.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 1,
        eyebrow: "System architecture",
        title: "Objects, permissions, and actions before interface polish.",
        intro:
          "The original product is private. This diagram communicates the operating model without fabricating a screen.",
        layout: "single",
        tone: "accent",
        media: [
          diagram(
            "healthcare-deal-flow",
            "A shared path from opportunity to close",
            "Accelerate case-study diagram · based on the documented product architecture",
          ),
        ],
      },
    ],
    carryForward: "Sometimes SaaS is the shortcut. Sometimes SaaS is the constraint.",
    related: ["work-shelter", "superdebate"],
    seoTitle: "Healthcare Real Estate Software Case Study",
    seoDescription:
      "How a purpose-built healthcare real estate platform replaced a generic CRM and reduced inquiry-to-close time by 40%.",
  },
  {
    slug: "superdebate",
    visibility: "public",
    name: "SuperDebate",
    category: "AI PRODUCT · MANAGED OPERATIONS",
    cardHeadline: "Building the product and the operating system at the same time.",
    cardDescription:
      "Product and operating infrastructure spanning expert outreach, live debates, scoring, clubs, events, content, and AI-powered practice.",
    industry: "Debate and education",
    role: "Founder & product lead",
    relationship: "Founder-built company",
    timeline: "2022–present",
    description:
      "A debate company combining featured events, clubs, live online competition, judging, and private AI practice.",
    capabilities: [
      "Product architecture",
      "AI-enabled practice",
      "Managed operations",
      "Content systems",
    ],
    serviceIds: ["automation", "content"],
    accent: "violet",
    composition: "company",
    artDirection: { world: "stage", hero: "wide", rhythm: "cinematic", mediaFrame: "film" },
    cardMedia: image(
      "/work/superdebate/online-product.webp",
      "SuperDebate live online product showing debate setup, audience scoring, and a mobile debate configuration",
      "SuperDebate online debate product",
      { fit: "contain", canvas: "ink" },
    ),
    heroMedia: image(
      "/work/superdebate/product-home.webp",
      "SuperDebate website showing featured debate, club, online, and private AI practice entry points",
      "SuperDebate public product",
      { fit: "contain", canvas: "ink" },
    ),
    sections: [
      {
        label: "Context",
        title: "Category-building creates work everywhere at once.",
        body: "SuperDebate spans featured debates, clubs, live online competition, scoring, judging, and private AI practice through Aurelius. The public product depends on expert research, outreach, scheduling, events, content, and relationship management behind it.",
      },
      {
        label: "Operating model",
        title: "Treat the path from expert discovery to published debate as one system.",
        body: "Research, outreach, follow-up, scheduling, preparation, live production, publishing, and relationship history were designed as connected work. AI and automation support repetitive preparation while people own the invitation, editorial decision, and live exchange.",
      },
      {
        label: "Product",
        title: "The same philosophy extends into the participant experience.",
        body: "Featured Debates create an editorial front door. Clubs organize communities. Online supports live competition. Scoring makes judging legible. Aurelius gives participants a private AI practice environment. Each surface belongs to the same activity rather than a bundle of unrelated features.",
      },
      {
        label: "Impact",
        title: "A small team can operate a much larger surface area.",
        body: "The evidence here is the breadth and continuity of a working company, not an unapproved growth number. Product and operations evolve together, so each repeated event leaves behind a better system for the next one.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 0,
        eyebrow: "Operating architecture",
        title: "The experience begins before anyone reaches the stage.",
        layout: "single",
        width: "wide",
        tone: "accent",
        media: [
          diagram(
            "superdebate-operating-loop",
            "From expert research to a reusable debate asset",
            "Accelerate case-study diagram · simplified SuperDebate operating loop",
          ),
        ],
      },
      {
        afterSection: 1,
        eyebrow: "The product",
        title: "One debate system, from watching to practice.",
        intro:
          "The architecture keeps the wider experience legible. The genuine product screens then show configurable online debate, live audience scoring, and judging without inventing interface evidence.",
        layout: "single",
        width: "wide",
        tone: "accent",
        media: [
          diagram(
            "superdebate-product-system",
            "A connected product for watching, organizing, debating, judging, and practicing",
            "Accelerate case-study diagram · current SuperDebate product system",
          ),
        ],
      },
      {
        afterSection: 1,
        eyebrow: "Product evidence",
        title: "Live debate and clear judging belong to the same learning loop.",
        intro: "These are current product screens, not concept art.",
        layout: "duo",
        width: "wide",
        tone: "paper",
        frame: "film",
        media: [
          image(
            "/work/superdebate/online-product.webp",
            "SuperDebate online debate interface showing mobile setup and live audience judging",
            "Public product · online debate and scoring",
            { fit: "contain", canvas: "ink" },
          ),
          image(
            "/work/superdebate/debate-judging.webp",
            "SuperDebate judging interface showing comparative scoring across debate rounds",
            "Live debate judging and scoring",
            { fit: "contain", canvas: "ink" },
          ),
        ],
      },
      {
        afterSection: 2,
        eyebrow: "SuperDebate command center",
        title: "The company runs through the same system it keeps improving.",
        intro:
          "The black-and-yellow command center coordinates analytics, events, the product roadmap, email, applications, leads, support, clubs, and content. Counts and dates visible in these screens are interface state, not portfolio outcome claims.",
        layout: "interface-grid",
        tone: "ink",
        frame: "film",
        media: [
          image(
            "/work/superdebate/admin-dashboard.webp",
            "SuperDebate command center dashboard showing event signups, membership, club joins, debates, and operating analytics",
            "Command center · operating dashboard",
            { fit: "contain", canvas: "ink" },
          ),
          image(
            "/work/superdebate/admin-events.webp",
            "SuperDebate command center events workspace showing debate scheduling, registrations, filters, and page status",
            "Command center · events operations",
            { fit: "contain", canvas: "ink" },
          ),
          image(
            "/work/superdebate/admin-roadmap.webp",
            "SuperDebate command center roadmap showing ideas, planned work, work in progress, blockers, and shipped items",
            "Command center · product roadmap",
            { fit: "contain", canvas: "ink" },
          ),
          image(
            "/work/superdebate/admin-email.webp",
            "SuperDebate command center email workspace showing production templates, previews, tests, and delivery controls",
            "Command center · email operations",
            { fit: "contain", canvas: "ink" },
          ),
        ],
      },
      {
        afterSection: 2,
        eyebrow: "Debate in practice",
        title: "Product, people, and place reinforce each other.",
        layout: "filmstrip",
        width: "wide",
        tone: "paper",
        media: [
          image(
            "/work/superdebate/featured-debate-podium.webp",
            "A SuperDebate featured-debate visual with two speakers at a podium",
            "Featured Debates",
            { objectPosition: "50% 43%", presentation: "photo" },
          ),
          image(
            "/work/superdebate/online-debate.webp",
            "Two participants shown in the SuperDebate live online debate experience",
            "SuperDebate Online",
            { presentation: "photo" },
          ),
          image(
            "/work/superdebate/club-crowd.webp",
            "A live SuperDebate club gathering with a speaker and audience",
            "A SuperDebate community gathering",
            { objectPosition: "50% 55%", presentation: "photo" },
          ),
        ],
      },
    ],
    carryForward: "The best AI system may be the company architecture itself.",
    related: ["sparkblox", "work-shelter"],
    seoTitle: "SuperDebate AI Product and Operations Case Study",
    seoDescription:
      "How SuperDebate develops its product, AI practice, live events, expert outreach, and internal operating system together.",
  },
  {
    slug: "sparkblox",
    visibility: "public",
    name: "Sparkblox",
    category: "PRODUCT STRATEGY · CUSTOM SOFTWARE",
    cardHeadline: "Turning smart-contract complexity into a no-code product.",
    cardDescription:
      "A platform for brands and creators to create, launch, manage, and evolve digital assets without writing code.",
    proof: "$1M+ raised",
    industry: "Web3 software",
    role: "Founder & CEO",
    relationship: "Founder-built company",
    timeline: "2021–2024",
    description:
      "A no-code platform for creating, launching, embedding, and managing dynamic digital assets.",
    capabilities: [
      "Zero-to-one strategy",
      "Custom software",
      "Product design",
      "Technical translation",
    ],
    serviceIds: ["strategy", "automation"],
    accent: "gold",
    composition: "company",
    artDirection: { world: "archive", hero: "window", rhythm: "stacked", mediaFrame: "window" },
    cardMedia: image(
      "/work/sparkblox/no-code-platform.webp",
      "Original Sparkblox product presentation combining the no-code proposition with collection, embed, management, and 3D editing interfaces",
      "Sparkblox no-code product · archived presentation",
      { fit: "contain", presentation: "slide" },
    ),
    heroMedia: image(
      "/work/sparkblox/no-code-platform.webp",
      "Original Sparkblox product presentation combining the no-code proposition with collection, embed, management, and 3D editing interfaces",
      "Sparkblox no-code product · archived presentation",
      { fit: "contain", presentation: "slide" },
    ),
    sections: [
      {
        label: "Product problem",
        title: "No code is easy to say and difficult to design.",
        body: "Creating a digital asset involved contract selection, deployment, metadata, networks, wallets, mint mechanics, and decisions after launch. The interface had to remove technical burden without removing the control that made the platform useful.",
      },
      {
        label: "Intervention",
        title: "A launchpad instead of a developer toolkit.",
        body: "Sparkblox translated the stack into a guided product for collection creation, launch configuration, dynamic assets, embeddable minting, campaign management, and analytics. The user made product decisions while the platform handled the smart-contract mechanics.",
      },
      {
        label: "Company building",
        title: "Building the company was part of building the product.",
        body: "The work extended beyond UX and feature definition into fundraising, technical direction, partnerships, artists, market positioning, and the constraints of shipping an emerging-technology product from zero.",
      },
      {
        label: "Impact",
        title: "From idea to funded platform.",
        body: "Sparkblox raised more than $1 million, developed partnerships with Chainlink and Algorand, worked with more than 20 artists, and supported multiple six-figure Web3 art initiatives. This is founder experience behind Accelerate, not a former agency engagement.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 0,
        eyebrow: "Archived product",
        title: "One workflow from collection setup to public launch.",
        intro:
          "Sparkblox is no longer live. These genuine 2022 screens show the collection workspace, the public mint experience, and the confirmation path after a successful transaction.",
        layout: "interface-grid",
        tone: "paper",
        frame: "window",
        media: [
          image(
            "/work/sparkblox/manage.webp",
            "Archived Sparkblox collection workspace showing generated assets, property groups, file types, and launch configuration",
            "Collection workspace · archived 2022 product",
            { fit: "contain" },
          ),
          image(
            "/work/sparkblox/create.webp",
            "Archived Sparkblox public mint experience showing collection information, network, quantity, price, and mint action",
            "Public mint experience · archived 2022 product",
            { fit: "contain" },
          ),
          image(
            "/work/sparkblox/configure.webp",
            "Archived Sparkblox post-mint experience showing newly created assets, marketplace links, sharing, and transaction confirmation",
            "Post-mint confirmation · archived 2022 product",
            { fit: "contain" },
          ),
        ],
      },
      {
        afterSection: 1,
        eyebrow: "Product architecture",
        title: "Hide complexity, not capability.",
        layout: "duo",
        tone: "ink",
        media: [
          diagram(
            "sparkblox-product-stack",
            "Product decisions above, infrastructure below",
            "Accelerate case-study diagram · simplified product stack",
          ),
          image(
            "/work/sparkblox/analytics.webp",
            "Archived Sparkblox embed editor showing a live product preview alongside theme, color, and typography controls",
            "Embeddable mint editor · archived 2022 product",
            { fit: "contain" },
          ),
        ],
      },
      {
        afterSection: 2,
        eyebrow: "Original product thesis",
        title: "The platform was designed around assets that could keep changing.",
        intro:
          "These original company presentations are included as archived strategy artifacts. Their terminology and forward-looking language reflect Sparkblox's 2022 positioning, not current Accelerate market claims.",
        layout: "duo",
        tone: "ink",
        frame: "film",
        media: [
          image(
            "/work/sparkblox/unlimited-canvas.webp",
            "Archived Sparkblox presentation showing generative artworks and positioning dynamic assets as a configurable creative canvas",
            "Creative product vision · archived 2022 presentation",
            { fit: "contain", canvas: "ink", presentation: "slide" },
          ),
          image(
            "/work/sparkblox/product-thesis.webp",
            "Archived Sparkblox presentation explaining the company's thesis for dynamic and evolving digital assets",
            "Dynamic-asset thesis · archived 2022 presentation",
            { fit: "contain", presentation: "slide" },
          ),
        ],
      },
    ],
    carryForward: "Hide complexity, not capability.",
    related: ["superdebate", "green-goods"],
    seoTitle: "Sparkblox No-Code Web3 Product Case Study",
    seoDescription:
      "The founder-built story of Sparkblox, a funded no-code platform for creating, launching, and managing dynamic digital assets.",
  },
  {
    slug: "thrive-protocol",
    visibility: "public",
    name: "Thrive Protocol",
    category: "GROWTH STRATEGY · OUTREACH SYSTEMS",
    cardHeadline: "Connecting serious builders with capital built around proof of value.",
    cardDescription:
      "Builder sourcing, ecosystem growth, positioning, and funding-program outreach across a fragmented Web3 landscape.",
    proof: "Up to $12.6M across seasons",
    proofLabel: "Program context",
    showProofOnCard: false,
    industry: "Emerging technology",
    role: "Ecosystem specialist",
    relationship: "Specialist engagement",
    timeline: "January–June 2025",
    description: "Ecosystem strategy and builder acquisition for a Proof-of-Value funding model.",
    capabilities: [
      "Growth strategy",
      "Audience research",
      "Outreach systems",
      "Program operations",
    ],
    serviceIds: ["strategy", "sales"],
    accent: "green",
    composition: "ecosystem",
    artDirection: { world: "brief", hero: "document", rhythm: "editorial", mediaFrame: "film" },
    cardMedia: image(
      "/work/thrive-protocol/verification-hero.webp",
      "Current Thrive website introducing its verification layer for private-market investors and founders",
      "Thrive today · current company context",
      { fit: "contain", canvas: "ink" },
    ),
    heroMedia: image(
      "/work/thrive-protocol/verification-hero.webp",
      "Current Thrive website introducing its verification layer for private-market investors and founders",
      "Thrive today · current company context, not an engagement deliverable",
      { fit: "contain", canvas: "ink" },
    ),
    sections: [
      {
        label: "Context",
        title: "Funding only works if the right builders find it.",
        body: "Thrive Protocol applies a Proof-of-Value model to ecosystem funding. The engagement focused on AI strategy, ecosystem growth, builder sourcing, funding opportunities, developer engagement, and the route from program awareness to a credible project.",
      },
      {
        label: "Constraint",
        title: "Capital is not distribution.",
        body: "A program could have meaningful funding available and still miss the builders capable of using it. The problem was to identify serious teams across fragmented communities, understand fit, and make the next step clear without turning outreach into volume for its own sake.",
      },
      {
        label: "Intervention",
        title: "Match the builder, opportunity, and incentive.",
        body: "The work combined target-builder profiles, research, qualification, personalized outreach, conversation, and funding-path guidance. AI could help organize signals and prepare work, but the judgment of whether a builder and program belonged together remained human.",
      },
      {
        label: "Program example",
        title: "A funding program designed around accountability.",
        body: "XION's multi-season Anti-Grant program with Thrive made up to $12.6 million available and used milestone-based funding with Proof-of-Value review. That amount is program context only. It is not capital personally raised, sourced, or allocated by the specialist engagement.",
      },
      {
        label: "Relevance",
        title: "Build the distribution layer around the funding layer.",
        body: "The work demonstrates a practical growth problem: a valuable offer does not move until the right audience, qualifying signal, conversation, and next action are designed as one operating path.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 1,
        eyebrow: "Builder acquisition",
        title: "The program needed a route, not a louder announcement.",
        intro:
          "A case-study diagram of the work. It does not represent proprietary Thrive software.",
        layout: "single",
        tone: "ink",
        media: [
          diagram(
            "thrive-builder-loop",
            "From ecosystem program to qualified builder",
            "Accelerate case-study diagram · builder-acquisition loop",
          ),
        ],
      },
      {
        afterSection: 3,
        eyebrow: "Thrive today",
        title: "The company now frames its product around verified truth.",
        intro:
          "This current website screen establishes Thrive's present product direction. It is context only and is not represented as interface work from the January–June 2025 ecosystem engagement.",
        layout: "single",
        width: "wide",
        tone: "ink",
        frame: "film",
        media: [
          image(
            "/work/thrive-protocol/verification-pipeline.webp",
            "Current Thrive website diagram showing connected data, verification, intelligence, and decision-ready outputs",
            "Thrive today · current verification-product context",
            { fit: "contain", canvas: "ink" },
          ),
        ],
      },
    ],
    carryForward: "AI is more valuable when it helps decide what deserves attention.",
    related: ["green-goods", "sparkblox"],
    seoTitle: "Thrive Protocol Ecosystem Growth Case Study",
    seoDescription:
      "Builder sourcing, AI strategy, and ecosystem growth work around Thrive Protocol's Proof-of-Value funding model.",
  },
  {
    slug: "green-goods",
    visibility: "public",
    name: "Green Goods",
    category: "PRODUCT STRATEGY · DATA SYSTEMS",
    cardHeadline: "Making conservation work legible enough to fund.",
    cardDescription:
      "Field-friendly infrastructure for documenting, verifying, and translating real environmental work into evidence funders can use.",
    proof: "$49K in grants secured by the project",
    industry: "Conservation technology",
    role: "Product lead & co-originator",
    relationship: "Prior team work",
    timeline: "Product leadership",
    description:
      "A field-aware product model for recording conservation work and translating it into verifiable evidence.",
    capabilities: [
      "Product strategy",
      "Field workflow design",
      "Evidence systems",
      "Data & reporting",
    ],
    serviceIds: ["strategy", "reporting"],
    accent: "green",
    composition: "field",
    artDirection: { world: "field", hero: "document", rhythm: "notebook", mediaFrame: "paper" },
    cardMedia: image(
      "/work/green-goods/field-methodology.webp",
      "Green Goods methodology showing field evidence, verification, and mobile product screens",
      "Green Goods methodology and product today",
      { fit: "contain" },
    ),
    heroMedia: image(
      "/work/green-goods/field-methodology.webp",
      "Green Goods methodology showing field evidence, verification, and mobile product screens",
      "Green Goods methodology and product today",
      { fit: "contain" },
    ),
    sections: [
      {
        label: "Origin",
        title: "The first version tried to solve too much.",
        body: "Green Goods grew from an earlier GreenPill hackathon concept. The initial idea bundled environmental work, incentives, verification, and technical novelty together. The product became clearer when the team returned to the people doing the work and the evidence they could realistically capture.",
      },
      {
        label: "User",
        title: "The user was not a blockchain user.",
        body: "Initial users included scientists and gardeners in Brazil, often working with low bandwidth, shared devices, and Brazilian Portuguese. Wallets and infrastructure could not become another job. The field experience had to stay centered on the task.",
      },
      {
        label: "Analysis",
        title: "Measuring the work was part of designing the product.",
        body: "A conservation task needed a clear definition, before-and-after evidence, operator review, and a record funders could understand. The difficult work was deciding what counted as credible evidence without making the process unusable in the field.",
      },
      {
        label: "Experience",
        title: "Simple above. Verifiable underneath.",
        body: "The field worker captures the work. An operator reviews evidence and context. The infrastructure records an attestation behind the experience. Each layer has a distinct responsibility, so technical sophistication does not spill into the user's workflow.",
      },
      {
        label: "Impact",
        title: "Enough evidence to earn support.",
        body: "The project received a $20,000 Octant Epoch 5 grant and a $29,000 ENS grant, totaling $49,000. Current product imagery is labeled Green Goods today because the project has continued to develop after the original product work.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 1,
        eyebrow: "The field model",
        title: "Evidence starts where the work happens.",
        layout: "single",
        tone: "accent",
        media: [
          diagram(
            "green-goods-proof-flow",
            "From field task to fundable evidence",
            "Accelerate case-study diagram · simplified evidence flow",
          ),
        ],
      },
      {
        afterSection: 3,
        eyebrow: "Green Goods today",
        title: "The product continues to develop.",
        intro:
          "These current screens show the direction of the product today. They are context, not a claim that every present feature belonged to the original engagement.",
        layout: "duo",
        tone: "paper",
        media: [
          image(
            "/work/green-goods/product-screens.webp",
            "Current Green Goods mobile screens for capturing and reviewing environmental work",
            "Green Goods today · current product screens",
            { fit: "contain" },
          ),
          image(
            "/work/green-goods/project-context.webp",
            "Green Goods illustration connecting environmental work, evidence, and exchange",
            "Green Goods today · project context",
            { fit: "contain" },
          ),
        ],
      },
    ],
    carryForward: "Complex technology should make the user's job simpler.",
    related: ["thrive-protocol", "healthcare-real-estate"],
    seoTitle: "Green Goods Verifiable Impact Product Case Study",
    seoDescription:
      "How Green Goods was designed around field constraints, conservation evidence, operator review, and verifiable impact.",
  },
  {
    slug: "northern-trust",
    visibility: "archived",
    name: "Northern Trust",
    category: "UX · DEVELOPMENT · FINANCIAL SERVICES",
    cardHeadline: "Adding motion without adding fragility.",
    cardDescription:
      "A motion and interaction system designed directly around an existing enterprise website, codebase, and design language.",
    proof: "Initial 6-week engagement extended through 2021",
    industry: "Financial services",
    role: "UX design & front-end development",
    relationship: "Prior team work",
    timeline: "2020–2021",
    description:
      "Motion design and front-end development integrated into an established enterprise environment.",
    capabilities: [
      "UX design",
      "Front-end development",
      "Motion systems",
      "Implementation handoff",
    ],
    serviceIds: [],
    accent: "slate",
    composition: "motion",
    artDirection: {
      world: "enterprise",
      hero: "wide",
      rhythm: "architectural",
      mediaFrame: "film",
    },
    cardMedia: image(
      "/work/northern-trust/7IIi7cutMzY.webp",
      "Poster frame from a Northern Trust scroll-based motion experiment",
      "Published Northern Trust motion experiment · homepage scroll",
      { fit: "cover" },
    ),
    heroMedia: {
      kind: "youtube",
      youtubeId: "7IIi7cutMzY",
      poster: "/work/northern-trust/7IIi7cutMzY.webp",
      title: "Northern Trust homepage scroll motion experiment",
      caption: "Published Northern Trust motion experiment · click to play",
    },
    sections: [
      {
        label: "Context",
        title: "The website was not a blank canvas.",
        body: "Northern Trust wanted its redesigned corporate website to feel more dynamic without turning motion into decoration or creating an implementation layer the internal team could not maintain.",
      },
      {
        label: "Analysis",
        title: "Choose motion by impact and effort.",
        body: "The work began with brand immersion and an audit of the existing experience. Opportunities were plotted by likely value and implementation effort so experiments could focus on comprehension, hierarchy, and feel rather than subjective animation preferences.",
      },
      {
        label: "Intervention",
        title: "Prototype in the medium that ships.",
        body: "The engagement combined UX design and front-end development using GSAP, Vue, HTML, and CSS. Motion explorations were tested inside the real technical context, then translated into components and patterns the team could use.",
      },
      {
        label: "Handoff",
        title: "Implementation was part of the design.",
        body: "The work included final code, examples, and documentation. A motion system is only useful inside an enterprise when the people responsible for the site can understand, ship, and maintain it after the engagement.",
      },
      {
        label: "Outcome",
        title: "Six weeks became a longer engagement.",
        body: "The initial six-week engagement was extended multiple times through 2020 and 2021. No unsupported engagement or company-performance metric is attached to this case.",
      },
    ],
    visualBlocks: [
      {
        afterSection: 1,
        eyebrow: "Prioritization",
        title: "A practical way to decide where motion belonged.",
        layout: "single",
        media: [
          image(
            "/work/northern-trust/impact-return-matrix.webp",
            "Whiteboard impact and return matrix used to prioritize Northern Trust motion opportunities",
            "Impact and return matrix from the original engagement",
            { fit: "contain" },
          ),
        ],
      },
      {
        afterSection: 2,
        eyebrow: "Published experiments",
        title: "Motion was tested as part of the interface, not as decoration.",
        intro:
          "Videos load only after selection. Poster frames remain visible when reduced motion is preferred.",
        layout: "filmstrip",
        media: [
          {
            kind: "youtube",
            youtubeId: "DKmFuTVYvj4",
            poster: "/work/northern-trust/DKmFuTVYvj4.webp",
            title: "Northern Trust promotional card motion experiment",
            caption: "Promo card motion exploration",
          },
          {
            kind: "youtube",
            youtubeId: "NWuMI7CY1Cc",
            poster: "/work/northern-trust/NWuMI7CY1Cc.webp",
            title: "Northern Trust alternate promotional card motion experiment",
            caption: "Promo card motion exploration · alternate",
          },
          {
            kind: "youtube",
            youtubeId: "ahSfTIIveBI",
            poster: "/work/northern-trust/ahSfTIIveBI.webp",
            title: "Northern Trust header zoom motion experiment",
            caption: "Header zoom exploration",
          },
        ],
      },
    ],
    carryForward: "Good custom work respects what is already there.",
    related: ["healthcare-real-estate", "sparkblox"],
    seoTitle: "Northern Trust Motion Design Case Study",
    seoDescription:
      "A UX and front-end engagement that designed, built, prioritized, and documented motion within an existing enterprise website.",
  },
] as const;

const publicWorkOrder: readonly WorkSlug[] = [
  "work-shelter",
  "superdebate",
  "healthcare-real-estate",
  "sparkblox",
  "thrive-protocol",
  "green-goods",
];

export const publicWorkProjects = publicWorkOrder.map((slug) => {
  const project = workProjects.find((item) => item.slug === slug && item.visibility === "public");
  if (!project) throw new Error(`Missing public work project: ${slug}`);
  return project;
});
export const archivedWorkProjects = workProjects.filter(
  (project) => project.visibility === "archived",
);
export const featuredWork = publicWorkProjects.slice(0, 4);

export function getWorkBySlug(slug: string) {
  return workProjects.find((project) => project.slug === slug);
}
