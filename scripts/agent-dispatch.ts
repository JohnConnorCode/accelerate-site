#!/usr/bin/env tsx
/**
 * Feature Board dispatcher: atomic claim + context bundle for a coding agent
 * working this codebase (Claude Code session, subagent, or human). Replaces
 * the manual "edit owner/status in feature-backlog-data.mjs, run
 * seed:features -- --apply" protocol in docs/contributing/AGENT-TICKET-RUNBOOK.md
 * with a real claim: migrations/20260903-feature-request-claims.sql's
 * claim_feature_request RPC (advisory lock + FOR UPDATE SKIP LOCKED + lease
 * expiry + stale-claim recovery + WIP-limit gate), wrapped by
 * src/lib/revenue-os/feature-board-claims.ts.
 *
 * This runs as a plain Node process (no Next.js request scope), so it
 * authenticates with SUPABASE_SERVICE_ROLE_KEY directly, the same pattern as
 * scripts/revenue-os-mcp.ts. feature_requests has no tenant_id column (the
 * Feature Board is platform-global), so there is no tenant context to
 * resolve — that's what makes a direct RPC call safe here.
 *
 * Usage:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts next [--card <seedKeyOrId>] [--identity <name>] [--no-worktree]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts status
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts heartbeat --card <id> [--identity <name>]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts release --card <id> [--identity <name>]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts complete --card <id> --evidence "<text>" [--identity <name>]
 *
 * Or via the npm scripts: agent:next, agent:status, agent:heartbeat, agent:release, agent:complete.
 *
 * `next` also creates a dedicated git worktree at
 * ../.agent-worktrees/<seed_key> (sibling to this repo, so it's outside any
 * git tree of its own) on branch agent/<seed_key>, off the current HEAD —
 * concurrent agents each work an isolated checkout instead of colliding in
 * this one. `complete` removes it (the card shipped, nothing left to
 * inspect); `release` leaves it in place so the abandoned work is still
 * there to look at or hand off. Pass --no-worktree to skip creation, e.g.
 * when this script itself is what you're claiming a card to edit.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceRoleClient } from "../src/lib/supabase/server";
import { accelerateSystemContext } from "../src/lib/tenancy/context";
import {
  claimFeatureCard,
  completeFeatureCard,
  getFeatureCardContext,
  listClaimableFeatureCards,
  releaseFeatureCard,
  renewFeatureCardLease,
  type FeatureRequestCard,
} from "../src/lib/revenue-os/feature-board-claims";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const worktreeRoot = resolve(repoRoot, "..", ".agent-worktrees");

function branchExists(branch: string): boolean {
  try {
    execFileSync("git", ["-C", repoRoot, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function createWorktree(seedKey: string): string {
  const path = resolve(worktreeRoot, seedKey);
  const branch = `agent/${seedKey}`;
  if (existsSync(path)) return path;
  const args = branchExists(branch)
    ? ["worktree", "add", path, branch]
    : ["worktree", "add", path, "-b", branch];
  execFileSync("git", ["-C", repoRoot, ...args], { stdio: "inherit" });
  return path;
}

function removeWorktree(seedKey: string) {
  const path = resolve(worktreeRoot, seedKey);
  if (!existsSync(path)) return;
  try {
    execFileSync("git", ["-C", repoRoot, "worktree", "remove", path, "--force"], { stdio: "inherit" });
  } catch (err) {
    process.stderr.write(
      `[agent-dispatch] could not remove worktree at ${path}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

function parseFlags(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith("--")) {
        flags[key] = value;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  }
  return flags;
}

function defaultIdentity(): string {
  return process.env.AGENT_IDENTITY?.trim() || `claude-code:${process.env.USER ?? "unknown"}:${process.pid}`;
}

function printCard(card: FeatureRequestCard) {
  const lines = [
    `\n=== ${card.title} (${card.seed_key ?? card.id}) ===`,
    `status: ${card.status}   priority: ${card.priority}   labels: ${card.labels.join(", ")}`,
    card.lease_owner
      ? `claimed by: ${card.lease_owner}   lease expires: ${card.lease_expires_at}`
      : "unclaimed",
    "",
    "-- description --",
    card.description ?? "(none)",
    "",
    "-- acceptance criteria --",
    card.acceptance_criteria ?? "(none)",
    "",
    "-- notes (dependencies, starting points, guardrails, verification, evidence) --",
    card.notes ?? "(none)",
    "",
  ];
  process.stdout.write(lines.join("\n") + "\n");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const identity = flags.identity ?? defaultIdentity();
  const supabase = createServiceRoleClient(accelerateSystemContext("agent-dispatch"));

  if (command === "next") {
    const cardRef = flags.card;
    const looksLikeUuid = cardRef ? /^[0-9a-f-]{36}$/i.test(cardRef) : false;
    const result = await claimFeatureCard(supabase, {
      seedKey: cardRef && !looksLikeUuid ? cardRef : undefined,
      id: cardRef && looksLikeUuid ? cardRef : undefined,
      leaseOwner: identity,
    });
    if (!result.claimed) {
      process.stdout.write(
        `Claim failed: ${result.existingStatus}${result.recoveredStale ? " (a stale lease was recovered elsewhere on the board this call)" : ""}\n`,
      );
      if (result.existingStatus === "wip_limit_reached") {
        process.stdout.write("The board is at its WIP limit. Run `agent:status` to see what's in progress.\n");
      } else if (result.existingStatus === "none_available") {
        process.stdout.write("No dependency-ready backlog/planned card is available to claim right now.\n");
      }
      process.exitCode = 1;
      return;
    }
    const card = await getFeatureCardContext(supabase, { id: result.id! });
    if (!card) throw new Error("Claimed a card but could not read it back");
    process.stdout.write(`Claimed as ${identity}${result.recoveredStale ? " (recovered a stale lease elsewhere on the board first)" : ""}.\n`);
    printCard(card);

    let worktreePath: string | null = null;
    if (flags["no-worktree"] !== "true" && card.seed_key) {
      try {
        worktreePath = createWorktree(card.seed_key);
        process.stdout.write(`\nWorktree ready: ${worktreePath}  (branch agent/${card.seed_key})\ncd ${worktreePath}\n`);
      } catch (err) {
        process.stdout.write(
          `\nCould not create a worktree (working in the current checkout instead): ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }

    process.stdout.write(
      `\nRenew the lease periodically: npm run agent:heartbeat -- --card ${card.id} --identity "${identity}"\n` +
        `When done: npm run agent:complete -- --card ${card.id} --identity "${identity}" --evidence "<what you verified>"\n` +
        `To abandon without shipping: npm run agent:release -- --card ${card.id} --identity "${identity}"\n`,
    );
    return;
  }

  if (command === "heartbeat") {
    if (!flags.card) throw new Error("--card is required");
    const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(flags.card);
    const id = looksLikeUuid ? flags.card : (await getFeatureCardContext(supabase, { seedKey: flags.card }))?.id;
    if (!id) {
      process.stdout.write(`No card found for "${flags.card}".\n`);
      process.exitCode = 1;
      return;
    }
    const ok = await renewFeatureCardLease(supabase, { id, leaseOwner: identity });
    process.stdout.write(ok ? `Lease renewed for ${flags.card}.\n` : `Could not renew — not leased by ${identity}, or not in_progress?\n`);
    if (!ok) process.exitCode = 1;
    return;
  }

  if (command === "status") {
    const claimable = await listClaimableFeatureCards(supabase, { limit: 20 });
    process.stdout.write(
      `\n${claimable.length} dispatchable card(s) (backlog/planned, no active lease, milestone:now|next — what \`agent:next\` would actually pick from):\n`,
    );
    for (const card of claimable) {
      process.stdout.write(`  [${card.priority}] ${card.seed_key ?? card.id} — ${card.title}\n`);
    }
    return;
  }

  if (command === "release" || command === "complete") {
    if (!flags.card) throw new Error("--card is required");
    if (command === "complete" && !flags.evidence) throw new Error("--evidence is required");
    const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(flags.card);
    const card = looksLikeUuid
      ? await getFeatureCardContext(supabase, { id: flags.card })
      : await getFeatureCardContext(supabase, { seedKey: flags.card });
    if (!card) {
      process.stdout.write(`No card found for "${flags.card}".\n`);
      process.exitCode = 1;
      return;
    }
    const ok =
      command === "release"
        ? await releaseFeatureCard(supabase, { id: card.id, leaseOwner: identity })
        : await completeFeatureCard(supabase, { id: card.id, leaseOwner: identity, evidence: flags.evidence! });
    if (!ok) {
      process.stdout.write(`Could not ${command} ${flags.card} — not leased by ${identity}?\n`);
      process.exitCode = 1;
      return;
    }
    if (command === "complete" && card.seed_key && flags["no-worktree"] !== "true") {
      removeWorktree(card.seed_key);
      process.stdout.write(`Marked shipped: ${flags.card}. Worktree removed.\n`);
    } else if (command === "release" && card.seed_key) {
      const path = resolve(worktreeRoot, card.seed_key);
      process.stdout.write(
        `Released ${flags.card}.` + (existsSync(path) ? ` Worktree left in place at ${path} for inspection.\n` : "\n"),
      );
    } else {
      process.stdout.write(`${command === "release" ? "Released" : "Marked shipped:"} ${flags.card}.\n`);
    }
    return;
  }

  process.stderr.write(
    "Usage: agent-dispatch <next|status|heartbeat|release|complete> [--card <id>] [--identity <name>] [--evidence <text>] [--no-worktree]\n",
  );
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`[agent-dispatch] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
