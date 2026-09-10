#!/usr/bin/env tsx
/** Local operator driver for the canonical work-board service (matches the
 * in-review local-operator transport). Reuses listWorkBoard/mutateWorkBoard. */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listWorkBoard, mutateWorkBoard, type WorkActor } from "../src/lib/revenue-os/work-board";

async function main() {
  for (const envFile of [".env.agent.local", ".env.local"])
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  const [command = "status", ...args] = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++)
    if (args[i]?.startsWith("--")) {
      const key = args[i]!.slice(2);
      flags[key] = args[i + 1] && !args[i + 1]!.startsWith("--") ? args[++i]! : "true";
    }

  const project = flags.project ?? "accelerate";
  // The local operator is an owner-operated transport; declare its real
  // capabilities so cards with requiredCapabilities (e.g. typescript,
  // postgres) can be claimed without inventing a bypass.
  const capabilities = (flags.capabilities ?? "typescript,postgres")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const actor: WorkActor = {
    id: `operator:local:${project}`,
    projects: [project],
    scopes: ["read", "claim", "heartbeat", "progress", "block", "release", "submit"],
    reviewer: false,
    capabilities,
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key)
    throw new Error("Local operator mode requires Supabase URL and service-role key");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const sessionDir = resolve(".git/work-board-sessions", `local-${project}`);
  mkdirSync(sessionDir, { recursive: true, mode: 0o700 });

  async function cards(seedKey?: string, id?: string) {
    const rows = await listWorkBoard(db, actor, {
      ...(seedKey ? { seedKey } : {}),
      ...(id ? { id } : {}),
      limit: 250,
    });
    return rows.features;
  }
  function save(path: string, value: unknown) {
    writeFileSync(resolve(sessionDir, path), JSON.stringify(value), { mode: 0o600 });
  }

  const card = flags.card
    ? (await cards(flags.card))[0] ?? (await cards(undefined, flags.card))[0]
    : undefined;
  if (flags.card && !card) throw new Error("Card not found");

  if (command === "status") {
    const rows = await cards();
    for (const c of rows)
      console.log(
        `${c.seed_key ?? c.id} | ${c.status} | ${c.title}\n  ${(c.readiness ?? []).join(", ") || "ready"}`,
      );
  } else if (command === "show") {
    if (!card) throw new Error("--card required");
    console.log(JSON.stringify(card, null, 2));
  } else if (command === "claim") {
    if (!card) throw new Error("--card required");
    const requestKey = flags["request-key"] ?? randomUUID();
    const session = existsSync(resolve(sessionDir, `${card.id}.json`))
      ? JSON.parse(readFileSync(resolve(sessionDir, `${card.id}.json`), "utf8"))
      : { claimToken: randomBytes(32).toString("base64url"), requestKey };
    save(`${card.id}.json`, session);
    const result = await mutateWorkBoard(db, actor, {
      operation: "claim",
      id: card.id,
      revision: card.revision,
      requestKey: session.requestKey,
      payload: { claimToken: session.claimToken },
    });
    save(`${card.id}.packet.json`, result.card);
    console.log(JSON.stringify(result.card, null, 2));
  } else {
    if (!card) throw new Error("--card required");
    const session = JSON.parse(readFileSync(resolve(sessionDir, `${card.id}.json`), "utf8"));
    const operation = command === "complete" ? "submit" : command;
    const payload: Record<string, unknown> = { claimToken: session.claimToken };
    if (["progress", "block"].includes(operation)) {
      if (!flags.message) throw new Error("--message required");
      payload.message = flags.message;
    }
    if (operation === "submit") {
      if (!flags["evidence-file"]) throw new Error("--evidence-file required");
      payload.evidence = JSON.parse(readFileSync(flags["evidence-file"], "utf8"));
    }
    const result = await mutateWorkBoard(db, actor, {
      operation,
      id: card.id,
      revision: card.revision,
      requestKey: flags["request-key"] ?? randomUUID(),
      payload,
    });
    console.log(JSON.stringify(result, null, 2));
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Work command failed");
  process.exitCode = 1;
});