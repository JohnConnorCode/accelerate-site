import { createClient } from "@supabase/supabase-js";

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_EMAIL",
]) {
  if (!process.env[key]?.trim()) throw new Error(`${key} is required`);
}

const authSettingsResponse = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
  {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  },
);
if (!authSettingsResponse.ok)
  throw new Error(`Supabase Auth settings returned ${authSettingsResponse.status}`);
const authSettings = await authSettingsResponse.json();
if (
  authSettings.external?.email !== true ||
  authSettings.disable_signup === true ||
  authSettings.mailer_autoconfirm !== false
) {
  throw new Error("Supabase email invitation authentication is not ready");
}

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
const normalizedAdmin = process.env.ADMIN_EMAIL.trim().toLowerCase();
let founderReady = false;
for (let page = 1; page <= 100; page += 1) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  founderReady ||= data.users.some(
    (user) => user.email?.toLowerCase() === normalizedAdmin && Boolean(user.email_confirmed_at),
  );
  if (founderReady || data.users.length < 1000) break;
}
if (!founderReady) throw new Error("The configured platform owner is not a confirmed Auth user");

const [
  { count: activeTenants, error: tenantsError },
  { count: activeMemberships, error: membershipsError },
] = await Promise.all([
  service.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
  service
    .from("tenant_memberships")
    .select("id", { count: "exact", head: true })
    .eq("status", "active"),
]);
if (tenantsError) throw tenantsError;
if (membershipsError) throw membershipsError;
if (!activeTenants || !activeMemberships)
  throw new Error("At least one active tenant and membership are required");

const senderIdentity = process.env.RESEND_FROM_EMAIL.trim();
const senderAddress = senderIdentity.match(/<([^>]+)>/)?.[1] || senderIdentity;
const senderDomain = senderAddress.split("@")[1]?.toLowerCase();
if (!senderDomain) throw new Error("RESEND_FROM_EMAIL does not contain a valid domain");
const resendResponse = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
});
if (!resendResponse.ok)
  throw new Error(`Resend domain readiness returned ${resendResponse.status}`);
const resendPayload = await resendResponse.json();
const verifiedSender =
  Array.isArray(resendPayload.data) &&
  resendPayload.data.some(
    (domain) =>
      domain?.status === "verified" &&
      (senderDomain === String(domain.name).toLowerCase() ||
        senderDomain.endsWith(`.${String(domain.name).toLowerCase()}`)),
  );
if (!verifiedSender)
  throw new Error("The configured invitation sender domain is not verified in Resend");

console.log(
  JSON.stringify(
    {
      result: "passed",
      auth: {
        emailEnabled: true,
        signupEnabled: true,
        confirmationRequired: true,
        founderConfirmed: true,
      },
      platform: { activeTenants, activeMemberships },
      delivery: { provider: "resend", senderDomainVerified: true },
    },
    null,
    2,
  ),
);
