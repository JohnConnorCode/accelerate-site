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
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts next [--card <seedKeyOrId>] [--identity <name>] [--no-worktree] [--force]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts status
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts heartbeat --card <id> [--identity <name>]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts release --card <id> [--identity <name>] [--force]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts complete --card <id> --evidence "<text>" [--identity <name>] [--force]
 *
 * Or via the npm scripts: agent:next, agent:status, agent:heartbeat, agent:release, agent:complete.
 *
 * This is coordination tooling, not an access lock — nothing stops anyone
 * with repo access from editing files without ever calling this script; the
 * claim just stops two *agents* from silently colliding on the same card.
 * A human operator (or anyone running with the service-role key, which this
 * script already requires) always has final authority: --force on
 * release/complete overrides a lease held by a different identity instead
 * of waiting up to 30 minutes for it to expire, and --force on `next`
 * bypasses the WIP limit for a claim you're explicitly directing. Every
 * override is written into the card's notes so it stays auditable.
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
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceRoleClient } from "../src/lib/supabase/server";
import { accelerateSystemContext } from "../src/lib/tenancy/context";
import {
  claimFeatureCard,
  completeFeatureCard,
  getFeatureCardContext,
  listActiveFeatureCards,
  listClaimableFeatureCards,
  releaseFeatureCard,
  renewFeatureCardLease,
  FEATURE_BOARD_WIP_LIMIT,
  type FeatureRequestCard,
} from "../src/lib/revenue-os/feature-board-claims";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const worktreeRoot = resolve(repoRoot, "..", ".agent-worktrees");

function branchExists(branch: string): boolean {
  try {
    execFileSync(
      "git",
      ["-C", repoRoot, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
      {
        stdio: "ignore",
      },
    );
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
    execFileSync("git", ["-C", repoRoot, "worktree", "remove", path, "--force"], {
      stdio: "inherit",
    });
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

function reconcileManifest() {
  // claim_feature_request also recovers any stale lease elsewhere on the
  // board (sets it to blocked) before it does anything else, so every
  // command below can change status/owner out from under
  // scripts/feature-backlog-data.mjs, not just the card being acted on.
  // Keep the manifest — and anything generated from it, like
  // docs/NORTHSTAR-BUILD-PLAN.md — from silently drifting off the live
  // board's truth.
  try {
    execFileSync("node", ["--env-file=.env.local", "scripts/reconcile-feature-manifest.mjs"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  } catch (err) {
    process.stderr.write(
      `[agent-dispatch] manifest reconcile failed (non-fatal): ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

function defaultIdentity(): string {
  return (
    process.env.AGENT_IDENTITY?.trim() ||
    `claude-code:${process.env.USER ?? "unknown"}:${process.pid}`
  );
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
    const force = flags.force === "true";
    const result = await claimFeatureCard(supabase, {
      seedKey: cardRef && !looksLikeUuid ? cardRef : undefined,
      id: cardRef && looksLikeUuid ? cardRef : undefined,
      leaseOwner: identity,
      // --force bypasses the WIP limit for a claim you're explicitly
      // directing. It does not bypass the milestone filter on auto-pick —
      // pass --card for a specific card regardless of milestone.
      wipLimit: force ? 2_147_483_647 : undefined, // p_wip_limit is a Postgres INTEGER; this is its max, effectively "no limit"
    });
    if (!result.claimed) {
      process.stdout.write(
        `Claim failed: ${result.existingStatus}${result.recoveredStale ? " (a stale lease was recovered elsewhere on the board this call)" : ""}\n`,
      );
      if (result.existingStatus === "wip_limit_reached") {
        process.stdout.write(
          "The board is at its WIP limit. Run `agent:status` to see what's in progress, or add --force to claim anyway.\n",
        );
      } else if (result.existingStatus === "none_available") {
        process.stdout.write(
          "No dependency-ready backlog/planned card is available to claim right now.\n",
        );
      }
      process.exitCode = 1;
      return;
    }
    const card = await getFeatureCardContext(supabase, { id: result.id! });
    if (!card) throw new Error("Claimed a card but could not read it back");
    process.stdout.write(
      `Claimed as ${identity}${result.recoveredStale ? " (recovered a stale lease elsewhere on the board first)" : ""}.\n`,
    );
    printCard(card);

    let worktreePath: string | null = null;
    if (flags["no-worktree"] !== "true" && card.seed_key) {
      try {
        worktreePath = createWorktree(card.seed_key);
        process.stdout.write(
          `\nWorktree ready: ${worktreePath}  (branch agent/${card.seed_key})\ncd ${worktreePath}\n`,
        );
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
    reconcileManifest();
    return;
  }

  if (command === "heartbeat") {
    if (!flags.card) throw new Error("--card is required");
    const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(flags.card);
    const id = looksLikeUuid
      ? flags.card
      : (await getFeatureCardContext(supabase, { seedKey: flags.card }))?.id;
    if (!id) {
      process.stdout.write(`No card found for "${flags.card}".\n`);
      process.exitCode = 1;
      return;
    }
    const ok = await renewFeatureCardLease(supabase, { id, leaseOwner: identity });
    process.stdout.write(
      ok
        ? `Lease renewed for ${flags.card}.\n`
        : `Could not renew — not leased by ${identity}, or not in_progress?\n`,
    );
    if (!ok) process.exitCode = 1;
    return;
  }

  if (command === "status") {
    const [active, claimable] = await Promise.all([
      listActiveFeatureCards(supabase),
      listClaimableFeatureCards(supabase, { limit: 20 }),
    ]);
    process.stdout.write(
      `\nWIP: ${active.length}/${FEATURE_BOARD_WIP_LIMIT} in_progress (what the claim gate counts):\n`,
    );
    for (const card of active) {
      const lease = card.lease_owner
        ? `leased by ${card.lease_owner} until ${card.lease_expires_at}`
        : "no lease (pre-RPC marker — occupies a slot until released)";
      process.stdout.write(
        `  [${card.priority}] ${card.seed_key ?? card.id} — ${card.title}\n    ${lease}\n`,
      );
    }
    if (!active.length) process.stdout.write("  (empty)\n");
    process.stdout.write(
      `\n${claimable.length} dispatchable card(s) (backlog/planned, no active lease, milestone:now|next — what \`agent:next\` would actually pick from):\n`,
    );
    for (const card of claimable) {
      process.stdout.write(`  [${card.priority}] ${card.seed_key ?? card.id} — ${card.title}\n`);
    }

    // Cards a stale lease dropped into `blocked` are otherwise invisible: not
    // active (no lease), not claimable (status isn't backlog/planned), and
    // their worktree (with whatever uncommitted work the agent left behind)
    // stays on disk with nothing pointing back at it. Surface both so an
    // abandoned card gets a human decision instead of quietly rotting.
    const { data: staleRecovered } = await supabase
      .from("feature_requests")
      .select("seed_key,title,priority,notes")
      .eq("status", "blocked")
      .ilike("notes", "%Stale claim recovered%")
      .is("archived_at", null);
    if (staleRecovered?.length) {
      process.stdout.write(
        `\n${staleRecovered.length} card(s) blocked by a lease that expired without agent:complete/agent:release — needs a human look, not auto-dispatchable:\n`,
      );
      for (const card of staleRecovered) {
        process.stdout.write(`  [${card.priority}] ${card.seed_key} — ${card.title}\n`);
      }
    }

    if (existsSync(worktreeRoot)) {
      const activeSeedKeys = new Set(active.map((c) => c.seed_key).filter(Boolean));
      const orphaned = readdirSync(worktreeRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !activeSeedKeys.has(entry.name))
        .map((entry) => entry.name);
      if (orphaned.length) {
        process.stdout.write(
          `\n${orphaned.length} worktree(s) on disk with no active lease — may hold uncommitted work from a card that was released, shipped without --no-worktree cleanup, or stale-recovered:\n`,
        );
        for (const seedKey of orphaned) {
          process.stdout.write(`  ${resolve(worktreeRoot, seedKey)}\n`);
        }
      }
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
    const force = flags.force === "true";
    const heldByOther = Boolean(card.lease_owner) && card.lease_owner !== identity;
    const ok =
      command === "release"
        ? await releaseFeatureCard(supabase, { id: card.id, leaseOwner: identity, force })
        : await completeFeatureCard(supabase, {
            id: card.id,
            leaseOwner: identity,
            evidence: flags.evidence!,
            force,
          });
    if (!ok) {
      process.stdout.write(
        `Could not ${command} ${flags.card} — not leased by ${identity}?` +
          (heldByOther && !force
            ? ` Currently leased by ${card.lease_owner}. Add --force to override.\n`
            : "\n"),
      );
      process.exitCode = 1;
      return;
    }
    if (force && heldByOther) {
      process.stdout.write(`Overrode a claim held by ${card.lease_owner}.\n`);
    }
    if (command === "complete" && card.seed_key && flags["no-worktree"] !== "true") {
      removeWorktree(card.seed_key);
      process.stdout.write(`Marked shipped: ${flags.card}. Worktree removed.\n`);
    } else if (command === "release" && card.seed_key) {
      const path = resolve(worktreeRoot, card.seed_key);
      process.stdout.write(
        `Released ${flags.card}.` +
          (existsSync(path) ? ` Worktree left in place at ${path} for inspection.\n` : "\n"),
      );
    } else {
      process.stdout.write(
        `${command === "release" ? "Released" : "Marked shipped:"} ${flags.card}.\n`,
      );
    }
    reconcileManifest();
    return;
  }

  process.stderr.write(
    "Usage: agent-dispatch <next|status|heartbeat|release|complete> [--card <id>] [--identity <name>] [--evidence <text>] [--no-worktree] [--force]\n",
  );
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`[agent-dispatch] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
