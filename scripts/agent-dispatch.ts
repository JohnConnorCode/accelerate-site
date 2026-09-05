#!/usr/bin/env tsx
/** Scoped HTTP adapter. No database credentials, implicit force, or worktree deletion. */
import type { FeatureRequest } from "../src/lib/feature-board";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
async function main() {
  const [command = "status", ...args] = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++)
    if (args[i]?.startsWith("--")) {
      const key = args[i]!.slice(2);
      flags[key] = args[i + 1]?.startsWith("--") || !args[i + 1] ? "true" : args[++i]!;
    }
  if (flags.force)
    throw new Error(
      "Force bypasses are not supported. Ask an operator to review/recover the claim.",
    );
  const endpoint = new URL(
    "/api/agent/work-board",
    process.env.WORK_BOARD_URL ?? "http://localhost:3010",
  );
  if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname))
    throw new Error("Remote agents require HTTPS");
  const token = process.env.WORK_BOARD_TOKEN;
  if (!token)
    throw new Error(
      "Set WORK_BOARD_URL and a scoped WORK_BOARD_TOKEN issued in the founder admin. Database credentials are not used.",
    );
  async function request(path = "", body?: unknown) {
    const response = await fetch(`${endpoint}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `Work request failed (${response.status})`);
    return data;
  }
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const common = resolve(
    root,
    execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim(),
  );
  const sessionDir = resolve(common, "work-board-sessions");
  mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
  let card: FeatureRequest | undefined;
  if (flags.card) {
    const result = await request(`?key=${encodeURIComponent(flags.card)}`);
    card = result.features[0];
    if (!card && /^[a-f0-9-]{36}$/.test(flags.card))
      card = (await request(`?id=${flags.card}`)).features[0];
    if (!card) throw new Error("Card not found in this credential's project scope");
  }
  if (command === "status") {
    let offset: number | null = 0;
    while (offset !== null) {
      const result = await request(`?offset=${offset}&limit=250`);
      console.log(
        JSON.stringify(
          result.features.map((c: Record<string, unknown>) => ({
            id: c.id,
            key: c.seed_key,
            title: c.title,
            status: c.status,
            readiness: c.readiness,
            revision: c.revision,
            lease: c.lease_expires_at,
          })),
          null,
          2,
        ),
      );
      offset = result.nextOffset;
    }
  } else if (command === "next") {
    const requestKey = flags["request-key"] ?? randomUUID();
    const pendingPath = resolve(sessionDir, `pending-${requestKey}.json`);
    const session = existsSync(pendingPath)
      ? JSON.parse(readFileSync(pendingPath, "utf8"))
      : { claimToken: randomBytes(32).toString("base64url"), requestKey };
    writeFileSync(pendingPath, JSON.stringify(session), { mode: 0o600 });
    const result = await request("", {
      operation: "claim",
      ...(card ? { id: card.id } : {}),
      requestKey,
      payload: { claimToken: session.claimToken },
    });
    card = result.card;
    writeFileSync(resolve(sessionDir, `${card!.id}.json`), JSON.stringify(session), {
      mode: 0o600,
    });
    if (!flags["no-worktree"]) {
      const repo = card!.work_spec?.repository as
        { baseCommit: string; baseBranch: string } | undefined;
      if (!repo?.baseCommit || !repo?.baseBranch)
        throw new Error(
          `Claim retained; repository base commit/branch missing. Complete the card contract before creating a worktree. Card ${card!.id}`,
        );
      const base = execFileSync("git", ["rev-parse", "--verify", `${repo.baseCommit}^{commit}`], {
        encoding: "utf8",
      }).trim();
      execFileSync("git", ["merge-base", "--is-ancestor", base, repo.baseBranch]);
      const path = resolve(root, "..", ".agent-worktrees", String(card!.seed_key ?? card!.id));
      const branch = `agent/${card!.seed_key ?? card!.id}`;
      if (existsSync(path)) {
        const actual = execFileSync("git", ["-C", path, "branch", "--show-current"], {
          encoding: "utf8",
        }).trim();
        if (actual !== branch)
          throw new Error(
            "Existing worktree belongs to another branch; claim retained for inspection",
          );
        execFileSync("git", ["-C", path, "merge-base", "--is-ancestor", base, "HEAD"]);
      } else
        execFileSync("git", ["worktree", "add", "-b", branch, path, base], { stdio: "inherit" });
      console.log(`Worktree: ${path}`);
    }
    console.log(JSON.stringify(card, null, 2));
  } else {
    if (!card) throw new Error("--card is required");
    const sessionPath = resolve(sessionDir, `${card.id}.json`);
    const session = JSON.parse(readFileSync(sessionPath, "utf8"));
    const operation = command === "complete" ? "submit" : command;
    const payload: Record<string, unknown> = { claimToken: session.claimToken };
    if (["progress", "block"].includes(operation)) payload.message = flags.message;
    if (operation === "submit") {
      if (!flags["evidence-file"])
        throw new Error(
          "--evidence-file is required: JSON summary, exact commitSha and passing checks with evidence. Completion submits for review and preserves your worktree.",
        );
      payload.evidence = JSON.parse(readFileSync(flags["evidence-file"], "utf8"));
    }
    const requestKey = flags["request-key"] ?? randomUUID();
    console.log(
      JSON.stringify(
        await request("", { operation, id: card.id, revision: card.revision, requestKey, payload }),
        null,
        2,
      ),
    );
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Work command failed");
  process.exitCode = 1;
});
