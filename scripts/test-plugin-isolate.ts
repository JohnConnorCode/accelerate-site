import assert from "node:assert/strict";
import {
  evaluateInIsolate,
  PluginIsolateError,
  type PluginJsonValue,
} from "../src/lib/revenue-os/plugin-isolate";

async function main() {
  // First evaluation includes WASM initialization: do not warm before this measurement.
  const firstStarted = performance.now();
  const first = await evaluateInIsolate("1 + 1");
  const coldStartMs = performance.now() - firstStarted;
  assert.ok(coldStartMs < 50, `first evaluation must stay under 50ms (got ${coldStartMs}ms)`);
  assert.ok(first.receipt.elapsedMs <= coldStartMs);

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
      evaluateInIsolate("new ArrayBuffer(2 * 1024 * 1024)", {
        memoryLimitBytes: 1024 * 1024,
      }),
    /out of memory/,
  );
  assert.equal((await evaluateInIsolate("7 * 6")).value, 42);

  // Regression for upstream #255: many individually small buffers/strings
  // must not bypass the aggregate budget or reach a host capability.
  for (const allocation of [
    "[new Uint8Array(600 * 1024), new Uint8Array(600 * 1024)]",
    "['x'.repeat(600 * 1024), 'y'.repeat(600 * 1024)]",
  ]) {
    let invoked = false;
    for (const ending of ["true", "accept()"])
      await assert.rejects(
        () =>
          evaluateInIsolate(
            `
        globalThis.retained = ${allocation}; ${ending};
      `,
            {
              memoryLimitBytes: 1024 * 1024,
              bindings: {
                accept: () => {
                  invoked = true;
                  return true;
                },
              },
            },
          ),
        (error: unknown) => {
          assert.ok(error instanceof PluginIsolateError);
          assert.equal(error.receipt.memoryLimited, true);
          assert.equal(error.receipt.wasmMemoryLimitBytes, 16 * 1024 * 1024);
          return true;
        },
      );
    assert.equal(invoked, false, "over-budget guest cannot call the host");
  }
  await assert.rejects(
    () =>
      evaluateInIsolate(
        `
    const retained = []; while (true) retained.push(new Uint8Array(128 * 1024));
  `,
        { memoryLimitBytes: 1024 * 1024 },
      ),
    /memory limit exceeded|out of memory/,
  );
  assert.equal((await evaluateInIsolate("42")).value, 42, "host survives aggregate memory breach");

  // Guest error text is not authority for resource-failure receipts.
  await assert.rejects(
    () => evaluateInIsolate("throw new Error('out of memory')"),
    (error: unknown) => {
      assert.ok(error instanceof PluginIsolateError);
      assert.equal(error.receipt.memoryLimited, null);
      assert.equal(error.receipt.timedOut, false);
      return true;
    },
  );

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

  // Values that JSON.stringify would silently discard/coerce must never cross.
  const invalidValues = [
    "({ nested: { lost: () => 1 } })",
    "[1, undefined]",
    "[,1]",
    "new Date(0)",
    "new Map()",
    "new Set()",
    "new Uint8Array([1])",
    "({ x: Infinity })",
    "({ x: NaN })",
    "({ x: 1n })",
    "({ [Symbol()]: 1 })",
    "Object.defineProperty({}, 'hidden', { value: 1 })",
    "Object.assign(Array(1), { '0.5': 1 })",
    "({ toJSON() { return 1; } })",
    "({ get x() { throw new Error('getter ran'); } })",
    "(() => { const x = {}; x.self = x; return x; })()",
    "(() => { let x = {}; for (let i=0;i<70;i++) x = {x}; return x; })()",
    "Array(10001).fill(1)",
    "'x'.repeat(262145)",
  ];
  let hostCalls = 0;
  for (const code of invalidValues) {
    await assert.rejects(() => evaluateInIsolate(code), /boundary/);
    await assert.rejects(
      () =>
        evaluateInIsolate(`accept(${code})`, {
          bindings: {
            accept: () => {
              hostCalls++;
              return true;
            },
          },
        }),
      /boundary/,
    );
  }
  assert.equal(hostCalls, 0, "invalid arguments cannot invoke the host capability");
  // Host return values use the same plain-JSON rule, including getters and cycles.
  let getterCalls = 0;
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const invalidHostValues: unknown[] = [
    { x: () => 1 },
    [undefined],
    Array(1),
    new Date(0),
    new Map(),
    { x: Infinity },
    { x: BigInt(1) },
    { [Symbol()]: 1 },
    circular,
    Object.assign(Array(1), { "0.5": 1 }),
    {
      get x() {
        getterCalls++;
        return 1;
      },
    },
  ];
  for (const value of invalidHostValues)
    await assert.rejects(
      () =>
        evaluateInIsolate("read()", {
          bindings: { read: () => value as PluginJsonValue },
        }),
      /boundary/,
    );
  assert.equal(getterCalls, 0, "host result accessors must not execute during transport");
  // Repeated references are JSON values, not cycles. Own __proto__ remains data.
  const shared = { n: 1 };
  assert.deepEqual(
    (
      await evaluateInIsolate("read()", {
        bindings: { read: () => ({ a: shared, b: shared }) },
      })
    ).value,
    { a: { n: 1 }, b: { n: 1 } },
  );
  const prototypeData = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
  assert.deepEqual(
    (
      await evaluateInIsolate("read()", {
        bindings: { read: () => prototypeData },
      })
    ).value,
    prototypeData,
  );
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  const tampered = await evaluateInIsolate(
    `
    JSON.parse = () => 'forged'; JSON.stringify = () => 'forged';
    Reflect.ownKeys = () => []; Object.getOwnPropertyDescriptor = () => null;
    Object.prototype.toJSON = () => 'forged'; Array.prototype.toJSON = () => 'forged';
    WeakSet.prototype.has = () => false;
    read();
  `,
    { bindings: { read: () => ({ value: [1, true, null] }) } },
  );
  assert.deepEqual(tampered.value, { value: [1, true, null] });
  await assert.rejects(
    () =>
      evaluateInIsolate(`
    Object.prototype.value = 'forged';
    ({ get value() { return 'original'; } });
  `),
    /boundary/,
  );
  assert.deepEqual(
    (
      await evaluateInIsolate(`
    Object.defineProperty(Object.prototype, 'get', { get() { throw new Error('prototype getter ran'); } });
    ({ preserved: true });
  `)
    ).value,
    { preserved: true },
  );
  await assert.rejects(
    () =>
      evaluateInIsolate(`
    JSON.stringify = () => '{}'; Reflect.ownKeys = () => [];
    ({ lost: () => 1 });
  `),
    /boundary/,
  );
  await assert.rejects(
    () =>
      evaluateInIsolate(
        `
    throw Object.defineProperty({}, 'message', { get() { while (true) {} } });
  `,
        { timeoutMs: 100 },
      ),
    /evaluation failed/,
  );
  await assert.rejects(
    () =>
      evaluateInIsolate(
        `
    new Proxy({}, { ownKeys() { while (true) {} } });
  `,
        { timeoutMs: 100 },
      ),
    (error: unknown) => {
      assert.ok(error instanceof PluginIsolateError);
      assert.equal(error.receipt.timedOut, true);
      return true;
    },
  );
  assert.equal((await evaluateInIsolate("42")).value, 42, "host survives serialization timeout");
  for (const value of [NaN, Infinity, -Infinity, 0, -1, 0.5, 30001])
    await assert.rejects(
      () => evaluateInIsolate("while(true){}", { timeoutMs: value }),
      /timeoutMs/,
    );
  for (const value of [NaN, Infinity, -Infinity, 0, -1, 1.5, 64 * 1024 * 1024 + 1])
    await assert.rejects(
      () => evaluateInIsolate("1", { memoryLimitBytes: value }),
      /memoryLimitBytes/,
    );
  for (const probe of [
    "typeof db",
    "typeof supabase",
    "typeof XMLHttpRequest",
    "typeof WebSocket",
    "typeof importScripts",
    "typeof Buffer",
    "typeof __accelerateHost",
    "({}).constructor.constructor('return typeof process')()",
    "greet.constructor('return typeof require')()",
  ])
    assert.equal(
      (await evaluateInIsolate(probe, { bindings: { greet: () => "ok" } })).value,
      "undefined",
    );

  // Each later evaluation is a fresh context with a cached WASM module.
  const samples: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const run = await evaluateInIsolate("1 + 1");
    samples.push(run.receipt.elapsedMs);
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length / 2)]!;
  assert.ok(p50 < 50, `fresh-context p50 must stay under 50ms (got ${p50}ms)`);
  console.log(
    JSON.stringify({
      result: "passed",
      coldStartMs,
      freshContextP50ms: p50,
      checks: [
        "actual-first-evaluation",
        "fresh-context-budget",
        "declared-bindings",
        "no-ambient-authority",
        "strict-json-both-directions",
        "no-getter-execution",
        "prototype-data",
        "intrinsic-tampering",
        "resource-option-validation",
        "serialization-timeout-recovery",
        "timeout-kill",
        "memory-breach",
        "aggregate-memory-budget",
        "bounded-wasm-memory",
        "async-refusal",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
