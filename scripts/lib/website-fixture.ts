import {
  parseWebsiteDocument,
  type WebsiteDocument,
} from "../../src/lib/site-studio/website-document";
export const websiteFixture: WebsiteDocument = parseWebsiteDocument({
  schemaVersion: 1,
  identity: { name: "Northstar Workshop", tagline: "Practical repairs" },
  navigation: [{ label: "Home", href: "/" }],
  footer: { text: "Local workshop", links: [] },
  theme: {
    accent: "#123456",
    background: "#ffffff",
    foreground: "#111111",
    font: "installation",
    radius: "soft",
  },
  assets: [{ id: "workshop", src: "/images/workshop.jpg", alt: "Workshop" }],
  pages: [
    {
      id: "home",
      path: "/",
      metadata: { title: "Workshop", description: "Book a repair", noIndex: false },
      content: {
        kind: "article",
        body: [
          {
            type: "paragraph",
            content: [{ text: "<script>alert(1)</script> stays literal text" }],
          },
        ],
      },
    },
  ],
  collections: [],
});
