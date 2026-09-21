import { trackEvent, trackConversion } from "../src/lib/analytics";
import { createBundledWebsite } from "../src/lib/site-studio/website-seed";
import { Studio } from "../src/components/v2/studio/Studio";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { WebsiteArticle, WebsitePageContent } from "../src/lib/site-studio/website-renderer";
import { parseWebsiteDocument } from "../src/lib/site-studio/website-document";
import {
  nativeTemplateDefaults,
  nativeTemplateSchemas,
} from "../src/lib/site-studio/native-templates";
import { renderNativeWebsiteSection } from "../src/lib/site-studio/native-renderer";
import { websiteFixture } from "./lib/website-fixture";

const html = renderToStaticMarkup(
  <WebsiteArticle
    body={[
      { type: "paragraph", content: [{ text: '<script>alert("x")</script>', bold: true }] },
      { type: "code", text: '<img src=x onerror="alert(1)">', language: "html" },
    ]}
    assets={[]}
  />,
);
assert.ok(html.includes("&lt;script&gt;"));
assert.ok(!html.includes("<script>"));
assert.ok(!html.includes("<img "));
for (const [template, fields] of Object.entries(nativeTemplateDefaults)) {
  assert.ok(nativeTemplateSchemas[template]?.safeParse(fields).success, template);
  const seedPage = websiteFixture.pages[0];
  assert.ok(seedPage);
  const document = parseWebsiteDocument({
    ...websiteFixture,
    pages: [
      { ...seedPage, content: { kind: "native", sections: [{ id: "example", template, fields }] } },
    ],
  });
  const page = document.pages[0];
  assert.ok(page);
  const output = renderToStaticMarkup(
    <WebsitePageContent
      page={page}
      assets={document.assets}
      renderNative={renderNativeWebsiteSection}
    />,
  );
  assert.ok(output.length > 0);
  if ("eyebrow" in fields) assert.ok(output.includes(fields.eyebrow));
}
const custom = renderToStaticMarkup(
  renderNativeWebsiteSection({
    id: "owner-copy",
    template: "home-who",
    hidden: false,
    fields: {
      ...nativeTemplateDefaults["home-who"],
      headingStart: "An independent workshop",
      body: "This installation owns its content.",
    },
  }),
);
assert.ok(custom.includes("An independent workshop"));
assert.ok(custom.includes("This installation owns its content."));
assert.ok(!custom.includes("Engineered by"));

assert.throws(
  () =>
    parseWebsiteDocument({
      ...websiteFixture,
      pages: [
        {
          ...websiteFixture.pages[0],
          content: {
            kind: "native",
            sections: [{ id: "bad", template: "unreviewed-code", fields: {} }],
          },
        },
      ],
    }),
  /Unknown template/,
);
assert.throws(
  () =>
    parseWebsiteDocument({
      ...websiteFixture,
      pages: [
        {
          ...websiteFixture.pages[0],
          content: {
            kind: "native",
            sections: [
              {
                id: "bad",
                template: "home-statement",
                fields: {
                  ...nativeTemplateDefaults["home-statement"],
                  systemsHref: "javascript:alert(1)",
                },
              },
            ],
          },
        },
      ],
    }),
  /invalid fields/,
);
console.log(
  "PASS: literal rich-text rendering, registered native defaults, template rejection and safe native links. This scoped SSR proof does not replace browser visual review.",
);

const bundled = createBundledWebsite();
const home = bundled.pages[0];
assert.ok(home);
assert.equal(
  renderToStaticMarkup(
    <WebsitePageContent
      page={home}
      assets={bundled.assets}
      renderNative={renderNativeWebsiteSection}
    />,
  ),
  renderToStaticMarkup(<Studio />),
  "Bundled homepage preserves the complete source-rendered layout",
);
console.log("PASS: all twelve homepage sections and hero grouping preserve bundled markup.");

assert.ok(
  renderToStaticMarkup(
    renderNativeWebsiteSection({
      id: "product",
      template: "home-command-center",
      hidden: false,
      fields: nativeTemplateDefaults["home-command-center"],
    }),
  ).includes('href="/demo/command-center"'),
  "Bundled product section renders the full admin demo link",
);

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalStorage = globalThis.sessionStorage;
const originalAnalyticsUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnalyticsKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let previewTrackingCalls = 0;
try {
  globalThis.fetch = async () => {
    previewTrackingCalls++;
    throw new Error("Preview attempted tracking");
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://workspace.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fixturepublic";
  for (const pathname of [
    "/site-preview",
    "/site-preview/nested",
    "/admin",
    "/admin/site/website",
    "/t/example/admin",
    "/demo/command-center/northline-roofing",
  ]) {
    Reflect.set(globalThis, "window", {
      location: { pathname },
      gtag: () => previewTrackingCalls++,
      fbq: () => previewTrackingCalls++,
    });
    trackEvent("Private preview click");
    trackConversion("Private preview conversion");
  }
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  Reflect.set(globalThis, "window", { location: { pathname: "/" } });
  trackEvent("Unconfigured homepage click");
  assert.equal(
    previewTrackingCalls,
    0,
    "Private preview interactions never count as public analytics or conversions",
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://workspace.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fixturepublic";
  Reflect.set(globalThis, "document", { referrer: "" });
  Reflect.set(globalThis, "sessionStorage", {
    getItem: () => "11111111-1111-4111-8111-111111111111",
  });
  globalThis.fetch = async (url, init) => {
    previewTrackingCalls++;
    assert.equal(url, "/api/analytics/events");
    const event = JSON.parse(String(init?.body));
    assert.equal(event.path, "/");
    assert.equal(event.name, "configured_homepage_click");
    return new Response(null, { status: 202 });
  };
  trackEvent("Configured homepage click");
  assert.equal(previewTrackingCalls, 1, "Configured public analytics remains enabled");
} finally {
  Reflect.set(globalThis, "window", originalWindow);
  globalThis.fetch = originalFetch;
  Reflect.set(globalThis, "document", originalDocument);
  Reflect.set(globalThis, "sessionStorage", originalStorage);
  if (originalAnalyticsUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalAnalyticsUrl;
  if (originalAnalyticsKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnalyticsKey;
}
