import assert from "node:assert/strict";
import { DEMO_SCENARIOS, type DemoScenarioPack } from "../src/lib/admin/demo/scenarios";
import {
  createDemoBusinessState,
  handleDemoBusinessRequest,
  demoTasksForGraph,
  DEMO_BUSINESS_MODULES,
  type DemoBusinessState,
} from "../src/lib/admin/demo/business-runtime";
import {
  initialState,
  queue,
  priority,
  opportunityRecord,
  auditHistory,
  importBatch,
  clientRows,
  type DemoState,
} from "../src/lib/admin/demo/runtime";

type StageTiming = { stage: string; ms: number };
const timings: StageTiming[] = [];
async function stage<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    timings.push({ stage: name, ms: performance.now() - start });
  }
}

function makeClient(pack: DemoScenarioPack, state: DemoBusinessState) {
  const modules: Record<string, boolean> = { ...DEMO_BUSINESS_MODULES };
  let saves = 0;
  const request = async (
    path: string,
    body?: Record<string, unknown>,
    method = body ? "POST" : "GET",
    status = 200,
  ) => {
    const r = await handleDemoBusinessRequest(
      pack,
      state,
      modules,
      new URL(path, "http://localhost"),
      method,
      body ?? {},
      () => saves++,
    );
    assert.ok(r, `expected a demo response for ${method} ${path}`);
    const data = await r.json();
    assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data).slice(0, 400)}`);
    return data;
  };
  return { request, modules, saveCount: () => saves };
}

function demoStateFor(state: DemoBusinessState): DemoState {
  return { ...initialState(), business: state };
}

// Mirrors installAdminDemoRuntime's demoFetch augmentation: business tasks
// join the scenario graph before Today/record reads, so the test asserts the
// exact surfaces the operator sees.
function graphPackFor(pack: DemoScenarioPack, state: DemoBusinessState): DemoScenarioPack {
  return { ...pack, tasks: [...demoTasksForGraph(state), ...pack.tasks] };
}

async function journeyForPack(pack: DemoScenarioPack) {
  const state = createDemoBusinessState(pack);
  const { request, modules } = makeClient(pack, state);
  const seededActionIds = new Set(state.actions.map((action) => action.id));
  const actionCount = () => state.actions.length;
  const taskCount = () => state.tasks.length;

  // AC01: import or create one customer and opportunity with canonical
  // person/company links. The demo import surface proposes rows for human
  // review; nothing is written until an approval executes. The
  // contact-imports HTTP adapters are thin JSON wrappers over this batch
  // (see installAdminDemoRuntime); the batch contract itself is asserted here.
  await stage(`AC01 import review (${pack.id})`, async () => {
    const before = { actions: actionCount(), tasks: taskCount(), invoices: state.invoices.length };
    const batch = importBatch(pack);
    assert.equal(batch.id, "demo-import-batch");
    assert.equal(batch.status, "needs_review");
    assert.equal(batch.approved_by, null);
    assert.ok(Array.isArray(batch.rows) && batch.rows.length >= 5);
    for (const row of batch.rows) {
      assert.ok(row.reviewed_data.email?.includes("@"), "every row carries a contact email");
      assert.ok(
        typeof row.reviewed_data.companyName === "string" && row.reviewed_data.companyName.length > 0,
        "every row carries a company link",
      );
      assert.ok(typeof row.reviewed_data.fullName === "string" && row.reviewed_data.fullName.length > 0);
    }
    const matched = batch.rows.find((row) => row.matched_contact_id);
    assert.ok(matched, "an update row links to its canonical contact");
    const person = pack.people.find((item) => item.id === matched.matched_contact_id);
    assert.ok(person, "matched contact resolves to a canonical person");
    assert.equal(matched.reviewed_data.email, person.email);
    assert.equal(matched.match_reason, "Matched an existing email");
    const uncertain = batch.rows.find((row) => row.confidence === "medium");
    assert.ok(uncertain, "an uncertain row exists");
    assert.ok(
      Array.isArray(uncertain.warnings) && uncertain.warnings.length > 0,
      "uncertain identity stays flagged instead of silently importing",
    );
    // Canonical person/company/opportunity linkage: at least one reviewed row
    // must resolve through contact -> company -> opportunity record surfaces.
    const demoState = demoStateFor(state);
    const graphPack = graphPackFor(pack, state);
    let linked = 0;
    for (const row of batch.rows.slice(0, 5)) {
      const candidate = pack.people.find((item) => item.email === row.reviewed_data.email);
      if (!candidate) continue;
      const opportunity = pack.opportunities.find((item) => item.personId === candidate.id);
      if (!opportunity) continue;
      const record = opportunityRecord(graphPack, demoState, opportunity.id);
      assert.ok(record, "linked opportunity record resolves");
      assert.equal(record.contact.id, candidate.id);
      assert.equal(record.contact.primary_email, candidate.email);
      assert.equal(record.company.name, opportunity.company);
      linked++;
    }
    assert.ok(linked > 0, "at least one import row links person, company and opportunity");
    // Reviewing the batch is side-effect free: rebuilding it reproduces the
    // same rows, linkage and review state (timestamps excepted), and no
    // business record is written without an approval.
    const again = importBatch(pack);
    const structural = (value: Record<string, unknown>) => {
      const rest = { ...value };
      delete rest.created_at;
      delete rest.updated_at;
      return rest;
    };
    assert.deepEqual(structural(again as never), structural(batch as never));
    assert.ok(Date.parse(again.created_at) > 0 && Date.parse(again.updated_at) > 0);
    assert.deepEqual(
      { actions: actionCount(), tasks: taskCount(), invoices: state.invoices.length },
      before,
      "import review performs no business write without an approval",
    );
  });

  // AC02: record a won opportunity, review the onboarding plan, and create
  // assigned due tasks through the shared action executor.
  const won = pack.opportunities.find((item) => item.stage === "won");
  assert.ok(won, "scenario provides a won opportunity");
  let createdTaskIds: string[] = [];
  await stage(`AC02 won onboarding tasks (${pack.id})`, async () => {
    const workspace = await request("/api/admin/plugins/tasks?pluginId=client-onboarding");
    assert.ok(workspace.records.some((record: { id: string }) => record.id === won.id));
    assert.ok(
      Array.isArray(workspace.suggestedTasks) && workspace.suggestedTasks.length > 0,
      "operator reviews the onboarding plan before proposing",
    );
    const dueDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const tasks = [
      {
        title: String(workspace.suggestedTasks[0]),
        description: "Reviewed onboarding plan",
        dueDate,
        assigneeUserId: workspace.currentUserId,
      },
    ];
    const open = pack.opportunities.find((item) => item.stage !== "won" && item.stage !== "lost");
    if (open) {
      await request(
        "/api/admin/plugins/workflow",
        { pluginId: "client-onboarding", mode: "preview", input: { opportunityId: open.id, tasks } },
        "POST",
        422,
      );
    }
    await request(
      "/api/admin/plugins/workflow",
      {
        pluginId: "client-onboarding",
        mode: "preview",
        input: {
          opportunityId: won.id,
          tasks: [{ ...tasks[0], assigneeUserId: "00000000-0000-4000-8000-000000000000" },
          ],
        },
      },
      "POST",
      422,
    );
    await request(
      "/api/admin/plugins/workflow",
      { pluginId: "client-onboarding", mode: "preview", input: { opportunityId: won.id, tasks: [] } },
      "POST",
      422,
    );
    const preview = await request("/api/admin/plugins/workflow", {
      pluginId: "client-onboarding",
      mode: "preview",
      input: { opportunityId: won.id, tasks },
    });
    assert.ok(typeof preview.digest === "string" && preview.digest.length >= 32);
    await request(
      "/api/admin/plugins/workflow",
      {
        pluginId: "client-onboarding",
        mode: "propose",
        input: { opportunityId: won.id, tasks },
        digest: "tampered-digest",
        requestId: crypto.randomUUID(),
      },
      "POST",
      422,
    );
    const requestId = crypto.randomUUID();
    const proposal = await request("/api/admin/plugins/workflow", {
      pluginId: "client-onboarding",
      mode: "propose",
      input: { opportunityId: won.id, tasks },
      digest: preview.digest,
      requestId,
    });
    const actionId = proposal.action.id as string;
    const replay = await request("/api/admin/plugins/workflow", {
      pluginId: "client-onboarding",
      mode: "propose",
      input: { opportunityId: won.id, tasks },
      digest: preview.digest,
      requestId,
    });
    assert.equal(replay.action.id, actionId, "replayed proposal returns the same action");
    const executed = await request(
      "/api/admin/revenue-os/actions",
      { id: actionId, decision: "approve" },
      "PATCH",
    );
    assert.ok(Array.isArray(executed.result.tasks) && executed.result.tasks.length === 1);
    createdTaskIds = executed.result.tasks.map((task: { id: string }) => task.id);
    assert.ok(
      (await request("/api/admin/plugins/tasks?pluginId=client-onboarding")).taskStates[createdTaskIds[0]!] !== undefined,
    );
    await request("/api/admin/revenue-os/actions", { id: actionId, decision: "approve" }, "PATCH", 422);
  });

  // AC03: review an invoice for the same customer, approve draft creation,
  // then separately approve a test-mode send. No provider delivery occurs.
  let draftActionId = "";
  await stage(`AC03 invoice draft and test-mode send (${pack.id})`, async () => {
    const billing = await request("/api/admin/invoicing");
    assert.equal(billing.testMode, true);
    const contact = billing.contacts[0];
    assert.ok(contact, "invoice review starts from a canonical contact");
    const input = {
      contactId: contact.id,
      customerId: billing.customers.find(
        (customer: { id: string; email: string }) => customer.email === contact.primary_email,
      )?.id,
      currency: "usd",
      daysUntilDue: 14,
      memo: "First value journey",
      lines: [{ description: "Onboarding implementation", quantity: 1, unitAmount: 120000 }],
    };
    assert.ok(input.customerId, "billing customer matches the CRM contact email");
    await request(
      "/api/admin/plugins/workflow",
      { pluginId: "stripe-invoicing", mode: "preview", input: { ...input, lines: [] } },
      "POST",
      422,
    );
    await request(
      "/api/admin/plugins/workflow",
      {
        pluginId: "stripe-invoicing",
        mode: "preview",
        input: { ...input, customerId: "cus_mismatch" },
      },
      "POST",
      422,
    );
    const preview = await request("/api/admin/plugins/workflow", {
      pluginId: "stripe-invoicing",
      mode: "preview",
      input,
    });
    assert.ok(preview.payload.total > 0);
    const proposal = await request("/api/admin/plugins/workflow", {
      pluginId: "stripe-invoicing",
      mode: "propose",
      input,
      digest: preview.digest,
      requestId: crypto.randomUUID(),
    });
    draftActionId = proposal.action.id as string;
    const approved = await request(
      "/api/admin/revenue-os/actions",
      { id: draftActionId, decision: "approve" },
      "PATCH",
    );
    assert.equal(approved.result.testMode, true);
    assert.equal(approved.result.status, "draft");
    assert.equal(approved.result.hostedInvoiceUrl, null);
    await request("/api/admin/revenue-os/actions", { id: draftActionId, decision: "approve" }, "PATCH", 422);
    const send = await request("/api/admin/invoicing", { creationActionId: draftActionId });
    assert.ok(send.action.id !== draftActionId, "sending is a separate approval");
    const sendActionId = send.action.id as string;
    const sendReplay = await request("/api/admin/invoicing", { creationActionId: draftActionId });
    assert.equal(sendReplay.action.id, sendActionId, "repeated send request reuses the approval");
    const sent = await request(
      "/api/admin/revenue-os/actions",
      { id: sendActionId, decision: "approve" },
      "PATCH",
    );
    assert.equal(sent.result.status, "open");
    assert.equal(sent.result.delivery, "not_sent_test_mode");
    assert.equal(sent.result.testMode, true);
    const receipt = await request(`/api/admin/invoicing?actionId=${draftActionId}`);
    assert.equal(receipt.status, "open");
  });

  // AC04: Today, record details and Activity expose the same tasks,
  // approvals and receipts without duplicate records.
  await stage(`AC04 surface parity (${pack.id})`, async () => {
    const demoState = demoStateFor(state);
    const graphPack = graphPackFor(pack, state);
    const today = priority(graphPack, demoState);
    assert.equal(today.status, "ready");
    const queueItems = queue(graphPack, demoState);
    const queueIds = queueItems.map((item) => item.id);
    assert.equal(new Set(queueIds).size, queueIds.length, "Today queue carries no duplicate entries");
    const pendingBusiness = state.actions.filter((action) => action.status === "pending");
    assert.equal(pendingBusiness.length, 0, "every journey approval was handled");
    for (const id of createdTaskIds) {
      assert.ok(queueIds.includes(`task:${id}`), `Today exposes created task ${id}`);
    }
    const record = opportunityRecord(graphPack, demoState, won.id);
    assert.ok(record, "record details resolve for the won opportunity");
    const recordTaskIds = record.tasks.map((task: { id: string }) => task.id);
    for (const id of createdTaskIds) {
      assert.ok(recordTaskIds.includes(id), `record details expose created task ${id}`);
    }
    // Completing the delivery task retires it from Today while the record
    // keeps it as completed history with a receipt: same object, truthful
    // per-surface state, no duplicate records.
    await request(
      "/api/admin/revenue-os/tasks",
      { id: createdTaskIds[0], action: "complete" },
      "PATCH",
    );
    assert.equal(
      (await request("/api/admin/plugins/tasks?pluginId=client-onboarding")).taskStates[
        createdTaskIds[0] as string
      ],
      "completed",
    );
    const afterComplete = queue(graphPackFor(pack, state), demoStateFor(state));
    assert.ok(
      !afterComplete.some((item) => item.id === `task:${createdTaskIds[0]}`),
      "completed work leaves the Today queue",
    );
    const completedRecord = opportunityRecord(graphPackFor(pack, state), demoStateFor(state), won.id);
    assert.ok(completedRecord, "record details resolve after completion");
    assert.ok(
      completedRecord.tasks.some(
        (task: { id: string; status: string }) => task.id === createdTaskIds[0] && task.status === "completed",
      ),
      "record details retain the completed task",
    );
    assert.ok(
      state.receipts.some(
        (receipt) => receipt.sourceType === "task" && receipt.sourceId === createdTaskIds[0],
      ),
      "task completion leaves an Activity receipt",
    );
    const params = new URLSearchParams();
    const audit = auditHistory(pack, params, state);
    assert.ok(audit.entries.length > 0);
    for (const receipt of state.receipts) {
      assert.ok(
        audit.entries.some((entry) => entry.id === receipt.id),
        `Activity exposes receipt ${receipt.operation}`,
      );
    }
    for (const action of state.actions.filter(
      (item) => item.status === "executed" && !seededActionIds.has(item.id),
    )) {
      assert.ok(
        state.receipts.some(
          (receipt) => receipt.sourceType === "approval" && receipt.sourceId === action.id,
        ),
        `executed approval ${action.title} has a receipt`,
      );
    }
    const businessTaskIds = state.tasks.map((task) => task.id);
    assert.equal(new Set(businessTaskIds).size, businessTaskIds.length, "no duplicate task records");
    const wonPerson = pack.people.find((person) => person.id === won.personId);
    assert.ok(wonPerson, "won opportunity links a canonical person");
    assert.equal(record.contact.id, wonPerson.id);
    assert.equal(record.contact.primary_email, wonPerson.email);
    assert.equal(record.company.name, won.company);
  });

  // AC05: the operator can correct identity, retry an interrupted operation,
  // and understand missing capabilities without hitting a terminal dead end.
  // Corrections flow through the same override shapes the record/client PATCH
  // adapters persist; reads below prove the corrected state reaches every
  // surface.
  await stage(`AC05 correction and recovery (${pack.id})`, async () => {
    const demoState = demoStateFor(state);
    const correctedNextAction = "Call to confirm onboarding scope before kickoff";
    demoState.opportunityOverrides[won.id] = {
      ...demoState.opportunityOverrides[won.id],
      nextAction: correctedNextAction,
    };
    const graphPack = graphPackFor(pack, state);
    const corrected = opportunityRecord(graphPack, demoState, won.id);
    assert.ok(corrected, "corrected record resolves");
    assert.equal(corrected.opportunity.next_action, correctedNextAction);
    const correctedEmail = "owner@example.example";
    demoState.clientOverrides["client-0"] = {
      ...demoState.clientOverrides["client-0"],
      contact_email: correctedEmail,
      updated_at: new Date().toISOString(),
    };
    const rows = clientRows(pack, demoState);
    assert.equal(rows.find((row) => row.id === "client-0")?.contact_email, correctedEmail);
    assert.equal(
      rows.find((row) => row.id === "client-unknown"),
      undefined,
      "unknown records stay unresolvable instead of silently matching",
    );
    // Interrupt an approval by disabling its capability, then recover.
    const workspace = await request("/api/admin/plugins/tasks?pluginId=client-onboarding");
    const retryTasks = [
      {
        title: "Confirm recovery after interruption",
        description: "Retry path",
        dueDate: new Date().toISOString().slice(0, 10),
        assigneeUserId: workspace.currentUserId,
      },
    ];
    const retryPreview = await request("/api/admin/plugins/workflow", {
      pluginId: "client-onboarding",
      mode: "preview",
      input: { opportunityId: won.id, tasks: retryTasks },
    });
    const retryProposal = await request("/api/admin/plugins/workflow", {
      pluginId: "client-onboarding",
      mode: "propose",
      input: { opportunityId: won.id, tasks: retryTasks },
      digest: retryPreview.digest,
      requestId: crypto.randomUUID(),
    });
    const retryActionId = retryProposal.action.id as string;
    modules["client-onboarding"] = false;
    const failed = await request(
      "/api/admin/revenue-os/actions",
      { id: retryActionId, decision: "approve" },
      "PATCH",
      422,
    );
    assert.match(failed.error, /disabled/i);
    const stored = state.actions.find((action) => action.id === retryActionId);
    assert.equal(stored?.status, "failed");
    await request("/api/admin/revenue-os/actions", { id: retryActionId, decision: "retry" }, "PATCH");
    assert.equal(stored?.status, "pending");
    const disabledPreview = await request(
      "/api/admin/plugins/workflow",
      { pluginId: "client-onboarding", mode: "preview", input: { opportunityId: won.id, tasks: retryTasks } },
      "POST",
      422,
    );
    assert.match(disabledPreview.error, /Enable it from Plugins/, "disabled capability names its recovery");
    modules["client-onboarding"] = true;
    const recovered = await request(
      "/api/admin/revenue-os/actions",
      { id: retryActionId, decision: "approve" },
      "PATCH",
    );
    assert.ok(Array.isArray(recovered.result.tasks));
    assert.equal(stored?.status, "executed");
    await request("/api/admin/revenue-os/actions", { id: retryActionId, decision: "retry" }, "PATCH", 422);
  });

  // Journey-wide invariants: every receipt is simulated, nothing points at a
  // real provider, and all session writes are accounted for.
  const serialized = JSON.stringify(state);
  assert.ok(!serialized.includes("pay.stripe.com") && !serialized.includes("invoice.stripe.com"));
  assert.ok(state.receipts.length > 0 && state.receipts.every((receipt) => receipt.simulated));
  assert.ok(state.invoices.every((invoice) => invoice.document.customerEmail.endsWith(".example")));
  assert.ok(state.invoices.every((invoice) => invoice.document.paymentUrl === null));
}

async function main() {
  const packs = Object.values(DEMO_SCENARIOS);
  assert.ok(packs.length > 0);
  for (const pack of packs) {
    await journeyForPack(pack);
  }
  const byStage = new Map<string, number[]>();
  for (const timing of timings) {
    byStage.set(timing.stage, [...(byStage.get(timing.stage) ?? []), timing.ms]);
  }
  // AC06: first-run trial report. Each pack starts from a fresh fictional
  // workspace, so every journey above is a timed first-run trial. Measured
  // machine timings are reported per stage; they are system costs, not product
  // targets. Budgets below are local-trial guards, not UX promises.
  console.log("First-run trial report (fresh fictional workspace per scenario):");
  let total = 0;
  for (const [name, samples] of byStage) {
    const sum = samples.reduce((a, b) => a + b, 0);
    total += sum;
    const avg = sum / samples.length;
    const max = Math.max(...samples);
    console.log(`- ${name}: n=${samples.length} avg=${avg.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    assert.ok(max < 5000, `${name} completes within the local trial budget`);
  }
  console.log(`- total journey time: ${total.toFixed(1)}ms across ${packs.length} scenarios`);
  console.log(
    "Operator notes: the send approval is intentionally separate from the draft approval; " +
      "replayed proposals reuse the original action id; failed approvals retry only after an " +
      "explicit retry decision; disabled capabilities name the Plugins recovery path instead " +
      "of dead-ending. A founder-led new-user trial should confirm these read as clearly in " +
      "the UI as they assert here.",
  );
  console.log(
    "First value journey: import review, won onboarding tasks, invoice draft plus test-mode " +
      "send, Today/record/Activity parity, correction and recovery passed.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
