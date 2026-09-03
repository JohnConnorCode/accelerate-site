import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: allContacts } = await sb.from("contacts").select("id,primary_email,tenant_id,created_at").ilike("primary_email", "qa-inbound-%").order("created_at", { ascending: false }).limit(5);
console.log("ALL contacts:", JSON.stringify(allContacts, null, 2));
const { data: allOpps } = await sb.from("opportunities").select("id,email,stage,tenant_id,source,source_detail,created_at").ilike("email", "qa-inbound-%").order("created_at", { ascending: false }).limit(5);
console.log("ALL opps:", JSON.stringify(allOpps, null, 2));
const { data: allSubs } = await sb.from("contact_submissions").select("id,email,tenant_id,created_at").ilike("email", "qa-inbound-%").order("created_at", { ascending: false }).limit(5);
console.log("ALL subs:", JSON.stringify(allSubs, null, 2));
const { data: tenants } = await sb.from("tenants").select("id,slug,name").limit(5);
console.log("tenants:", JSON.stringify(tenants, null, 2));
