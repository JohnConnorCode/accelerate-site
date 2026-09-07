import { createClient } from "@supabase/supabase-js";
import {
  listWorkBoard,
  mutateWorkBoard,
  type WorkActor,
} from "../../src/lib/revenue-os/work-board";

/** Explicit owner-operated transport. It keeps the canonical lifecycle and never grants review. */
export function localWorkActor(project: string | undefined): WorkActor {
  if (!project || !/^[a-z0-9-]{1,80}$/.test(project))
    throw new Error(
      "Local operator setup requires a non-empty named project; wildcard project access is not supported.",
    );
  return {
    id: `operator:local:${project}`,
    projects: [project],
    scopes: ["read", "claim", "heartbeat", "progress", "block", "release", "submit"],
    reviewer: false,
    capabilities: [],
  };
}

export function localReadOptions(path: string) {
  const query = new URL(path || "?", "http://localhost").searchParams;
  return {
    ...(query.has("key") ? { seedKey: query.get("key")! } : {}),
    ...(query.has("id") ? { id: query.get("id")! } : {}),
    ...(query.has("offset") ? { offset: Number(query.get("offset")) } : {}),
    ...(query.has("limit") ? { limit: Number(query.get("limit")) } : {}),
  };
}

export function createLocalWorkRequest(project: string | undefined) {
  const actor = localWorkActor(project);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Local operator setup requires the existing local Supabase configuration; no credential is generated.",
    );
  const db = createClient(url, key, { auth: { persistSession: false } });
  return async (path = "", body?: unknown) =>
    body ? mutateWorkBoard(db, actor, body) : listWorkBoard(db, actor, localReadOptions(path));
}
