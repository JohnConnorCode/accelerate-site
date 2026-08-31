import { randomUUID } from "node:crypto";
import { runPsql } from "./lib/accelerate-database.mjs";

function literal(value) { return `'${value.replaceAll("'", "''")}'`; }
function query(sql) {
  const scopedSql = `SET LOCAL request.headers = '{"x-tenant-id":"acce1e8e-0000-4000-8000-000000000001"}'; SET LOCAL request.jwt.claim.role = 'service_role'; ${sql}`;
  const result = runPsql(["--single-transaction", "-q", "-t", "-A", "--command", scopedSql]);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "Database query failed").trim());
  return result.stdout.trim();
}
function scalar(sql) {
  return query(sql).split("\n")[0];
}

const prefix = `qa-campaign-stop-${randomUUID()}`;
const contactIds = [];
let campaignId = null;
try {
  campaignId = scalar(`INSERT INTO public.campaigns (name, status, version, approved_version, policy) VALUES (${literal(prefix)}, 'active', 1, 1, '{"daily_limit":10}'::jsonb) RETURNING id`);
  const cases = [
    { label: "stopped-by-bounce", communicationStatus: "active", stopReason: "resend_bounced", expectedStatus: "bounced:resend_bounced" },
    { label: "suppressed-contact", communicationStatus: "suppressed", stopReason: null, expectedStatus: "active:" },
    { label: "inactive-contact", communicationStatus: "inactive", stopReason: null, expectedStatus: "active:" },
  ];
  const members = [];
  for (const testCase of cases) {
    const email = `${prefix}-${testCase.label}@example.invalid`;
    const contactId = scalar(`INSERT INTO public.contacts (full_name, primary_email, communication_status, source) VALUES (${literal(`Campaign stop QA ${testCase.label}`)}, ${literal(email)}, ${literal(testCase.communicationStatus)}, ${literal(prefix)}) RETURNING id`);
    contactIds.push(contactId);
    const memberId = scalar(`INSERT INTO public.campaign_members (campaign_id, contact_id, email, status, next_send_at) VALUES (${literal(campaignId)}::uuid, ${literal(contactId)}::uuid, ${literal(email)}, 'active', now()) RETURNING id`);
    members.push({ ...testCase, contactId, memberId });
  }

  const bounceCase = members[0];
  const stopped = query(`SELECT count(*) FROM public.stop_campaign_memberships(${literal(bounceCase.contactId)}::uuid, ${literal(campaignId)}::uuid, 'resend_bounced')`);
  if (stopped !== "1") throw new Error(`Expected one stopped membership, got ${stopped}`);
  const results = [];
  for (const testCase of members) {
    const claimed = query(`SELECT count(*) FROM public.claim_campaign_member_send(${literal(testCase.memberId)}::uuid, ${literal(`${prefix}:${testCase.label}:send`)})`);
    if (claimed !== "0") throw new Error(`${testCase.label} contact/member was claimed for send`);
    const status = query(`SELECT status || ':' || coalesce(stop_reason, '') FROM public.campaign_members WHERE id = ${literal(testCase.memberId)}::uuid`);
    if (status !== (testCase.expectedStatus === "active:" ? "active:" : testCase.expectedStatus)) throw new Error(`Unexpected ${testCase.label} member state ${status}`);
    results.push({ label: testCase.label, claimed: false, status });
  }
  console.log(JSON.stringify({ campaignId, cases: results, result: "stop claim boundary passed" }));
} finally {
  if (campaignId) query(`DELETE FROM public.campaigns WHERE id = ${literal(campaignId)}::uuid`);
  for (const contactId of contactIds) query(`DELETE FROM public.contacts WHERE id = ${literal(contactId)}::uuid`);
}
