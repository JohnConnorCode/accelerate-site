import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";

async function main() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const storage = new Map<string, string>();
  let escaped = 0;
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      fetch: async () => {
        escaped++;
        throw new Error("Escaped demo request");
      },
      location: { origin: "https://demo.example", reload: () => {} },
      dispatchEvent: () => true,
      open: () => null,
    },
  });
  try {
    for (const pack of Object.values(DEMO_SCENARIOS)) {
      let runtime = installAdminDemoRuntime(pack.id);
      const json = async (path: string, method = "GET", body?: unknown) => {
        const r = await window.fetch(path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: r.status, data: await r.json() };
      };
      const workspace = async () => (await json("/api/admin/collections/workspace")).data;
      const chat = async (text: string) => {
        const r = await window.fetch("/api/admin/revenue-os/ai/stream", {
          method: "POST",
          body: JSON.stringify({ text }),
        });
        assert.equal(r.status, 200);
        const events = (await r.text())
          .trim()
          .split("\n\n")
          .map((line) => JSON.parse(line.slice(6)));
        const id = events.find((e) => e.type === "final").proposedActions[0];
        assert.equal(typeof id, "string");
        assert.equal(events.find((e) => e.type === "proposal_staged").proposal.id, id);
        return (await workspace()).cases
          .flatMap((c: { actions: unknown[] }) => c.actions)
          .find((a: { id: string }) => a.id === id);
      };
      const decide = (id: string, decision: string) =>
        json("/api/admin/revenue-os/actions", "PATCH", { id, decision });
      try {
        const c = (await workspace()).cases[0];
        const request = `Set the collection owner for ${c.name} to owner@example.test`;
        const queued = await chat(request);
        assert.equal(queued.action_type, "update_collection_policy");
        assert.equal((await chat(request)).id, queued.id);
        assert.equal((await workspace()).cases[0].ownerEmail, null);
        assert.equal((await decide(queued.id, "reject")).status, 200);
        assert.equal((await workspace()).cases[0].ownerEmail, null);
        const approved = await chat(request);
        runtime.restore();
        runtime = installAdminDemoRuntime(pack.id);
        assert.ok(
          (await workspace()).cases[0].actions.some((a: { id: string }) => a.id === approved.id),
        );
        assert.equal((await decide(approved.id, "approve")).status, 200);
        assert.equal((await workspace()).cases[0].ownerEmail, "owner@example.test");
        assert.equal((await decide(approved.id, "approve")).status, 409);
        const reminder = await json("/api/admin/collections/reminders", "POST", { caseId: c.id });
        assert.equal(reminder.status, 200);
        const pause = await chat(`Pause collections for ${c.name}`);
        assert.equal((await decide(pause.id, "approve")).status, 200);
        assert.equal(
          (await json("/api/admin/collections/reminders", "POST", { caseId: c.id })).status,
          409,
        );
        const resume = await chat(`Resume collections for ${c.name}`);
        const latest = (await workspace()).cases[0];
        await json("/api/admin/collections", "PATCH", {
          caseId: c.id,
          revision: latest.revision,
          patch: { nextAction: "Edited in admin" },
        });
        assert.equal((await decide(resume.id, "approve")).status, 409);
        const next = await chat(`Resume collections for ${c.name}`);
        assert.equal((await decide(next.id, "approve")).status, 200);
        const after = await json("/api/admin/collections/reminders", "POST", { caseId: c.id });
        assert.equal(after.status, 200);
        assert.notEqual(after.data.preview.digest, reminder.data.preview.digest);
        const stale = await chat(`Pause collections for ${c.name}`);
        await json("/api/admin/collections/simulate-payment", "POST", { caseId: c.id });
        assert.equal((await decide(stale.id, "approve")).status, 409);
        assert.equal((await decide(stale.id, "retry")).status, 200);
        assert.equal((await decide(stale.id, "approve")).status, 409);
        const actions = (await workspace()).cases[0].actions;
        assert.ok(
          actions.every((a: { result?: { state?: string } }) => a.result?.state !== "sent"),
        );
        console.log(
          `PASS ${pack.id}: conversation → policy review → reject/approve/reload → stale edit/payment → reminder regeneration; session-only effects.`,
        );
      } finally {
        runtime.restore();
      }
    }
    assert.equal(escaped, 0);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
