import { emptyInvoiceDraft } from "../src/lib/invoices/schema";
import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  createDemoBusinessState,
  handleDemoBusinessRequest,
  DEMO_BUSINESS_MODULES,
} from "../src/lib/admin/demo/business-runtime";
import { workspaceBrandSchema } from "../src/lib/revenue-os/branding-contract";
async function main() {
  for (const pack of Object.values(DEMO_SCENARIOS)) {
    const state = createDemoBusinessState(pack),
      modules: Record<string, boolean> = { ...DEMO_BUSINESS_MODULES };
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
      assert.ok(r);
      const data = await r.json();
      assert.equal(r.status, status, JSON.stringify(data));
      return data;
    };
    for (const scope of ["nav.sidebar", "page.today"]) {
      assert.deepEqual(await request(`/api/admin/revenue-os/layout?scope=${scope}`), {
        scope,
        doc: null,
        history: [],
      });
    }
    await request("/api/admin/revenue-os/layout?scope=unknown", undefined, "GET", 400);
    await request("/api/admin/revenue-os/layout", undefined, "GET", 400);
    assert.equal(saves, 0, "Reading default layouts must not create a saved override");
    workspaceBrandSchema.parse(state.brand);
    assert.equal(state.invoices.length, 3);
    assert.ok(state.tasks.length >= 4);
    assert.ok(state.invoices.every((x) => x.contact_email.endsWith(".example") && !x.share_url));
    const billing = await request("/api/admin/invoicing");
    const contact = billing.contacts[0];
    const draft = {
      ...emptyInvoiceDraft(),
      contact_id: contact.id,
      company_name: contact.full_name,
      contact_name: contact.full_name,
      contact_email: contact.primary_email,
      description: pack.business.invoiceMemo,
      lines: pack.business.invoiceLines.map((x) => ({
        description: x.description,
        quantity: x.quantity,
        unit_cents: x.unitAmount,
      })),
    };
    await request(
      "/api/admin/invoicing",
      { operation: "save_draft", id: null, revision: null, draft: { ...draft, lines: [] } },
      "POST",
      422,
    );
    const saved = await request("/api/admin/invoicing", {
      operation: "save_draft",
      id: null,
      revision: null,
      draft,
    });
    assert.equal(saved.invoice.status, "draft");
    assert.equal(state.invoices.length, 4);
    modules["invoicing"] = false;
    await request(
      "/api/admin/invoicing",
      { operation: "issue", id: saved.invoice.id, revision: 1 },
      "POST",
      422,
    );
    modules["invoicing"] = true;
    const issued = await request("/api/admin/invoicing", {
      operation: "issue",
      id: saved.invoice.id,
      revision: 1,
    });
    assert.equal(issued.invoice.status, "open");
    assert.match(issued.invoice.invoice_number, /^INV-\d{4}$/);
    const voided = await request("/api/admin/invoicing", {
      operation: "void",
      id: saved.invoice.id,
      revision: issued.invoice.revision,
    });
    assert.equal(voided.invoice.status, "void");
    for (const pluginId of ["client-onboarding", "meeting-commitments"]) {
      const workspace = await request("/api/admin/plugins/tasks?pluginId=" + pluginId);
      const tasks = [
        {
          title: workspace.suggestedTasks[0],
          description: "Reviewed plan",
          dueDate: new Date().toISOString().slice(0, 10),
          assigneeUserId: workspace.currentUserId,
        },
      ];
      const input = {
        [pluginId === "client-onboarding" ? "opportunityId" : "meetingId"]: workspace.records[0].id,
        tasks,
      };
      const preview = await request("/api/admin/plugins/workflow", {
        pluginId,
        mode: "preview",
        input,
      });
      const proposal = await request("/api/admin/plugins/workflow", {
        pluginId,
        mode: "propose",
        input,
        digest: preview.digest,
        requestId: crypto.randomUUID(),
      });
      const executed = await request(
        "/api/admin/revenue-os/actions",
        { id: proposal.action.id, decision: "approve" },
        "PATCH",
      );
      const task = executed.result.tasks[0];
      await request("/api/admin/revenue-os/tasks", { id: task.id, action: "complete" }, "PATCH");
      assert.equal(
        (await request("/api/admin/plugins/tasks?pluginId=" + pluginId)).taskStates[task.id],
        "completed",
      );
      assert.equal(
        state.actions.find((x) => x.id === proposal.action.id)!.result!.tasks instanceof Array,
        true,
      );
    }
    const brand = await request("/api/admin/tenant/branding");
    await request(
      "/api/admin/tenant/branding",
      { brand: { ...brand.brand, name: pack.name + " Studio" }, revision: brand.revision },
      "PUT",
    );
    await request(
      "/api/admin/tenant/branding",
      { brand: brand.brand, revision: brand.revision },
      "PUT",
      422,
    );
    const other = createDemoBusinessState(pack);
    assert.equal(other.brand.name, pack.name);
    assert.equal(other.receipts.length, 0);
    assert.equal(JSON.parse(JSON.stringify(state)).brand.name, pack.name + " Studio");
    assert.ok(saves > 5);
    assert.ok(state.receipts.every((x) => x.simulated));
  }
  console.log(
    "All business demos: coherent records, invoice draft/issue/void, assigned tasks, disabled/replay/stale-input gates, local receipts and serializable isolated state passed.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
