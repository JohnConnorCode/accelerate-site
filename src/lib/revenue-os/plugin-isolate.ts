import "server-only";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  RELEASE_SYNC,
  type QuickJSHandle,
  type QuickJSWASMModule,
} from "quickjs-emscripten";

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
  null | boolean | number | string | PluginJsonValue[] | { [key: string]: PluginJsonValue };

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
  /** Null when an allocation failure cannot be independently classified. */
  memoryLimited: boolean | null;
  wasmMemoryLimitBytes: number;
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

// Capture pristine intrinsics before any plugin runs. This closure stays private:
// plugin code cannot replace its parser/encoder by mutating global JSON/Object.
const JSON_CODEC = `(() => {
  const keys = Reflect.ownKeys, descriptor = Object.getOwnPropertyDescriptor;
  const prototype = Object.getPrototypeOf, create = Object.create;
  const define = Object.defineProperty, setPrototype = Object.setPrototypeOf;
  const isArray = Array.isArray, finite = Number.isFinite, integer = Number.isInteger;
  const objectPrototype = Object.prototype, arrayPrototype = Array.prototype;
  const stringify = JSON.stringify, parse = JSON.parse, ErrorType = Error;
  const WeakSetType = WeakSet;
  const owns = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  const has = Function.prototype.call.bind(WeakSet.prototype.has);
  const add = Function.prototype.call.bind(WeakSet.prototype.add);
  const remove = Function.prototype.call.bind(WeakSet.prototype.delete);
  const reject = () => { throw new ErrorType('non-JSON value at isolate boundary; sync code only'); };
  return {
    parse,
    describe(error) {
      if (typeof error === 'string') return error;
      if (error !== null && typeof error === 'object') {
        const item = descriptor(error, 'message');
        if (item && owns(item, 'value') && typeof item.value === 'string') return item.value;
      }
      return 'plugin evaluation failed';
    },
    encode(value) {
      const ancestors = new WeakSetType();
      let nodes = 0, characters = 0;
      function clone(value, depth) {
        if (++nodes > 10000 || depth > 64) reject();
        if (value === null || typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          characters += value.length;
          if (characters > 262144) reject();
          return value;
        }
        if (typeof value === 'number') { if (!finite(value)) reject(); return value; }
        if (typeof value !== 'object' || has(ancestors, value)) reject();
        const array = isArray(value), parent = prototype(value);
        if (parent !== null && parent !== (array ? arrayPrototype : objectPrototype)) reject();
        add(ancestors, value);
        const names = keys(value);
        const length = array ? descriptor(value, 'length').value : 0;
        if (array && (length > 10000 || names.length !== length + 1)) reject();
        const result = array ? setPrototype([], null) : create(null);
        for (let i = 0; i < names.length; i++) {
          const key = names[i];
          if (array && key === 'length') continue;
          if (typeof key !== 'string') reject();
          characters += key.length;
          if (characters > 262144) reject();
          if (array && (!integer(+key) || key !== '' + (+key) || +key < 0 || +key >= length)) reject();
          const item = descriptor(value, key);
          if (!item || !item.enumerable || !owns(item, 'value')) reject();
          const property = create(null);
          property.value = clone(item.value, depth + 1); property.enumerable = true;
          define(result, key, property);
        }
        remove(ancestors, value);
        return result;
      }
      const encoded = stringify(clone(value, 0));
      if (encoded.length > 262144) reject();
      return encoded;
    }
  };
})()`;

const MAX_JSON_BYTES = 256 * 1024;
const MAX_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;

/** Trusted host results still must be plain, bounded JSON, without coercion. */
function encodeHostJson(value: unknown): string {
  const ancestors = new Set<object>();
  let nodes = 0,
    characters = 0;
  const scan = (node: unknown, depth: number): unknown => {
    if (++nodes > 10000 || depth > 64) throw new Error("JSON boundary structure exceeds limits");
    if (node === null || typeof node === "boolean") return node;
    if (typeof node === "string") {
      characters += node.length;
      if (characters > MAX_JSON_BYTES) throw new Error("JSON boundary payload exceeds 256 KiB");
      return node;
    }
    if (typeof node === "number" && Number.isFinite(node)) return node;
    if (typeof node !== "object" || ancestors.has(node))
      throw new Error("Non-JSON value at isolate boundary");
    const array = Array.isArray(node);
    const parent = Object.getPrototypeOf(node);
    if (parent !== null && parent !== (array ? Array.prototype : Object.prototype))
      throw new Error("Non-plain value at isolate boundary");
    ancestors.add(node);
    const keys = Reflect.ownKeys(node);
    const length = array ? node.length : 0;
    if (array && (length > 10000 || keys.length !== length + 1))
      throw new Error("Sparse or extended array at isolate boundary");
    const result = array ? Object.setPrototypeOf([], null) : Object.create(null);
    for (const key of keys) {
      if (array && key === "length") continue;
      const item = Object.getOwnPropertyDescriptor(node, key);
      if (typeof key !== "string" || !item?.enumerable || !Object.hasOwn(item, "value"))
        throw new Error("Unsupported property at isolate boundary");
      if (array && (!Number.isInteger(+key) || key !== String(+key) || +key < 0 || +key >= length))
        throw new Error("Unsupported array property at isolate boundary");
      characters += key.length;
      if (characters > MAX_JSON_BYTES) throw new Error("JSON boundary payload exceeds 256 KiB");
      Object.defineProperty(result, key, { value: scan(item.value, depth + 1), enumerable: true });
    }
    ancestors.delete(node);
    return result;
  };
  const json = JSON.stringify(scan(value, 0));
  if (Buffer.byteLength(json) > MAX_JSON_BYTES)
    throw new Error("JSON boundary payload exceeds 256 KiB");
  return json;
}

// Published QuickJS 0.32 aggregate malloc accounting can miss string/buffer
// allocations (upstream #255). Bound the underlying memory independently, and
// check actual usage at interrupts and host/return boundaries. This prebuilt
// module imports at least 16 MiB; the ceiling includes engine overhead.
const WASM_PAGE_BYTES = 64 * 1024;
const modules = new Map<number, Promise<QuickJSWASMModule>>();
function boundedModule(bytes: number) {
  const existing = modules.get(bytes);
  if (existing) return existing;
  const pages = bytes / WASM_PAGE_BYTES;
  const pending = newQuickJSWASMModuleFromVariant(
    newVariant(RELEASE_SYNC, {
      wasmMemory: new WebAssembly.Memory({ initial: pages, maximum: pages }),
    }),
  );
  // Only four bounded module variants may be retained. Evaluation after await
  // is synchronous, so no active guest yields its context to another evaluation.
  if (modules.size >= 4) modules.delete(modules.keys().next().value!);
  modules.set(bytes, pending);
  void pending.catch(() => {
    if (modules.get(bytes) === pending) modules.delete(bytes);
  });
  return pending;
}

export class PluginIsolateError extends Error {
  constructor(
    message: string,
    public readonly receipt: PluginIsolateReceipt,
  ) {
    super(message);
    this.name = "PluginIsolateError";
  }
}

export async function evaluateInIsolate(
  code: string,
  options: PluginIsolateOptions = {},
): Promise<{ value: PluginJsonValue; receipt: PluginIsolateReceipt }> {
  const pluginId = options.pluginId ?? null;
  const started = performance.now();
  let timedOut = false,
    memoryExceeded = false;
  let wasmMemoryLimitBytes = 0;
  const receipt = (): PluginIsolateReceipt => ({
    pluginId,
    elapsedMs: performance.now() - started,
    timedOut,
    memoryLimited: memoryExceeded,
    wasmMemoryLimitBytes,
  });
  const fail = (message: string): never => {
    throw new PluginIsolateError(
      `Plugin${pluginId ? ` ${pluginId}` : ""} isolate refused: ${message}`,
      { ...receipt(), memoryLimited: memoryExceeded ? true : null },
    );
  };
  if (typeof code !== "string" || !code.trim()) fail("no code to evaluate");
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES)
    fail(`code exceeds the ${MAX_CODE_BYTES}-byte limit`);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const memoryLimitBytes = options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS)
    fail("timeoutMs must be an integer between 1 and 30000");
  if (
    !Number.isInteger(memoryLimitBytes) ||
    memoryLimitBytes < 256 * 1024 ||
    memoryLimitBytes > MAX_MEMORY_LIMIT_BYTES
  )
    fail("memoryLimitBytes must be an integer between 256 KiB and 64 MiB");
  const bindings = options.bindings ?? {};
  for (const name of Object.keys(bindings)) {
    if (typeof bindings[name] !== "function")
      fail(`binding ${JSON.stringify(name)} is not a function`);
    if (!BINDING_NAME_PATTERN.test(name) || RESERVED_BINDING_NAMES.has(name))
      fail(`binding ${JSON.stringify(name)} is not a safe global name`);
  }
  wasmMemoryLimitBytes = Math.max(
    16 * 1024 * 1024,
    Math.ceil((memoryLimitBytes + 2 * 1024 * 1024) / WASM_PAGE_BYTES) * WASM_PAGE_BYTES,
  );
  const quickjs = await boundedModule(wasmMemoryLimitBytes);
  const runtime = quickjs.newRuntime();
  try {
    runtime.setMemoryLimit(memoryLimitBytes);
    runtime.setMaxStackSize(256 * 1024);
    const deadline = performance.now() + timeoutMs;
    const context = runtime.newContext();
    let inspectingMemory = false;
    const overMemory = () => {
      if (inspectingMemory) return memoryExceeded;
      inspectingMemory = true;
      let usage: QuickJSHandle | undefined;
      let size: QuickJSHandle | undefined;
      try {
        usage = runtime.computeMemoryUsage();
        size = context.getProp(usage, "memory_used_size");
        const bytes = context.getNumber(size);
        memoryExceeded ||= !Number.isFinite(bytes) || bytes > memoryLimitBytes;
      } catch {
        // A failed accounting read cannot authorize continued guest execution.
        memoryExceeded = true;
      } finally {
        size?.dispose();
        usage?.dispose();
        inspectingMemory = false;
      }
      return memoryExceeded;
    };
    runtime.setInterruptHandler(() => {
      if (performance.now() >= deadline) timedOut = true;
      return timedOut || overMemory();
    });
    const owned: QuickJSHandle[] = [];
    try {
      const codec = context.evalCode(JSON_CODEC, "host-json-codec.js");
      if (codec.error) {
        codec.error.dispose();
        fail("JSON boundary initialization failed");
      }
      if (!("value" in codec)) return fail("JSON boundary initialization failed");
      const codecHandle = codec.value;
      owned.push(codecHandle);
      const encoder = context.getProp(codecHandle, "encode");
      const parser = context.getProp(codecHandle, "parse");
      const describe = context.getProp(codecHandle, "describe");
      owned.push(encoder, parser, describe);
      const errorMessage = (handle: QuickJSHandle): string => {
        if (memoryExceeded) return `memory limit exceeded (${memoryLimitBytes} bytes)`;
        if (timedOut) return `timed out after ${timeoutMs}ms`;
        const result = context.callFunction(describe, context.undefined, handle);
        if (result.error) {
          result.error.dispose();
          return "plugin evaluation failed";
        }
        try {
          return context.getString(result.value).slice(0, 1000);
        } finally {
          result.value.dispose();
        }
      };
      const readJson = (handle: QuickJSHandle): PluginJsonValue => {
        const result = context.callFunction(encoder, context.undefined, handle);
        if (result.error) {
          try {
            throw new Error(errorMessage(result.error));
          } finally {
            result.error.dispose();
          }
        }
        try {
          const json = context.getString(result.value);
          if (Buffer.byteLength(json) > MAX_JSON_BYTES)
            throw new Error("JSON boundary payload exceeds 256 KiB");
          return JSON.parse(json) as PluginJsonValue;
        } finally {
          result.value.dispose();
        }
      };
      let bindingCalls = 0;
      for (const [name, fn] of Object.entries(bindings)) {
        const handle = context.newFunction(name, (...args) => {
          try {
            if (++bindingCalls > 10000 || args.length > 32)
              throw new Error("Host binding call limit exceeded");
            if (performance.now() >= deadline) {
              timedOut = true;
              throw new Error(`timed out after ${timeoutMs}ms`);
            }
            if (overMemory()) throw new Error(`memory limit exceeded (${memoryLimitBytes} bytes)`);
            const values = args.map(readJson);
            const json = encodeHostJson(fn(...values));
            const jsonHandle = context.newString(json);
            try {
              return context.callFunction(parser, context.undefined, jsonHandle);
            } finally {
              jsonHandle.dispose();
            }
          } catch (error) {
            return {
              error: context.newString(
                error instanceof Error ? error.message : "Host binding refused",
              ),
            };
          }
        });
        try {
          context.setProp(context.global, name, handle);
        } finally {
          handle.dispose();
        }
      }
      const result = context.evalCode(code, "plugin.js");
      if (result.error) {
        try {
          fail(errorMessage(result.error));
        } finally {
          result.error.dispose();
        }
      }
      if (!("value" in result)) return fail("evaluation returned no usable value");
      try {
        if (overMemory()) return fail(`memory limit exceeded (${memoryLimitBytes} bytes)`);
        const value = readJson(result.value);
        if (performance.now() >= deadline) {
          timedOut = true;
          fail(`timed out after ${timeoutMs}ms`);
        }
        return { value, receipt: receipt() };
      } catch (error) {
        if (error instanceof PluginIsolateError) throw error;
        return fail(error instanceof Error ? error.message : "JSON boundary refused");
      } finally {
        result.value.dispose();
      }
    } finally {
      for (const handle of owned.reverse()) handle.dispose();
      context.dispose();
    }
  } finally {
    runtime.dispose();
  }
}
