import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getTenantRequestContext } from "@/lib/tenancy/context";
import { proposeAction } from "@/lib/revenue-os/actions";
import { websiteAiInput, proposeWebsitePage } from "./website-ai";
import { getSiteModelCatalog } from "./model-catalog";
import {
  siteEditorCommandSchema,
  siteEditorPrepareSchema,
  siteEditorReadSchema,
  siteEditorStageSchema,
} from "./editor-contract";
import { websiteDocumentSchema, websitePageSchema } from "./website-document";
import { applySiteEditorCommand } from "./editor-operations";
import { createBundledWebsite } from "./website-seed";
import {
  assertWebsiteOwner,
  readWebsite,
  readWebsiteHistory,
  readWebsiteReceipts,
  readWebsiteRevision,
  wasWebsiteRevisionPublished,
  writeWebsite,
  WebsiteConflictError,
} from "./website-store";
import { parseWebsiteCommand } from "./website-commands";

export function siteEditorActor() {
  const actor = getTenantRequestContext();
  if (actor?.kind !== "actor")
    throw new Error("Sign in as the installation owner to use Site Studio");
  assertWebsiteOwner(actor);
  return actor;
}
export function websiteCommandDigest(command: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(parseWebsiteCommand(command)))
    .digest("hex");
}
function exactDiff(
  before: unknown,
  after: unknown,
  path = "$",
): { path: string; before: unknown; after: unknown }[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === "object" && typeof after === "object") {
    const left = before as Record<string, unknown>,
      right = after as Record<string, unknown>;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap((key) =>
      exactDiff(left[key], right[key], `${path}.${key}`),
    );
  }
  return [{ path, before: before ?? null, after: after ?? null }];
}
export async function readSiteEditor(raw: unknown) {
  const auth = siteEditorActor();
  const input = siteEditorReadSchema.parse(raw);
  if (input.view === "schema")
    return z.toJSONSchema(
      {
        command: siteEditorCommandSchema,
        page: websitePageSchema,
        document: websiteDocumentSchema,
        ai: websiteAiInput,
      }[input.schema],
      { io: "input" },
    );
  if (input.view === "models") return getSiteModelCatalog();
  if (input.view === "history") {
    const revisions = await readWebsiteHistory(auth, input.offset, input.limit);
    return {
      revisions,
      nextOffset: revisions.length === input.limit ? input.offset + input.limit : null,
    };
  }
  if (input.view === "receipts")
    return { receipts: await readWebsiteReceipts(auth, input.offset, input.limit) };
  const state = await readWebsite(auth);
  const document = input.revisionId
    ? await readWebsiteRevision(auth, input.revisionId)
    : input.state === "draft"
      ? (state.draft?.document ?? createBundledWebsite())
      : state.publishedRevisionId
        ? await readWebsiteRevision(auth, state.publishedRevisionId)
        : null;
  if (!document)
    return {
      version: state.version,
      published: false,
      message:
        "No saved published revision. A never-published installation may still serve its bundled website.",
    };
  const list = <T>(items: T[]) => ({
    items: items.slice(input.offset, input.offset + input.limit),
    total: items.length,
    nextOffset: input.offset + input.limit < items.length ? input.offset + input.limit : null,
  });
  let content: unknown;
  switch (input.view) {
    case "pages":
      content = list(
        document.pages.map(({ id, path, metadata, content }) => ({
          id,
          path,
          metadata,
          kind: content.kind,
        })),
      );
      break;
    case "page":
      content = document.pages.find((page) => page.id === input.id);
      break;
    case "assets":
      content = list(document.assets);
      break;
    case "collections":
      content = list(
        document.collections.map(({ id, title, entries }) => ({
          id,
          title,
          entryCount: entries.length,
        })),
      );
      break;
    case "collection": {
      const collection = document.collections.find((item) => item.id === input.id);
      content = collection && {
        id: collection.id,
        title: collection.title,
        ...list(collection.entries),
      };
      break;
    }
    case "entry":
      content = document.collections
        .find((item) => item.id === input.collectionId)
        ?.entries.find((item) => item.id === input.id);
      break;
    case "configuration": {
      content = Object.fromEntries(
        Object.entries(document).filter(
          ([key]) => !["pages", "collections", "assets"].includes(key),
        ),
      );
      break;
    }
    case "export": {
      const serialized = JSON.stringify(document);
      const end = input.offset + 64_000;
      content = {
        text: serialized.slice(input.offset, end),
        nextOffset: end < serialized.length ? end : null,
        totalCharacters: serialized.length,
      };
      break;
    }
  }
  if (!content) throw new Error("The requested website item is unavailable");
  if (Buffer.byteLength(JSON.stringify(content)) > 256_000)
    throw new Error("This item exceeds the bounded read limit. Use export chunks.");
  return {
    version: state.version,
    draftRevisionId: state.draft?.id ?? null,
    publishedRevisionId: state.publishedRevisionId,
    state: input.state,
    content,
  };
}

export async function prepareSiteChange(raw: unknown) {
  const auth = siteEditorActor();
  const input = siteEditorPrepareSchema.parse(raw);
  const state = await readWebsite(auth);
  if (input.command.expectedVersion !== state.version)
    throw new WebsiteConflictError(
      "The website changed. Read the current version before preparing changes.",
    );
  const previous = state.draft?.document ?? createBundledWebsite();
  const command = applySiteEditorCommand(previous, input.command);
  if (command.operation === "publish" && command.revisionId !== state.draft?.id)
    throw new Error("Publish requires the current saved draft");
  if (
    command.operation === "rollback" &&
    !(await wasWebsiteRevisionPublished(auth, command.revisionId))
  )
    throw new Error("Choose a previously published revision from history");
  const diff =
    command.operation === "save"
      ? exactDiff(previous, command.document)
      : [
          {
            path: "$.publishedRevisionId",
            before: state.publishedRevisionId,
            after: "revisionId" in command ? command.revisionId : null,
          },
        ];
  if (Buffer.byteLength(JSON.stringify(diff)) > 256_000)
    throw new Error(
      "This exact preview exceeds 256 KB. Split the change into smaller commands or review the import in the editor.",
    );
  const changes: string[] = [];
  if (command.operation === "save") {
    for (const key of [
      "identity",
      "theme",
      "navigation",
      "header",
      "footer",
      "dock",
      "assets",
      "pages",
      "collections",
    ] as const) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(command.document[key]))
        changes.push(key);
    }
  } else changes.push(command.operation);
  const summary =
    command.operation === "save"
      ? `Save a private website draft. Changed: ${changes.join(", ") || "no content changes"}. Nothing is published.`
      : `${command.operation === "unpublish" ? "Unpublish the website" : command.operation === "rollback" ? "Restore a previously published website revision" : "Publish the current saved website draft"}${"revisionId" in command ? ` (${command.revisionId})` : ""}.`;
  return {
    command,
    digest: websiteCommandDigest(command),
    summary,
    changes,
    diff,
    version: state.version,
  };
}
export async function previewSiteChange(raw: unknown) {
  const { command, ...preview } = await prepareSiteChange(raw);
  return {
    ...preview,
    operation: command.operation,
    previewUrl: "/admin/site/website",
    requiresConfirmation: true,
  };
}
export async function stageSiteChange(raw: unknown) {
  const auth = siteEditorActor();
  const input = siteEditorStageSchema.parse(raw);
  const prepared = await prepareSiteChange({ command: input.command });
  if (input.digest !== prepared.digest)
    throw new Error("Website preview changed. Prepare it again before staging.");
  const action = await proposeAction(auth.database, {
    actionType: "site_website_change",
    title: prepared.summary,
    description: prepared.summary,
    payload: {
      tenantId: auth.tenant.id,
      command: prepared.command,
      digest: prepared.digest,
      summary: prepared.summary,
    },
    sourceContext: "site-studio",
    entityType: "site_website",
    entityId: auth.tenant.id,
    dedupeKey: `site-website:${prepared.digest}`,
    proposedBy: auth.user.email ?? auth.user.id,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  return {
    id: action.id,
    action_type: action.action_type,
    digest: prepared.digest,
    summary: prepared.summary,
    operation: prepared.command.operation,
    expectedVersion: prepared.command.expectedVersion,
  };
}
export async function executeApprovedSiteChange(raw: Record<string, unknown>) {
  const auth = siteEditorActor();
  const command = parseWebsiteCommand(raw.command);
  if (raw.tenantId !== auth.tenant.id || websiteCommandDigest(command) !== raw.digest)
    throw new Error("Website approval does not match its exact preview");
  return writeWebsite(auth, command);
}
export async function suggestSitePage(raw: unknown) {
  return proposeWebsitePage(siteEditorActor(), websiteAiInput.parse(raw));
}
