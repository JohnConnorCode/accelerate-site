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

/** Explicit offline fixture adapter. Production routes use database-store;
 * they never select a process-working-directory filesystem repository. */

export interface SiteDraftInput {
  id?: string;
  expectedChecksum?: string;
  title: string;
  slug: string;
  document: SiteDocument;
  source: "template" | "ai";
  brief?: string;
}

export interface SiteDraftRepository {
  list(): SiteDraft[] | Promise<SiteDraft[]>;
  get(id: string): SiteDraft | null | Promise<SiteDraft | null>;
  save(input: SiteDraftInput): SiteDraft | Promise<SiteDraft>;
  /** Removes one draft by id. Returns true when a draft was removed. */
  remove(id: string, expectedChecksum?: string): boolean | Promise<boolean>;
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
      return siteDraftSchema.parse(JSON.parse(readFileSync(join(this.root, `${id}.json`), "utf8")));
    } catch {
      return null;
    }
  }

  save(input: SiteDraftInput): SiteDraft {
    const existing = input.id
      ? this.get(input.id)
      : this.list().find((draft) => draft.slug === input.slug);
    if (input.id && (!existing || existing.checksum !== input.expectedChecksum))
      throw new Error("Stale draft");
    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.createdAt ?? now();
    const draft = siteDraftSchema.parse({
      id,
      slug: input.slug,
      title: input.title,
      status: "draft",
      version: (existing?.version ?? 0) + 1,
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
