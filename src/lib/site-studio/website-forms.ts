import "server-only";
import { readPublicForm } from "@/lib/revenue-os/form-builder";
import type { WebsiteDocument } from "./website-document";

export function websiteFormTokens(document: WebsiteDocument): string[] {
  return [
    ...new Set(
      document.pages.flatMap((page) =>
        page.content.kind === "document"
          ? page.content.document.root.flatMap((section) =>
              section.children.flatMap((node) => (node.type === "form" ? [node.props.token] : [])),
            )
          : [],
      ),
    ),
  ];
}

/** Reads use the existing bounded public-token owner, then bind to this
 * installation. No foreign form definition reaches a page or editor preview. */
export async function assertWebsiteForms(
  document: WebsiteDocument,
  tenantId: string,
  read = readPublicForm,
) {
  const tokens = websiteFormTokens(document);
  if (tokens.length > 8) throw new Error("A website can connect at most eight distinct forms");
  for (const token of tokens) {
    const form = await read(token);
    if (!form || form.tenantId !== tenantId)
      throw new Error(
        "Connect a published form from this workspace with Form Builder enabled, or remove its section before saving.",
      );
  }
}
