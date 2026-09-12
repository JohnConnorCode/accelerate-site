// Controlled native fixture transport only. Business transitions run through the
// real work-items service; this translates its bounded Supabase calls to psql.
import { spawnSync } from "node:child_process";
import { withWorkItem } from "../../src/lib/revenue-os/work-items.ts";

const config = JSON.parse(process.env.PHASE_B_WORK_FIXTURE);
const ident = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Invalid fixture identifier");
  return `"${value}"`;
};
const literal = (value) =>
  value === null
    ? "NULL"
    : `'${(typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
function sql(statement) {
  const result = spawnSync("psql", config.args, {
    encoding: "utf8",
    input: `${config.context} ${statement}`,
  });
  if (result.status !== 0) throw new Error(result.stderr || "Fixture SQL failed");
  return result.stdout.trim();
}
function query(table) {
  if (!["work_items", "audit_log", "activities"].includes(table))
    throw new Error("Unexpected fixture table");
  const filters = [];
  let operation = "select",
    values,
    single = false;
  const chain = {
    select() {
      return chain;
    },
    insert(value) {
      operation = "insert";
      values = value;
      return chain;
    },
    update(value) {
      operation = "update";
      values = value;
      return chain;
    },
    eq(key, value) {
      filters.push(`${ident(key)}=${literal(value)}`);
      return chain;
    },
    gt(key, value) {
      filters.push(`${ident(key)}>${literal(value)}`);
      return chain;
    },
    in(key, value) {
      filters.push(`${ident(key)} IN (${value.map(literal).join(",")})`);
      return chain;
    },
    single() {
      single = true;
      return chain;
    },
    maybeSingle() {
      single = true;
      return chain;
    },
    then(resolve, reject) {
      try {
        const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
        const entries = Object.entries(values ?? {});
        const statement =
          operation === "select"
            ? `SELECT * FROM ${ident(table)}${where}`
            : operation === "update"
              ? `UPDATE ${ident(table)} SET ${entries.map(([k, v]) => `${ident(k)}=${literal(v)}`).join(",")}${where} RETURNING *`
              : `INSERT INTO ${ident(table)} (${entries.map(([k]) => ident(k)).join(",")}) VALUES (${entries.map(([, v]) => literal(v)).join(",")}) RETURNING *`;
        const rows = JSON.parse(
          sql(
            `WITH receipt AS (${statement}) SELECT coalesce(jsonb_agg(to_jsonb(receipt)),'[]') FROM receipt;`,
          ),
        );
        resolve({ data: single ? (rows[0] ?? null) : rows, error: null });
      } catch (error) {
        resolve({ data: null, error: { message: error.message } });
      }
      return Promise.resolve().catch(reject);
    },
  };
  return chain;
}
const db = {
  from: query,
  rpc(name, input) {
    if (name !== "claim_work_item") throw new Error("Unexpected fixture RPC");
    return {
      async single() {
        try {
          const data = JSON.parse(
            sql(
              `SELECT to_jsonb(r) FROM claim_work_item(${Object.entries(input)
                .map(([k, v]) => `${ident(k)}=>${literal(v)}`)
                .join(",")}) r;`,
            ),
          );
          return { data, error: null };
        } catch (error) {
          return { data: null, error: { message: error.message } };
        }
      },
    };
  },
};
process.send({ event: "ready" });
await new Promise((resolve) => process.once("message", resolve));
const result = await withWorkItem(
  db,
  config.kind,
  async (item) => {
    if (config.mode === "defer")
      return {
        status: "deferred",
        outcome: "Controlled prerequisite unavailable",
        nextCheckAt: new Date(Date.now() + 60_000).toISOString(),
      };
    if (config.mode === "fail")
      return { status: "failed", outcome: "Controlled provider refused before effect" };
    // A real canonical budget reservation is the durable, idempotent effect. This
    // tests local persistence; no claim about external provider delivery is made.
    const effect = JSON.parse(
      sql(
        `SELECT to_jsonb(r) FROM claim_budget_usage('sales','vendor_api_calls',1,${literal(`phase-b:${item.id}`)},null) r;`,
      ),
    );
    // Replay confirms the already-saved reservation; it deliberately does not
    // authorize another effect. Only a new denied reservation is a failure.
    if (!effect.allowed && !effect.replayed) throw new Error("Controlled effect budget denied");
    process.send({
      event: "effect",
      itemId: item.id,
      replayed: effect.replayed,
      leaseExpiresAt: item.lease_expires_at,
    });
    if (config.mode === "interrupt") {
      // Keep an actual running process at the interruption barrier. A pending
      // Promise alone lets Node exit instead of waiting for the parent's kill.
      await new Promise(() => setInterval(() => {}, 1_000));
    }
    return {
      status: "completed",
      outcome: "One canonical budget reservation confirmed",
      value: effect,
    };
  },
  { leaseOwner: `phase-b:${process.pid}`, leaseDurationMs: 60_000 },
);
process.send({ event: "result", result });
process.disconnect();
