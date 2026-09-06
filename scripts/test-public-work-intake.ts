import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitPublicWorkSuggestion } from "../src/lib/revenue-os/work-board";

async function main() {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let notificationCount = 0;
  let failCreation = false;
  const db = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return failCreation
        ? { data: null, error: { message: "unavailable", code: "P0002" } }
        : { data: { card: { id: "saved" } }, error: null };
    },
    from(table: string) {
      assert.equal(table, "admin_notifications");
      return {
        async insert() {
          notificationCount++;
          return { error: { message: "unavailable" } };
        },
      };
    },
  } as unknown as SupabaseClient;
  const input = {
    title: " Useful request ",
    description: "A concrete business improvement",
    email: "test@example.com",
  };
  const saved = await submitPublicWorkSuggestion(db, input);
  assert.equal(saved.card.id, "saved", "notification failure must not lose saved work");
  assert.equal(calls[0]?.name, "mutate_work_board");
  assert.equal(calls[0]?.args.p_operation, "create");
  assert.equal(calls[0]?.args.p_reviewer, false);
  assert.deepEqual(calls[0]?.args.p_projects, ["accelerate"]);
  const payload = calls[0]?.args.p_payload as Record<string, unknown>;
  assert.deepEqual(payload.labels, []);
  assert.equal(payload.title, "Useful request");
  assert.equal(payload.priority, "low");
  assert.equal(payload.status, undefined);
  assert.equal(payload.owner, undefined);
  for (const extra of [
    { status: "shipped" },
    { labels: ["milestone:now"] },
    { project_key: "other" },
    { reviewer: true },
  ]) {
    await assert.rejects(submitPublicWorkSuggestion(db, { ...input, ...extra }));
  }
  assert.equal(calls.length, 1, "untrusted metadata must fail before mutation");
  failCreation = true;
  await assert.rejects(submitPublicWorkSuggestion(db, input));
  assert.equal(notificationCount, 1, "failed creation cannot announce success");
  console.log(
    "Public work intake: canonical mutation, fixed project, create-only scope, private untriaged metadata, failure and notification semantics passed.",
  );
}
void main();
