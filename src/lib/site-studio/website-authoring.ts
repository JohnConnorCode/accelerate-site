import { parseWebsiteDocument, type WebsiteDocument, type WebsitePage } from "./website-document";
import { servicePageTemplate, servicePageSlug } from "./templates";

export const WEBSITE_STARTERS = [
  { id: "service", name: "Service page", detail: "Hero, benefits, questions and a next step." },
  { id: "landing", name: "Landing page", detail: "A focused introduction and call to action." },
  { id: "article", name: "Article", detail: "A clean page for writing and images." },
] as const;
export type WebsiteStarter = (typeof WEBSITE_STARTERS)[number]["id"];
export function createWebsitePage(
  website: WebsiteDocument,
  input: { title: string; path: string; starter: WebsiteStarter; cloneId?: string },
): WebsitePage {
  const source = input.cloneId
    ? website.pages.find((page) => page.id === input.cloneId)
    : undefined;
  if (input.cloneId && !source) throw new Error("The page to clone is no longer available.");
  const title = input.title.trim();
  const id = `page-${crypto.randomUUID().slice(0, 12)}`;
  const document = servicePageTemplate({
    serviceName: title,
    audience: website.identity.name,
    outcome: "Describe the result your customers can expect.",
  });
  if (input.starter === "landing")
    document.root = [document.root[0]!, document.root[document.root.length - 1]!];
  const page: WebsitePage = {
    id,
    path: input.path.trim(),
    metadata: { title, description: "", noIndex: false },
    content: source
      ? structuredClone(source.content)
      : input.starter === "article"
        ? {
            kind: "article",
            body: [{ type: "paragraph", content: [{ text: "Write your introduction here." }] }],
          }
        : { kind: "document", document },
  };
  parseWebsiteDocument({ ...website, pages: [...website.pages, page] });
  return page;
}
export function suggestedWebsitePath(website: WebsiteDocument, title: string): string {
  const base = "/" + servicePageSlug(title);
  const occupied = new Set(
    [...website.pages, ...website.collections.flatMap((c) => c.entries)].map((page) => page.path),
  );
  let path = base;
  for (let i = 2; occupied.has(path); i++) path = `${base}-${i}`;
  return path;
}

/** Model edits address a server enumerated text field. IDs, links, paths,
 * component kinds, layout and sibling pages cannot be changed by a text edit. */
export function websiteTextFields(page: WebsitePage): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  const protectedKeys = new Set([
    "id",
    "path",
    "kind",
    "type",
    "template",
    "href",
    "src",
    "assetId",
    "imageAssetId",
    "schemaVersion",
    "engine",
    "engineVersion",
    "slug",
    "font",
    "radius",
    "theme",
    "variant",
    "language",
    "presentation",
    "fit",
    "canvas",
    "background",
    "paddingTop",
    "paddingBottom",
    "maxWidth",
    "gap",
    "align",
    "tone",
  ]);
  function visit(value: unknown, path: string[]) {
    if (fields.length >= 300) return;
    if (typeof value === "string") {
      if (value.length <= 20000) fields.push({ key: path.join("."), value });
      return;
    }
    if (Array.isArray(value)) value.forEach((item, i) => visit(item, [...path, String(i)]));
    else if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value))
        if (!protectedKeys.has(key)) visit(item, [...path, key]);
  }
  visit(page, []);
  return fields;
}
export function applyWebsiteTextEdits(
  page: WebsitePage,
  edits: { field: string; text: string }[],
): WebsitePage {
  const allowed = new Set(websiteTextFields(page).map((field) => field.key));
  const seen = new Set<string>();
  const next = structuredClone(page);
  for (const edit of edits) {
    if (!allowed.has(edit.field) || seen.has(edit.field))
      throw new Error("AI suggested an unknown or duplicate text field.");
    seen.add(edit.field);
    const path = edit.field.split(".");
    let target: unknown = next;
    for (const key of path.slice(0, -1)) target = (target as Record<string, unknown>)[key];
    (target as Record<string, unknown>)[path[path.length - 1]!] = edit.text;
  }
  return next;
}
