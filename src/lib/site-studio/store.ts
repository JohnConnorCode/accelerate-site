import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { siteDraftSchema, type SiteDocument, type SiteDraft } from "./document";

/** Draft persistence for v1. File-backed repository behind an interface so a
 * Supabase adapter can replace it without touching callers. Drafts are
 * private working copies, never published output. Multi-tenant Supabase
 * storage arrives with the version/publish substrate card. */

export interface SiteDraftInput {
  title: string;
  slug: string;
  document: SiteDocument;
  source: "template" | "ai";
  brief?: string;
}

export interface SiteDraftRepository {
  list(): SiteDraft[];
  get(id: string): SiteDraft | null;
  save(input: SiteDraftInput): SiteDraft;
  /** Removes one draft by id. Returns true when a draft was removed. */
  remove(id: string): boolean;
}

export function draftChecksum(document: SiteDocument): string {
  return createHash("sha256").update(JSON.stringify(document)).digest("hex");
}

function now(): string {
  return new Date().toISOString();
}

export class FileSiteDraftRepository implements SiteDraftRepository {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
    mkdirSync(root, { recursive: true });
  }

  list(): SiteDraft[] {
    const drafts: SiteDraft[] = [];
    for (const name of readdirSync(this.root)) {
      if (!name.endsWith(".json")) continue;
      try {
        drafts.push(siteDraftSchema.parse(JSON.parse(readFileSync(join(this.root, name), "utf8"))));
      } catch {
        continue;
      }
    }
    return drafts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  get(id: string): SiteDraft | null {
    if (!/^[a-f0-9-]{1,80}$/.test(id)) return null;
    try {
      return siteDraftSchema.parse(
        JSON.parse(readFileSync(join(this.root, `${id}.json`), "utf8")),
      );
    } catch {
      return null;
    }
  }

  save(input: SiteDraftInput): SiteDraft {
    const existing = this.list().find((draft) => draft.slug === input.slug);
    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.createdAt ?? now();
    const draft = siteDraftSchema.parse({
      id,
      slug: input.slug,
      title: input.title,
      status: "draft",
      version: 1,
      document: input.document,
      source: input.source,
      brief: input.brief,
      createdAt,
      updatedAt: now(),
      checksum: draftChecksum(input.document),
    });
    const target = join(this.root, `${id}.json`);
    const staging = join(this.root, `${id}.json.tmp`);
    writeFileSync(staging, JSON.stringify(draft, null, 2) + "\n");
    renameSync(staging, target);
    return draft;
  }

  remove(id: string): boolean {
    if (!/^[a-f0-9-]{1,80}$/.test(id)) return false;
    try {
      unlinkSync(join(this.root, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  }
}

const DEFAULT_ROOT = join(process.cwd(), "site", "drafts");

let shared: FileSiteDraftRepository | null = null;

/** Server-side shared repository for admin routes. */
export function siteDrafts(root: string = DEFAULT_ROOT): FileSiteDraftRepository {
  if (root === DEFAULT_ROOT) {
    shared ??= new FileSiteDraftRepository(root);
    return shared;
  }
  return new FileSiteDraftRepository(root);
}
