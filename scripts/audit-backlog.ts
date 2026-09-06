/* eslint-disable @typescript-eslint/no-explicit-any -- Offline exported JSON is validated with workSpecSchema before a proposal is emitted. */
/** Offline, reviewable transformation of an explicit live export. Never writes the database. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { refinementSlices, phaseProofs } from "./backlog-refinement-data.mjs";
import { featureBacklog, LOOP_ONE } from "./feature-backlog-data.mjs";
import { workSpecSchema } from "../src/lib/revenue-os/work-board";
const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
if (!process.argv.includes("--input") || !process.argv.includes("--plan"))
  throw new Error("Use --input <dated-export.json> --plan <proposal.json>");
const snapshot = JSON.parse(readFileSync(arg("--input")!, "utf8"));
const rows = snapshot.features as any[];
const packageScripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
const templateByKey = new Map(featureBacklog.map((c: any) => [c.seed_key, c]));
const base = {
  url: "https://github.com/JohnConnorCode/accelerate-site.git",
  baseBranch: "agent/universal-work-board",
  baseCommit: "50f3aa671751619f44af22bb0736618c362d1b6b",
};
const changes: any[] = [];
const audit: any[] = [];
const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf8" })
  .trim()
  .split("\n\n")
  .map((block) =>
    Object.fromEntries(
      block.split("\n").map((line) => {
        const i = line.indexOf(" ");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
    ),
  );
const section = (text: string, label: string) =>
  text
    .split("\n\n")
    .find((s) => s.startsWith(label))
    ?.slice(label.length)
    .trim() ?? "";
const environment = (text: string) =>
  /production|canonical.alias|live deployment/i.test(text)
    ? "production"
    : /burn.in|adoption|14.day|seven.day|founder.*useful/i.test(text)
      ? "observation"
      : /real Postgres|real provider|live proof|sandbox credential/i.test(text)
        ? "controlled-integration"
        : "local";
function placement(key: string) {
  if (
    /^(admin-|additional-tools|route-state|de-vertical|google-token|google-admin|booking-mode|task-operator|data-quality|stage-history|csv-hubspot|batch-identity|legacy-|canonical-|identity-|activity-|pipeline-|record-detail|today-)/.test(
      key,
    )
  )
    return {
      phase: "A",
      layers: ["See", "Remember", "Act"],
      initiative: "First useful business journey",
    };
  if (
    /^(automation-policy|roles-and-permissions|proactive-operator|ship-command|production-|tenant-ai-sponsorship)/.test(
      key,
    )
  )
    return {
      phase: "B",
      layers: ["Notice", "Act", "Learn"],
      initiative: "Shared runtime and execution quality",
    };
  if (/^(playwright-proposal|playwright-gmail)/.test(key))
    return {
      phase: "C",
      layers: ["See", "Remember", "Act"],
      initiative: "Lead to meeting and follow-up",
    };
  if (/^(docs-module|plugin-exemplar-tier0)/.test(key))
    return { phase: "D", layers: ["Remember", "Act"], initiative: "Supported extension platform" };
  if (
    LOOP_ONE.includes(key) ||
    /^(guided-first-run|install-runbook|one-click|tenant-|release-migration|first-value)/.test(key)
  )
    return {
      phase: "A",
      layers: ["See", "Remember", "Act"],
      initiative: "First useful business journey",
    };
  if (
    /^(durable-|capability-|evidence-|autonomy-|action-|trust-|approval-|write-provenance|unified-action|runtime-record|coworker-model|agent-activity|memory-|budgets|work-|northstar-runtime|backlog-|universal-work|feature-board)/.test(
      key,
    )
  )
    return {
      phase: "B",
      layers: ["Remember", "Notice", "Act"],
      initiative: "Shared runtime and execution quality",
    };
  if (
    /^(plugin-|integration-adapter|custom-data|public-records|entity-registry|generic-record|report-recipe|declarative-|ui-slots|tool-bundles|create-accelerate|module-|mcp-)/.test(
      key,
    ) &&
    !/exemplar|vertical/.test(key)
  )
    return {
      phase: "D",
      layers: ["See", "Remember", "Act"],
      initiative: "Supported extension platform",
    };
  if (
    /^(sales-|precall|postmeeting|gmail-|calendar-|proposal-|ai-company|ai-opportunity|ai-message|ai-meeting|ai-proposal)/.test(
      key,
    )
  )
    return {
      phase: "C",
      layers: ["See", "Remember", "Notice", "Act"],
      initiative: "Lead to meeting and follow-up",
    };
  if (/learn|trust/.test(key))
    return {
      phase: "B",
      layers: ["Remember", "Learn", "Act"],
      initiative: "Shared runtime and execution quality",
    };
  if (
    /^(ai-|openrouter|second-brain|atomic-|notification-|audit-|secret-|founder-access|webhook|setup-|system-health|operations-alert|incident-|revenue-os-tests|api-contract|release-|verification-)/.test(
      key,
    )
  )
    return {
      phase: "B",
      layers: ["Remember", "Notice", "Act"],
      initiative: "Shared runtime and execution quality",
    };
  return {
    phase: "E",
    layers: ["See", "Remember", "Act"],
    initiative: /receivable|invoice|renewal|expense|margin|scope-change|vendor/.test(key)
      ? "Delivery, invoicing and collections"
      : /support/.test(key)
        ? "Customer support"
        : /campaign|email/.test(key)
          ? "Audience to approved campaign"
          : /docs|documentation/.test(key)
            ? "Product and developer adoption"
            : "Business operations and adoption",
  };
}
const scopeTests: [RegExp, string][] = [
  [/drive|knowledge/, "test:knowledge"],
  [/gmail/, "test:gmail-threading"],
  [/calendar|booking/, "test:command-center-scheduler"],
  [/proposal/, "test:api-contracts"],
  [/campaign/, "test:campaign-stops"],
  [/work-board|backlog|feature-board/, "test:work-board"],
  [/plugin|module/, "test:plugin-modules"],
  [/ai|coworker/, "test:ai-command-runtime"],
  [/docs|documentation/, "verify:docs"],
  [/tenant|permission|roles/, "test:tenant-isolation"],
  [/task|delivery/, "test:delivery-handoff"],
];
const splitKeys = new Set(["additional-tools-canonical-parity", "docs-content-first-pass"]);
const rollups = new Set([
  "second-brain-see",
  "second-brain-notice",
  "second-brain-act",
  "second-brain-learn",
  "second-brain-trust",
  "receivables-collections-plugin",
]);
function improve(c: any) {
  const key = c.seed_key ?? c.id;
  const template: any = templateByKey.get(key);
  const notes = c.notes ?? "";
  const old = c.work_spec ?? {};
  const pos = placement(key);
  const acceptance = (
    old.acceptance?.length
      ? old.acceptance
      : (c.acceptance_criteria ?? "")
          .split("\n")
          .map((l: string) => l.replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, "").trim())
          .filter(Boolean)
          .map((criterion: string, i: number) => ({ id: `AC${i + 1}`, criterion }))
  ).map((a: any) => ({ ...a, environment: a.environment ?? environment(a.criterion) }));
  const start =
    section(notes, "Starting points:") || section(template?.notes ?? "", "Starting points:");
  const paths = [
    ...new Set(
      start.match(
        /(?:src|scripts|docs|migrations|extensions)\/[\w./-]+\.(?:tsx?|mjs|mdx?|sql|json)/g,
      ) ?? [],
    ),
  ];
  const refs = old.references?.length
    ? old.references
    : paths
        .filter((p) => existsSync(p))
        .map((path) => ({
          path,
          reason:
            "Existing starting point named by this card; inspect before changing its authoritative behavior.",
          revision: base.baseCommit,
        }));
  const referenceGroups: [RegExp, string[]][] = [
    [/gmail/, ["src/lib/revenue-os/google.ts", "src/lib/revenue-os/communications.ts"]],
    [
      /precall|meeting/,
      ["src/lib/revenue-os/meeting-intel-coworker.ts", "src/lib/revenue-os/google.ts"],
    ],
    [
      /proposal/,
      [
        "src/app/api/admin/proposals/route.ts",
        "src/app/api/proposal/[token]/route.ts",
        "src/lib/revenue-os/pipeline.ts",
      ],
    ],
    [
      /ai-company|ai-message|ai-opportunity/,
      [
        "src/lib/revenue-os/ai-tools.ts",
        "src/lib/revenue-os/ai-context.ts",
        "src/lib/revenue-os/queue.ts",
      ],
    ],
    [
      /notification|slack/,
      ["src/app/api/admin/notifications/route.ts", "scripts/test-notification-contract.ts"],
    ],
    [
      /setup|health|burn-in/,
      [
        "src/lib/revenue-os/health.ts",
        "src/lib/revenue-os/setup-status.ts",
        "scripts/verify-health-truth.ts",
      ],
    ],
    [
      /ship-command|production-browser/,
      ["scripts/next-release.mjs", "scripts/verify-operator-surfaces.ts"],
    ],
    [
      /revenue-os-tests|api-contract|second-brain-trust/,
      ["scripts/test-api-contract-basics.ts", "src/lib/revenue-os/agent-trace.ts"],
    ],
    [/stripe/, ["src/lib/revenue-os/integration-adapters.ts", "src/lib/revenue-os/analytics.ts"]],
    [/notion/, ["src/lib/revenue-os/knowledge.ts", "src/lib/revenue-os/integration-adapters.ts"]],
    [
      /plugin-exemplar-tier0/,
      ["src/lib/revenue-os/plugins.ts", "src/lib/revenue-os/plugin-isolate.ts"],
    ],
  ];
  if (!refs.length)
    for (const path of referenceGroups.find(([pattern]) => pattern.test(key))?.[1] ?? [])
      if (existsSync(path))
        refs.push({
          path,
          reason:
            "Audited current adapter/service entrypoint. Extend the canonical domain service; do not add another writer in this adapter.",
          revision: base.baseCommit,
        });
  if (!refs.length)
    refs.push({
      path: "src/lib/revenue-os/README.md",
      reason:
        "Resolve the existing canonical service before implementation; this card requires a more specific source reference.",
      revision: base.baseCommit,
    });
  const rawVerification =
    section(notes, "Required verification:") ||
    section(template?.notes ?? "", "Required verification:");
  const cmds = [
    ...new Set(
      (rawVerification.match(/npm run [\w:-]+|npx tsc --noEmit|git diff --check/g) ?? []).filter(
        (c) => !c.startsWith("npm run ") || packageScripts[c.slice(8)],
      ),
    ),
  ];
  const scoped = scopeTests.find(([regex]) => regex.test(key))?.[1] ?? "test:api-contracts";
  if (!cmds.some((c) => /npm run (test:|qa:|verify:docs)/.test(c))) cmds.push(`npm run ${scoped}`);
  const verification = old.verification?.length
    ? old.verification.map((v: any) => ({
        ...v,
        environment: v.environment ?? environment(v.expected + " " + v.command),
      }))
    : cmds.map((command) => ({
        command,
        expected: command.includes(scoped)
          ? `Pass the existing ${scoped} checks and extend the relevant fixture to prove this card's acceptance and failure cases.`
          : "Exit zero; retain the command result and exact implementation commit.",
        environment: environment(command),
      }));
  const contribution = `${pos.initiative}: ${old.businessValue ?? c.description ?? c.title}`.slice(
    0,
    2000,
  );
  const originalSteps = (c.description ?? "")
    .split(/Implementation steps:\s*/)[1]
    ?.split(/\n\d+\.\s*/)
    .map((x: string) => x.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
  const spec = {
    ...old,
    packetVersion: 2,
    northstar: old.northstar ?? { phase: pos.phase, layers: pos.layers, contribution },
    businessValue: old.businessValue ?? c.description,
    currentBehavior: old.currentBehavior ?? c.description,
    scope: old.scope?.length ? old.scope : acceptance.map((a: any) => a.criterion.slice(0, 500)),
    exclusions: old.exclusions?.length
      ? old.exclusions
      : [
          (
            section(notes, "Guardrails / non-goals:") ||
            "Preserve existing canonical services, tenant boundaries and immutable receipts."
          ).slice(0, 500),
          "Do not deploy, expand providers or change unrelated business behavior as part of this card.",
        ],
    references: refs,
    repository: old.repository ?? base,
    requiredCapabilities: old.requiredCapabilities ?? [],
    workflow: old.workflow?.length
      ? old.workflow
      : originalSteps?.length
        ? originalSteps.map((x: string) => x.slice(0, 500))
        : [
            `Inspect ${refs
              .slice(0, 3)
              .map((r: any) => r.path)
              .join(", ")} and current evidence before changing behavior.`.slice(0, 500),
            ...acceptance.map((a: any) => `Deliver ${a.id}: ${a.criterion}`.slice(0, 500)),
            "Run the named checks, attach evidence per acceptance ID and submit the exact commit for review.",
          ],
    failureModes: old.failureModes ?? [
      "Preserve tenant authorization and refuse ambiguous identity or stale input.",
      "For writes, prove replay/concurrency behavior, truthful failure receipts and safe retry. For read-only work, prove missing, empty and unavailable inputs.",
      "Do not treat missing provider access or production evidence as successful acceptance.",
    ],
    acceptance,
    verification,
    handoff: old.handoff ?? {
      completed: [],
      remaining: [
        "Recheck the recorded implementation evidence against the approved base; historical notes are preserved below.",
        ...acceptance.map((a: any) => `${a.id}: ${a.criterion}`.slice(0, 500)),
      ],
      commits: [],
    },
    ...(c.status === "blocked"
      ? {
          blockerResolution:
            old.blockerResolution ??
            c.work_blocker ??
            "Inspect the last blocker or stale-claim recovery event and preserved worktree. Record the exact remaining acceptance or required provider access; an operator must resolve the blocker before claim.",
        }
      : {}),
  };
  // A generic ownership index is useful orientation but insufficient to claim implementation work.
  if (
    refs.length === 1 &&
    refs[0].path === "src/lib/revenue-os/README.md" &&
    !old.references?.length
  )
    delete spec.repository;
  const retained = worktrees.find((w) => w.branch === `refs/heads/agent/${key}`);
  if (retained && !old.repository) {
    spec.repository = { ...base, baseBranch: `agent/${key}`, baseCommit: retained.HEAD };
    spec.handoff.remaining.unshift(
      `Inspect preserved worktree ${retained.worktree}; reconcile unfinished changes and verify ancestry before resuming.`,
    );
  }
  workSpecSchema.parse(spec);
  return { spec, pos, acceptance, missingSpecificReference: !spec.repository };
}
for (const c of rows) {
  const key = c.seed_key ?? c.id;
  const value = improve(c);
  const frozen = ["shipped", "in_review", "in_progress"].includes(c.status);
  const shippedDeps = (c.dependencies ?? []).filter(
    (id: string) => rows.find((x) => x.id === id)?.status !== "shipped",
  );
  const disposition = frozen
    ? c.status === "shipped"
      ? shippedDeps.length
        ? "investigate evidence"
        : "retain history"
      : "preserve active attempt"
    : splitKeys.has(key)
      ? "split"
      : rollups.has(key)
        ? "initiative"
        : value.missingSpecificReference
          ? "needs source definition"
          : "clarify";
  audit.push({
    key,
    id: c.id,
    revision: c.revision,
    status: c.status,
    phase: value.pos.phase,
    initiative: value.pos.initiative,
    disposition,
    unverifiedPrerequisites: shippedDeps.map(
      (id: string) => rows.find((x) => x.id === id)?.seed_key ?? id,
    ),
    existingStructuredAcceptance: Boolean(c.work_spec?.acceptance?.length),
    missingSpecificReference: value.missingSpecificReference,
    definition: value.spec,
  });
  if (frozen) continue;
  let notes = c.notes ?? "";
  // Replace only obsolete operating instructions, preserving evidence verbatim.
  notes = notes
    .replace(
      /Claim this card by setting Owner and in_progress; keep no more than two cards in progress at once\./g,
      "Claim through the canonical work service; the global WIP limit is six.",
    )
    .replace(
      /Agent handoff: claim the card by setting Owner[^\n]*/g,
      "Agent handoff: use agent:next, read the structured execution packet, retain evidence by acceptance ID and submit for separate review. Preserve the worktree.",
    );
  const payload: any = { work_spec: value.spec, initiative: value.pos.initiative, notes };
  if (rollups.has(key) || splitKeys.has(key)) payload.work_kind = "initiative";
  // Favor real journeys and blockers; retain explicitly deferred provider/marketplace breadth.
  const horizon = [
    "ai-bounded-context",
    "first-value-business-journey",
    "runtime-record-permission-contract",
  ].includes(key)
    ? "now"
    : /microsoft-365|notion-|slack-|registry-and-signing|vertical-distributions|workflow-builder/.test(
          key,
        )
      ? "later"
      : ((c.labels ?? []).find((x: string) => x.startsWith("milestone:"))?.slice(10) ?? "later");
  if (
    [
      "ai-bounded-context",
      "runtime-record-permission-contract",
      "first-value-business-journey",
    ].includes(key)
  )
    payload.priority = "high";
  payload.sort_order = [
    "ai-bounded-context",
    "first-value-business-journey",
    "runtime-record-permission-contract",
    "guided-first-run-setup",
    "won-to-delivery-handoff",
    "unified-action-executor",
  ].includes(key)
    ? ([
        "ai-bounded-context",
        "first-value-business-journey",
        "runtime-record-permission-contract",
        "guided-first-run-setup",
        "won-to-delivery-handoff",
        "unified-action-executor",
      ].indexOf(key) +
        1) *
      100
    : c.sort_order;
  if (key === "docs-content-first-pass") {
    payload.title = "Complete task-oriented product and developer documentation";
    payload.description =
      "Document the shipped product in independently reviewable operator and developer journeys. Reconcile the actual four-section manifest and existing pages before expanding it; page counts are not a proxy for usable documentation.";
    payload.acceptance_criteria =
      "- Each linked documentation slice provides a complete task, expected outcome and failure/recovery guidance against shipped behavior.\n- The manifest, in-product references and internal links agree with implemented modules; no fabricated capabilities, orphan pages or stub coverage.\n- Onboarding and extension instructions are verified against an exact integration commit; remaining unavailable features are named honestly.";
    payload.work_spec = {
      ...value.spec,
      businessValue: payload.description,
      scope: payload.acceptance_criteria.split("\n").map((x: string) => x.slice(2)),
      acceptance: payload.acceptance_criteria.split("\n").map((x: string, i: number) => ({
        id: `AC${i + 1}`,
        criterion: x.slice(2),
        environment: "local",
      })),
    };
  }
  if (key === "approval-surfaces-and-edit-feedback")
    payload.title = "Make approvals inline and capture reviewed edits as explicit feedback";
  payload.labels = c.labels.map((x: string) =>
    x.startsWith("milestone:") ? `milestone:${horizon}` : x,
  );
  changes.push({
    operation: "edit",
    id: c.id,
    revision: c.revision,
    requestKey: randomUUID(),
    payload,
  });
}
// New slices are explicit proposals with stable keys; parent and prerequisite edges
// are applied separately after UUIDs exist. No title-based dependency writes.
const additions: any[] = [];
for (const slice of refinementSlices) {
  const parent = rows.find((c) => c.seed_key === slice.parent);
  additions.push({
    ...slice,
    dependencies: [
      ...(parent?.dependencies ?? [])
        .map((id: string) => rows.find((c) => c.id === id)?.seed_key)
        .filter(Boolean),
      ...(slice.key === "canonical-tools-route-inventory"
        ? []
        : slice.parent === "additional-tools-canonical-parity"
          ? ["canonical-tools-route-inventory"]
          : []),
    ],
    initiative: placement(slice.parent).initiative,
  });
}
for (const proof of phaseProofs)
  additions.push({
    ...proof,
    key: `northstar-phase-${proof.phase.toLowerCase()}-proof`,
    title: `Verify north star Phase ${proof.phase} through a complete business outcome`,
    dependencies: proof.deps,
    initiative: placement(proof.deps[0]!).initiative,
    kind: "operations",
  });
additions.push({
  key: "historical-acceptance-reconciliation",
  title: "Reconcile historical completion claims with their current prerequisite evidence",
  phase: "B",
  kind: "operations",
  dependencies: [],
  initiative: "Shared runtime and execution quality",
  refs: ["docs/planning/BACKLOG-AUDIT.md", "src/lib/revenue-os/README.md"],
  checks: ["verify:agent-contract"],
  acceptance: [
    "For every historical prerequisite anomaly in BACKLOG-AUDIT, compare original acceptance, dated evidence and the exact integrated code; distinguish dependencies added later from actual missing proof.",
    "Preserve historical decisions; link bounded verification or corrective work for uncovered acceptance and record production-only requirements without claiming local mocks satisfy them.",
  ],
});
for (const a of additions) {
  if (rows.some((c) => c.seed_key === a.key)) continue;
  const parent = rows.find((c) => c.seed_key === a.parent);
  const spec = {
    packetVersion: 2,
    northstar: { phase: a.phase, layers: ["Remember", "Act"], contribution: a.title },
    businessValue: a.title,
    currentBehavior: a.key.startsWith("northstar-")
      ? "Existing shipped component cards do not establish the complete phase outcome. This card collects missing end-to-end proof without rebuilding those primitives."
      : a.parent
        ? `The existing ${parent?.title} card combines several independently reviewable outcomes. This slice owns only the acceptance below.`
        : "Fourteen historical shipped cards currently name unverified prerequisites; this is an evidence discrepancy, not proof that their implementations are absent.",
    scope: a.acceptance,
    exclusions: [
      "Do not rebuild shipped services, claim unexecuted checks, or deploy production.",
      "Preserve other slices and historical evidence; register specific missing implementation separately.",
    ],
    unresolvedDependencies: a.dependencies ?? [],
    references: a.refs
      .filter((path: string) => existsSync(path) || path === "docs/planning/BACKLOG-AUDIT.md")
      .map((path: string) => ({
        path,
        reason: "Audited source for this bounded outcome; inspect before changing behavior.",
        ...(path === "docs/planning/BACKLOG-AUDIT.md" ? {} : { revision: base.baseCommit }),
      })),
    repository: base,
    requiredCapabilities: [],
    acceptance: a.acceptance.map((criterion: string, i: number) => ({
      id: `AC${i + 1}`,
      criterion,
      environment:
        a.kind === "operations" && a.key.startsWith("northstar-")
          ? "controlled-integration"
          : "local",
    })),
    verification: a.checks
      .filter((x: string) => packageScripts[x])
      .map((x: string) => ({
        command: `npm run ${x}`,
        expected:
          "Pass named checks and add the acceptance-specific controlled fixture or documentation proof; record exact results.",
        environment: "local",
      })),
    workflow: [
      ...a.acceptance.map((x: string) => x.slice(0, 500)),
      "Record exact commands, environment and evidence against each acceptance ID; submit for review.",
    ],
    failureModes: [
      "Report missing integration or source evidence as an explicit remaining requirement.",
      "Prove invalid, duplicate and provider failure paths for any material write; use controlled records only.",
    ],
  };
  workSpecSchema.parse(spec);
  changes.push({
    operation: "create",
    requestKey: randomUUID(),
    payload: {
      project_key: "accelerate",
      seed_key: a.key,
      title: a.title,
      description: spec.currentBehavior,
      acceptance_criteria: a.acceptance.map((x: string) => "- " + x).join("\n"),
      priority: a.key === "historical-acceptance-reconciliation" ? "high" : "medium",
      labels: [
        `milestone:${a.phase === "A" || a.phase === "B" ? "next" : "later"}`,
        "category:quality",
        "phase:3",
        "capability:testing",
      ],
      initiative: a.initiative,
      work_kind: a.kind ?? "feature",
      work_spec: spec,
    },
  });
}
writeFileSync(
  arg("--plan")! + ".links.json",
  JSON.stringify(
    {
      additions: additions.map((a) => ({
        key: a.key,
        parent: a.parent,
        dependencies: a.dependencies,
      })),
      rollups: [...rollups],
      splits: [...splitKeys],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(arg("--plan")!, JSON.stringify({ schemaVersion: 1, changes }, null, 2) + "\n");
const auditPath = arg("--audit") ?? "/tmp/accelerate-backlog-audit.json";
writeFileSync(
  auditPath,
  JSON.stringify(
    { exportedAt: snapshot.exportedAt, sourceCount: rows.length, base, audit },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      cards: rows.length,
      proposedEdits: changes.filter((c) => c.operation === "edit").length,
      newSlices: changes.filter((c) => c.operation === "create").length,
      preserved: rows.length - changes.filter((c) => c.operation === "edit").length,
      dispositions: audit.reduce(
        (a: any, c: any) => ((a[c.disposition] = (a[c.disposition] ?? 0) + 1), a),
        {},
      ),
    },
    null,
    2,
  ),
);
