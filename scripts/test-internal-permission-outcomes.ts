import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as contract from "../src/lib/revenue-os/internal-permission-contract";

let receipt: unknown;
let allowed = true;
let requiresApproval = false;
let admissionAllowed = true;
let executions = 0;
const database = {
  rpc: async () => ({
    data: {
      allowed: admissionAllowed,
      reason: "Record permission required",
      policyIds: ["policy"],
    },
    error: null,
  }),
} as unknown as SupabaseClient;
const loadedModule = {
  exports: {} as {
    tryExecuteInternalProposal: (
      db: SupabaseClient,
      output: unknown,
      requesterId?: string,
    ) => Promise<unknown>;
  },
};
vm.runInNewContext(
  ts.transpileModule(readFileSync("src/lib/revenue-os/internal-permissions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: loadedModule.exports,
    module: loadedModule,
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return {};
      if (name.endsWith("tenancy/context")) return { getTenantRequestContext: () => undefined };
      if (name.endsWith("supabase/server")) return {};
      if (name === "./actions") return {};
      if (name === "./internal-permission-contract") return contract;
      if (name === "./autonomy-policy")
        return { checkAutonomy: async () => ({ allowed, requiresApproval }) };
      if (name === "./action-executor")
        return {
          approveAndExecuteAction: async () => {
            executions++;
            return receipt;
          },
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  },
);

async function main() {
  const proposal = {
    id: "action",
    action_type: "create_task",
    status: "pending",
    proposed_by: "member@example.test",
  };
  const execute = () =>
    loadedModule.exports.tryExecuteInternalProposal(database, proposal, "member");
  for (const result of [
    { complete: false },
    { status: "partial" },
    { status: "failed" },
    { status: "pending" },
    { status: "denied" },
  ]) {
    receipt = result;
    const outcome = (await execute()) as {
      status: string;
      execution: { status: string; result: unknown };
    };
    assert.equal(outcome.status, "partial", "incomplete execution cannot be presented as complete");
    assert.equal(outcome.execution.status, outcome.status);
    assert.equal(outcome.execution.result, result, "preserve the actual service receipt");
  }
  receipt = { task: { status: "pending", id: "task" } };
  assert.equal(
    ((await execute()) as { status: string }).status,
    "executed",
    "a created pending task is a successful operation",
  );
  const count = executions;
  requiresApproval = true;
  assert.equal(await execute(), proposal);
  requiresApproval = false;
  allowed = false;
  assert.equal(await execute(), proposal);
  allowed = true;
  admissionAllowed = false;
  assert.equal(((await execute()) as { status: string }).status, "pending");
  assert.equal(executions, count, "missing permission or human review must prevent execution");
  admissionAllowed = true;
  assert.equal(await loadedModule.exports.tryExecuteInternalProposal(database, proposal), proposal);
  assert.equal(executions, count, "integration identity cannot inherit member permission");
  console.log(
    "PASS: standing permission preserves incomplete receipts and refuses missing actor, approval and record permission.",
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
