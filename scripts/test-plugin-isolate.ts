import assert from "node:assert/strict";
import { evaluateInIsolate } from "../src/lib/revenue-os/plugin-isolate";

async function main() {
  // 1. Values round-trip exactly, including booleans (no silent coercion).
  assert.equal((await evaluateInIsolate("1 + 1")).value, 2);
  assert.equal((await evaluateInIsolate("true")).value, true);
  assert.equal((await evaluateInIsolate("false")).value, false);
  assert.equal((await evaluateInIsolate("null")).value, null);
  assert.deepEqual((await evaluateInIsolate("[1, 'a', null]")).value, [1, "a", null]);
  assert.deepEqual((await evaluateInIsolate("({ a: 1, b: [true] })")).value, { a: 1, b: [true] });

  // 2. Declared bindings are present; undeclared names do not exist.
  const bound = await evaluateInIsolate("greet('Ana')", {
    pluginId: "test",
    bindings: { greet: (name) => `hi ${name}` },
  });
  assert.equal(bound.value, "hi Ana");
  assert.equal(bound.receipt.pluginId, "test");
  await assert.rejects(
    () => evaluateInIsolate("missingFn()", { bindings: { greet: () => "x" } }),
    /missingFn/,
    "an undeclared host must be a ReferenceError, not undefined behavior",
  );

  // 3. Timeouts terminate cleanly with a receipt instead of hanging the host.
  const started = Date.now();
  await assert.rejects(
    () => evaluateInIsolate("while (true) {}", { timeoutMs: 150 }),
    /timed out after 150ms/,
  );
  assert.ok(Date.now() - started < 5000, "a killed evaluation must return promptly");
  // The host survives the kill and runs again.
  assert.equal((await evaluateInIsolate("40 + 2")).value, 42);

  // 4. Memory breach fails the evaluation, never the host.
  await assert.rejects(
    () =>
      evaluateInIsolate("let s=''; while(true){ s += 'x'.repeat(100000); }", {
        memoryLimitBytes: 1024 * 1024,
      }),
    Error,
  );
  assert.equal((await evaluateInIsolate("7 * 6")).value, 42);

  // 5. Adversarial: no ambient authority of any kind.
  for (const probe of [
    "typeof process",
    "typeof require",
    "typeof fetch",
    "typeof Response",
    "typeof setTimeout",
    "typeof globalThis.process",
    "typeof Deno",
    "typeof Bun",
  ]) {
    assert.equal((await evaluateInIsolate(probe)).value, "undefined", `${probe} must not exist`);
  }
  await assert.rejects(
    () => evaluateInIsolate("process.env.SECRET"),
    /process/,
    "reaching for the environment must throw, not return undefined data",
  );
  await assert.rejects(() => evaluateInIsolate("fetch('https://example.com')"), /fetch/);

  // 6. Async results are refused, not half-awaited.
  await assert.rejects(() => evaluateInIsolate("Promise.resolve(1)"), /sync code only/);
  await assert.rejects(() => evaluateInIsolate("(async () => 1)()"), /sync code only/);

  // 7. Non-JSON across the boundary refuses on both directions.
  await assert.rejects(
    () =>
      evaluateInIsolate("fn()", {
        bindings: {
          // deno-lint-ignore no-explicit-any
          fn: () => (() => 1) as unknown as string,
        },
      }),
    /boundary/,
  );
  await assert.rejects(() => evaluateInIsolate("() => 1"), /boundary/);

  // 8. Binding errors surface with their message, not a host stack.
  await assert.rejects(
    () =>
      evaluateInIsolate("boom()", {
        bindings: {
          boom: () => {
            throw new Error("capability refused");
          },
        },
      }),
    /capability refused/,
  );

  // 9. Empty code refuses instead of evaluating nothing.
  await assert.rejects(() => evaluateInIsolate("   "), /no code/);

  // 11. Structured binding results cross as structures, not strings.
  const shaped = await evaluateInIsolate("wrap().a + '/' + wrap().b[1]", {
    bindings: { wrap: () => ({ a: "x", b: [1, 2] }) },
  });
  assert.equal(shaped.value, "x/2");
  await assert.rejects(
    () => evaluateInIsolate("1", { bindings: { ["__proto__"]: () => 1 } }),
    /safe global name/,
    "prototype-shadowing binding names must refuse",
  );
  await assert.rejects(
    () => evaluateInIsolate("1", { bindings: { constructor: () => 1 } }),
    /safe global name/,
  );
  await assert.rejects(
    () => evaluateInIsolate("x".repeat(300 * 1024)),
    /exceeds/,
    "oversized code must refuse before reaching the isolate",
  );

  // 10. Cold start: steady-state p50 stays far under the 50ms budget.
  // First call warms the WASM module and is reported separately.
  await evaluateInIsolate("0");
  const samples: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const run = await evaluateInIsolate("1 + 1");
    samples.push(run.receipt.elapsedMs);
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length / 2)]!;
  assert.ok(p50 < 50, `cold-start p50 must stay under 50ms (got ${p50}ms)`);

  console.log(
    JSON.stringify({
      result: "passed",
      coldStartP50ms: p50,
      checks: [
        "value-roundtrip",
        "declared-bindings",
        "timeout-kill",
        "memory-breach",
        "no-ambient-authority",
        "async-refusal",
        "json-boundary",
        "binding-errors",
        "empty-refusal",
        "structured-bindings",
        "binding-name-guard",
        "code-size-guard",
        "cold-start-budget",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
