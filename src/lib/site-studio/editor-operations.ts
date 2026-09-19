import { parseWebsiteDocument, type WebsiteDocument } from "./website-document";
import { createWebsitePage } from "./website-authoring";
import { parseWebsiteCommand, type WebsiteCommand } from "./website-commands";
import { siteEditorCommandSchema, type SiteEditorCommand } from "./editor-contract";

function put<T extends { id: string }>(items: T[], value: T): T[] {
  return items.some((item) => item.id === value.id)
    ? items.map((item) => (item.id === value.id ? value : item))
    : [...items, value];
}
function remove<T extends { id: string }>(items: T[], id: string): T[] {
  if (!items.some((item) => item.id === id)) throw new Error("The item to remove is unavailable");
  return items.filter((item) => item.id !== id);
}
/** Pure editor transformation. The final document validator checks cross-item
 * references, route ownership and size after all changes are applied together. */
export function applySiteEditorCommand(
  website: WebsiteDocument,
  raw: SiteEditorCommand,
): WebsiteCommand {
  const input = siteEditorCommandSchema.parse(raw);
  if (input.operation !== "edit") return parseWebsiteCommand(input);
  let next = structuredClone(website);
  for (const change of input.changes) {
    switch (change.kind) {
      case "create_page":
        if (next.pages.some((page) => page.id === change.id))
          throw new Error("Page identity already exists");
        next.pages.push(createWebsitePage(next, change));
        break;
      case "put_page":
        next.pages = put(next.pages, change.page);
        break;
      case "remove_page":
        next.pages = remove(next.pages, change.id);
        break;
      case "put_asset":
        next.assets = put(next.assets, change.asset);
        break;
      case "remove_asset":
        next.assets = remove(next.assets, change.id);
        break;
      case "put_collection":
        next.collections = put(next.collections, change.collection);
        break;
      case "remove_collection":
        next.collections = remove(next.collections, change.id);
        break;
      case "put_entry":
      case "remove_entry": {
        const collection = next.collections.find((item) => item.id === change.collectionId);
        if (!collection) throw new Error("Collection is unavailable");
        collection.entries =
          change.kind === "put_entry"
            ? put(collection.entries, change.entry)
            : remove(collection.entries, change.id);
        break;
      }
      case "configure": {
        const configuration = Object.fromEntries(
          Object.entries(change).filter(([key]) => key !== "kind"),
        );
        next = { ...next, ...configuration };
        break;
      }
    }
  }
  return parseWebsiteCommand({
    operation: "save",
    requestKey: input.requestKey,
    expectedVersion: input.expectedVersion,
    document: parseWebsiteDocument(next),
  });
}
