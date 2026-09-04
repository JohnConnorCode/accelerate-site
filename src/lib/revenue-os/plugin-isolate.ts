import "server-only";
import { getQuickJS, type QuickJSContext, type QuickJSHandle } from "quickjs-emscripten";

/**
 * Plugin isolate host (Plugin Platform phase 2): runs plugin code with no
 * ambient authority.
 *
 * Each evaluation gets a fresh QuickJS runtime and context: no filesystem,
 * no environment, no network, no timers — those host functions simply do
 * not exist inside. The only host surface is the declared `bindings` map,
 * installed by name; a plugin calling anything else gets a ReferenceError
 * because there is no function to call. Enforcement is by absence, never
 * by a runtime permission check.
 *
 * Bounds are enforced by the runtime, not by convention: a memory limit
 * fails allocations cleanly and an interrupt deadline terminates hangs, so
 * a breach ends that evaluation instead of degrading the host.
 *
 * Deliberate limits (escalate as core gaps, never work around):
 * - synchronous code only. Async plugin execution is a future primitive;
 *   a Promise return is refused rather than half-awaited.
 * - JSON values cross the boundary in both directions. Handles, functions,
 *   and symbols are refused rather than coerced.
 *
 * Why QuickJS over node:vm or worker_threads: neither is a security
 * boundary (documented as such), and both expose the full Node API set by
 * default. QuickJS exposes nothing unless bridged.
 */

export type PluginJsonValue =
  | null
  | boolean
  | number
  | string
  | PluginJsonValue[]
  | { [key: string]: PluginJsonValue };

export interface PluginBinding {
  (...args: PluginJsonValue[]): PluginJsonValue;
}

export interface PluginIsolateOptions {
  /** Bytes of isolate heap. Defaults to 8 MiB. */
  memoryLimitBytes?: number;
  /** Wall-clock budget. Defaults to 2000ms. */
  timeoutMs?: number;
  /** Declared host capabilities, installed by name and nothing else. */
  bindings?: Record<string, PluginBinding>;
  /** Label for error messages and receipts. */
  pluginId?: string;
}

export interface PluginIsolateReceipt {
  pluginId: string | null;
  elapsedMs: number;
  timedOut: boolean;
  memoryLimited: boolean;
}

const DEFAULT_MEMORY_LIMIT_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 2000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_CODE_BYTES = 256 * 1024;
const BINDING_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED_BINDING_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
]);

function assertJson(value: unknown, what: string): asserts value is PluginJsonValue {
  // Deep scan, because JSON.stringify silently drops functions nested in
  // objects ({a: fn} becomes {}) instead of failing. Anything that would
  // not survive a JSON round trip identically must refuse loudly.
  const seen = new Set<unknown>();
  const scan = (node: unknown, path: string): void => {
    if (node === null) return;
    switch (typeof node) {
      case "string":
      case "boolean":
        return;
      case "number":
        if (!Number.isFinite(node))
          throw new Error(`${what} carries non-finite number at ${path} across the isolate boundary`);
        return;
      case "undefined":
      case "function":
      case "symbol":
      case "bigint":
        throw new Error(
          `${what} carries ${typeof node} at ${path} across the isolate boundary`,
        );
      case "object": {
        if (seen.has(node)) throw new Error(`${what} is circular at ${path}`);
        seen.add(node);
        if (Array.isArray(node)) node.forEach((item, i) => scan(item, `${path}[${i}]`));
        else for (const [key, item] of Object.entries(node)) scan(item, `${path}.${key}`);
        return;
      }
      default:
        throw new Error(`${what} is not JSON-serializable across the isolate boundary`);
    }
  };
  scan(value, "$");
}

/** Refuse function handles before dump() coerces them into silence. */
function assertNotFunctionHandle(ctx: QuickJSContext, handle: QuickJSHandle, what: string): void {
  if (ctx.typeof(handle) === "function")
    throw new Error(`${what} is a function across the isolate boundary`);
}

function toHandle(ctx: QuickJSContext, value: PluginJsonValue): QuickJSHandle {
  if (value === null || value === undefined) return ctx.undefined;
  switch (typeof value) {
    case "string":
      return ctx.newString(value);
    case "number":
      return ctx.newNumber(value);
    case "boolean": {
      // No boolean constructor exists; a literal keeps the type exact
      // across the boundary instead of coercing true to 1.
      const handle = ctx.evalCode(value ? "true" : "false");
      if (handle && typeof handle === "object" && "value" in handle)
        return (handle as { value: QuickJSHandle }).value;
      throw new Error("could not marshal a boolean across the isolate boundary");
    }
    default: {
      // Structured values cross as structures, never stringified: a quiet
      // stringification would change what the plugin observes.
      if (Array.isArray(value)) {
        const array = ctx.newArray();
        value.forEach((item, index) => {
          const element = toHandle(ctx, item);
          ctx.setProp(array, index, element);
          element.dispose();
        });
        return array;
      }
      const object = ctx.newObject();
      for (const [key, item] of Object.entries(value)) {
        const prop = toHandle(ctx, item);
        ctx.setProp(object, key, prop);
        prop.dispose();
      }
      return object;
    }
  }
}

/** True when the handle is a thenable. Callers must still dispose the handle. */
function isThenable(ctx: QuickJSContext, handle: QuickJSHandle): boolean {
  let thenProp: QuickJSHandle | null = null;
  let result = false;
  try {
    thenProp = ctx.getProp(handle, "then");
    result = ctx.typeof(thenProp) === "function";
  } catch (error) {
    console.error(
      `[plugin-isolate] thenable probe failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  if (thenProp) {
    try {
      thenProp.dispose();
    } catch (error) {
      console.error(
        `[plugin-isolate] thenable-probe disposal failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }
  return result;
}

export async function evaluateInIsolate(
  code: string,
  options: PluginIsolateOptions = {},
): Promise<{ value: PluginJsonValue; receipt: PluginIsolateReceipt }> {
  const pluginId = options.pluginId ?? null;
  const started = Date.now();
  const fail = (message: string): never => {
    throw new Error(`Plugin${pluginId ? ` ${pluginId}` : ""} isolate refused: ${message}`);
  };
  if (typeof code !== "string" || !code.trim()) fail("no code to evaluate");
  // The code string itself lives in host memory, outside the isolate heap
  // the memory limit guards — cap it so a giant payload cannot DoS the host.
  if (code.length > MAX_CODE_BYTES)
    fail(`code exceeds the ${MAX_CODE_BYTES}-byte limit`);
  const timeoutMs = Math.max(1, Math.min(MAX_TIMEOUT_MS, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));
  const memoryLimitBytes = Math.max(
    256 * 1024,
    Math.floor(options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES),
  );
  const bindings = options.bindings ?? {};
  for (const name of Object.keys(bindings)) {
    if (typeof bindings[name] !== "function") fail(`binding ${JSON.stringify(name)} is not a function`);
    // A binding installs onto the isolate global: names that shadow
    // prototype machinery would corrupt the isolate itself.
    if (!BINDING_NAME_PATTERN.test(name) || RESERVED_BINDING_NAMES.has(name))
      fail(`binding ${JSON.stringify(name)} is not a safe global name`);
  }

  const quickjs = await getQuickJS();
  const runtime = quickjs.newRuntime();
  try {
    runtime.setMemoryLimit(memoryLimitBytes);
    const deadline = Date.now() + timeoutMs;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    const context = runtime.newContext();
    try {
      for (const [name, fn] of Object.entries(bindings)) {
        const handle = context.newFunction(name, function (...args) {
          for (const arg of args) assertNotFunctionHandle(context, arg, `binding ${name} argument`);
          const dumped = args.map((arg) => context.dump(arg));
          assertJson(dumped, `binding ${name} arguments`);
          let result: unknown;
          try {
            result = fn(...(dumped as PluginJsonValue[]));
          } catch (error) {
            throw context.newString(error instanceof Error ? error.message : String(error));
          }
          assertJson(result, `binding ${name} result`);
          return toHandle(context, result as PluginJsonValue);
        });
        context.setProp(context.global, name, handle);
        handle.dispose();
      }
      const result = context.evalCode(code, "plugin.js");
      const elapsedMs = Date.now() - started;
      const receipt: PluginIsolateReceipt = {
        pluginId,
        elapsedMs,
        timedOut: false,
        memoryLimited: false,
      };
      if (result && typeof result === "object" && "error" in result) {
        const errorHandle = (result as { error?: QuickJSHandle }).error;
        if (errorHandle) {
          const dumped = context.dump(errorHandle);
          errorHandle.dispose();
          const message =
            typeof dumped === "object" && dumped !== null
              ? String((dumped as Record<string, unknown>).message ?? JSON.stringify(dumped))
              : String(dumped);
          if (/interrupted/i.test(message)) {
            receipt.timedOut = true;
            fail(`timed out after ${timeoutMs}ms`);
          }
          if (/memory|alloc/i.test(message)) receipt.memoryLimited = true;
          fail(message);
        }
        fail("evaluation failed without a usable error");
      }
      if (!result || typeof result !== "object" || !("value" in result))
        fail("evaluation returned no usable value");
      const valueHandle = (result as { value: QuickJSHandle }).value;
      try {
        if (isThenable(context, valueHandle))
          fail("async plugin results are refused: sync code only in this primitive");
        assertNotFunctionHandle(context, valueHandle, "plugin return value");
        const value = context.dump(valueHandle);
        assertJson(value, "plugin return value");
        return {
          value: value as PluginJsonValue,
          receipt: { ...receipt, elapsedMs: Date.now() - started },
        };
      } finally {
        valueHandle.dispose();
      }
    } finally {
      context.dispose();
    }
  } finally {
    runtime.dispose();
  }
}
