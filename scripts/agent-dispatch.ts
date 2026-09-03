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
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts next [--card <seedKeyOrId>] [--identity <name>]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts status
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts release --card <id> [--identity <name>]
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/agent-dispatch.ts complete --card <id> --evidence "<text>" [--identity <name>]
 *
 * Or via the npm scripts: agent:next, agent:status, agent:release, agent:complete.
 */
import { createServiceRoleClient } from "../src/lib/supabase/server";
import { accelerateSystemContext } from "../src/lib/tenancy/context";
import {
  claimFeatureCard,
  completeFeatureCard,
  getFeatureCardContext,
  listClaimableFeatureCards,
  releaseFeatureCard,
  type FeatureRequestCard,
} from "../src/lib/revenue-os/feature-board-claims";

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
    process.stdout.write(
      `\nWhen done: npm run agent:complete -- --card ${card.id} --identity "${identity}" --evidence "<what you verified>"\n` +
        `To abandon without shipping: npm run agent:release -- --card ${card.id} --identity "${identity}"\n`,
    );
    return;
  }

  if (command === "status") {
    const claimable = await listClaimableFeatureCards(supabase, { limit: 20 });
    process.stdout.write(`\n${claimable.length} claimable card(s) (backlog/planned, no active lease):\n`);
    for (const card of claimable) {
      process.stdout.write(`  [${card.priority}] ${card.seed_key ?? card.id} — ${card.title}\n`);
    }
    return;
  }

  if (command === "release" || command === "complete") {
    if (!flags.card) throw new Error("--card is required");
    if (command === "complete" && !flags.evidence) throw new Error("--evidence is required");
    const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(flags.card);
    const id = looksLikeUuid
      ? flags.card
      : (await getFeatureCardContext(supabase, { seedKey: flags.card }))?.id;
    if (!id) {
      process.stdout.write(`No card found for "${flags.card}".\n`);
      process.exitCode = 1;
      return;
    }
    const ok =
      command === "release"
        ? await releaseFeatureCard(supabase, { id, leaseOwner: identity })
        : await completeFeatureCard(supabase, { id, leaseOwner: identity, evidence: flags.evidence! });
    process.stdout.write(
      ok
        ? `${command === "release" ? "Released" : "Marked shipped:"} ${flags.card}.\n`
        : `Could not ${command} ${flags.card} — not leased by ${identity}?\n`,
    );
    if (!ok) process.exitCode = 1;
    return;
  }

  process.stderr.write("Usage: agent-dispatch <next|status|release|complete> [--card <id>] [--identity <name>] [--evidence <text>]\n");
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`[agent-dispatch] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
