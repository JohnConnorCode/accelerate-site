import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  runPsql,
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
} from "./lib/accelerate-database.mjs";
assert.ok(["localhost", "127.0.0.1"].includes(POOLER_HOST));
const tenant = "acce1e8e-0000-4000-8000-000000000001",
  foreign = "22222222-2222-4222-8222-222222222222";
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const context = (t = tenant) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
function sql(input) {
  const r = runPsql(["-qAt"], { input });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fails(input, pattern) {
  const r = runPsql(["-qAt"], { input });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, pattern);
}
const contact = randomUUID(),
  opportunity = randomUUID(),
  asset = randomUUID();
const cfg = {
  modules: { "opportunity-radar": true },
  moduleSettings: {
    "opportunity-radar": {
      outreachMode: "approval-required",
      outreachDailyLimit: 5,
      outreachCooldownHours: 24,
    },
  },
};
sql(
  `UPDATE tenants SET config=${json(cfg)},status='active' WHERE id IN ('${tenant}','${foreign}'); INSERT INTO contacts(id,tenant_id,full_name,primary_email,communication_status) VALUES('${contact}','${tenant}','Outreach fixture','outreach@example.test','active'); INSERT INTO radar_opportunities(id,tenant_id,title,summary,recommended_action,kind,contact_id) VALUES('${opportunity}','${tenant}','Collaboration','Supplied evidence','Review','partnership','${contact}'); INSERT INTO radar_assets(id,tenant_id,opportunity_id,kind,title,body_text) VALUES('${asset}','${tenant}','${opportunity}','outreach_draft','Workshop collaboration','Could we review a practical outline?');`,
);
function action() {
  const id = randomUUID(),
    digest = "a".repeat(64);
  const preview = {
    digest,
    config: cfg,
    opportunityId: opportunity,
    revision: 1,
    assetId: asset,
    subject: "Workshop collaboration",
    text: "Could we review a practical outline?",
    recipients: [{ contactId: contact, email: "outreach@example.test" }],
  };
  sql(
    `INSERT INTO action_queue(id,tenant_id,action_type,title,status,approved_by,approved_at,expires_at,payload) VALUES('${id}','${tenant}','send_radar_outreach','Outreach','executing','owner@example.test',now(),now()+interval '1 hour',${json({ digest, preview })});`,
  );
  return id;
}
const reserve = (id, t = tenant) => context(t) + `SELECT reserve_radar_outreach('${id}');`;
const reconcile = (id) => context() + `SELECT reconcile_radar_outreach('${id}');`;
const a = action();
fails(reserve(a, foreign), /workspace|approval/);
sql(`UPDATE contacts SET communication_status='suppressed' WHERE id='${contact}';`);
fails(reserve(a), /suppressed/);
sql(`UPDATE contacts SET communication_status='active' WHERE id='${contact}';`);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{moduleSettings,opportunity-radar,outreachMode}','"draft-only"') WHERE id='${tenant}';`,
);
fails(reserve(a), /draft-only/);
sql(`UPDATE tenants SET config=${json(cfg)} WHERE id='${tenant}';`);
sql(
  `CREATE OR REPLACE FUNCTION public.fail_radar_outreach_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='radar.outreach_reserved' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_radar_outreach_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_radar_outreach_audit();`,
);
fails(reserve(a), /fixture audit failure/);
assert.equal(sql(`SELECT count(*) FROM radar_outreach_attempts WHERE action_id='${a}';`), "0");
sql("DROP TRIGGER fixture_radar_outreach_audit ON audit_log;");
function concurrent(input) {
  return new Promise((resolve) => {
    const p = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.on("close", (code) => resolve({ code, out, err }));
    p.stdin.end(input);
  });
}
const b = action();
const race = await Promise.all([concurrent(reserve(a)), concurrent(reserve(b))]);
assert.equal(race.filter((r) => r.code === 0).length, 1);
const winner = race[0].code === 0 ? a : b,
  loser = winner === a ? b : a;
assert.equal(JSON.parse(sql(reserve(winner))).reserved, false);
assert.equal(JSON.parse(sql(reconcile(winner))).state, "uncertain");
fails(reserve(loser), /unresolved/);
const conversation = randomUUID(),
  message = randomUUID();
sql(
  `INSERT INTO conversations(id,tenant_id,channel,contact_id) VALUES('${conversation}','${tenant}','resend','${contact}'); INSERT INTO messages(id,tenant_id,conversation_id,direction,idempotency_key,status,provider_id,sent_at) VALUES('${message}','${tenant}','${conversation}','outbound','action:${winner}','sent','controlled-provider',now()); UPDATE tenants SET config=jsonb_set(config,'{modules,opportunity-radar}','false') WHERE id='${tenant}';`,
);
const receipt = JSON.parse(sql(reconcile(winner)));
assert.equal(receipt.state, "sent");
assert.deepEqual(JSON.parse(sql(reconcile(winner))), receipt);
assert.equal(receipt.message_id, message);
sql(`UPDATE tenants SET config=${json(cfg)} WHERE id='${tenant}';`);
fails(reserve(loser), /cooldown/);
assert.equal(sql(context(foreign) + "SELECT count(*) FROM radar_outreach_attempts;"), "0");
fails(context() + "DELETE FROM radar_outreach_attempts;", /permission denied/);
fails(`SET ROLE authenticated; SELECT reserve_radar_outreach('${a}');`, /permission denied/);
// A recorded pre-dispatch failure releases the hold only through observation.
sql(
  `UPDATE radar_outreach_attempts SET sent_at=now()-interval '2 days' WHERE action_id='${winner}'; UPDATE messages SET sent_at=now()-interval '2 days' WHERE id='${message}';`,
);
assert.equal(JSON.parse(sql(reserve(loser))).reserved, true);
sql(
  `INSERT INTO messages(id,tenant_id,conversation_id,direction,idempotency_key,status,metadata) VALUES('${randomUUID()}','${tenant}','${conversation}','outbound','action:${loser}','failed','{"dispatch_attempted":false}');`,
);
assert.equal(JSON.parse(sql(reconcile(loser))).state, "not_sent");
console.log(
  "PASS: native Radar atomic reservation/concurrent approvals, replay, suppression, configuration, cooldown, uncertainty hold, confirmed non-send, recovery after disable, tenant/role isolation and audit rollback.",
);
