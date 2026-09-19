import { tenant } from "@/config/tenant";
import { parseWebsiteDocument } from "./website-document";

/** One editable seed for public bootstrap, UI, demo, and MCP. No provider calls. */
export function createNeutralWebsite() {
  return parseWebsiteDocument({
    schemaVersion: 1,
    identity: { name: tenant.brand.name, tagline: tenant.brand.tagline },
    navigation: [
      { label: "Explore the demo", href: "/demo/command-center" },
      { label: "Documentation", href: "/docs" },
    ],
    header: { ctaLabel: "Open your workspace", ctaHref: "/admin" },
    footer: {
      text: "Your website, records, and workflows in one workspace. Configure your own services and keep control of your data.",
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "Sign in", href: "/admin" },
      ],
      rights: "An independently operated Command Center installation.",
    },
    dock: {
      visible: false,
      heading: "Your workspace",
      detail: "",
      ctaLabel: "Open workspace",
      ctaHref: "/admin",
    },
    theme: {
      accent: "#315c52",
      background: "#f8f9f6",
      foreground: "#182520",
      font: "sans",
      radius: "soft",
    },
    assets: [],
    collections: [],
    pages: [
      {
        id: "home",
        path: "/",
        metadata: { title: tenant.brand.name, description: tenant.brand.tagline, noIndex: false },
        content: {
          kind: "document",
          document: {
            schemaVersion: 1,
            engine: "site-studio",
            engineVersion: 1,
            metadata: { title: tenant.brand.name, slug: "home", description: tenant.brand.tagline },
            root: [
              {
                id: "welcome",
                type: "section",
                styles: {
                  paddingTop: "xl",
                  paddingBottom: "lg",
                  maxWidth: "content",
                  background: "surface",
                },
                children: [
                  {
                    id: "intro",
                    type: "hero",
                    props: {
                      variant: "editorial",
                      eyebrow: "YOUR OWN COMMAND CENTER",
                      heading: "A home for your business. A workspace to move it forward.",
                      body: "Build a website that belongs to you, connected to the people, inquiries, and work behind your business. Start with a working foundation and shape it around the way you operate.",
                      primaryCta: {
                        label: "Explore the fictional demo",
                        href: "/demo/command-center",
                      },
                      secondaryCta: { label: "Open your workspace", href: "/admin" },
                    },
                  },
                ],
              },
              {
                id: "capabilities",
                type: "section",
                styles: { paddingTop: "lg", paddingBottom: "lg", maxWidth: "content" },
                children: [
                  {
                    id: "capability-grid",
                    type: "featureGrid",
                    props: {
                      title: "One foundation, shaped around your business",
                      items: [
                        {
                          title: "Create your public website",
                          body: "Edit pages, navigation, and appearance in Site Studio. Preview a private draft before publishing, with revision history when you need to restore earlier work.",
                        },
                        {
                          title: "Keep inquiries connected",
                          body: "Connect published forms to your pages. Review responses in your workspace before accepting them into the existing intake workflow.",
                        },
                        {
                          title: "Work with shared context",
                          body: "Bring contacts, pipeline, tasks, and activity into one workspace. Add the plugins and provider connections your work needs.",
                        },
                      ],
                    },
                  },
                ],
              },
              {
                id: "ownership",
                type: "section",
                styles: {
                  paddingTop: "lg",
                  paddingBottom: "lg",
                  maxWidth: "narrow",
                  background: "surfaceDark",
                },
                children: [
                  {
                    id: "ownership-title",
                    type: "heading",
                    props: { level: 2, text: "Make it yours, with people in control." },
                  },
                  {
                    id: "ownership-copy",
                    type: "text",
                    props: {
                      text: "You own the deployment and database. Connect your preferred services when you are ready. AI can prepare supported changes for review; optional ChatGPT editor access requires an explicit owner connection.",
                    },
                  },
                  {
                    id: "ownership-link",
                    type: "button",
                    props: {
                      label: "Read the setup guide",
                      href: "/docs/self-hosting",
                      variant: "secondary",
                    },
                  },
                ],
              },
              {
                id: "start",
                type: "section",
                styles: { paddingTop: "lg", paddingBottom: "xl", maxWidth: "narrow" },
                children: [
                  {
                    id: "start-cta",
                    type: "ctaBand",
                    props: {
                      heading: "Your next chapter starts here.",
                      body: "Sign in to configure your business and customize this page. Exploring first? The fictional demo needs no credentials and sends nothing to real customers.",
                      cta: { label: "Open your workspace", href: "/admin" },
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  });
}
