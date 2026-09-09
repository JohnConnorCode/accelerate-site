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
