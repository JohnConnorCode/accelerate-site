/** Installation orchestration only. Business membership writes use the existing host RPC. */
export class SetupError extends Error {}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const placeholder = (value) => !value || /^(your-|use-a-local|generate-a-)/i.test(value);
export function setupConfiguration(env) {
  const issues = [];
  const required = (key) => {
    const value = env[key]?.trim();
    if (placeholder(value)) issues.push(`Configure ${key}.`);
    return value ?? "";
  };
  const apiUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const project = required("SUPABASE_PROJECT_REF");
  const databaseHost = required("SUPABASE_DB_HOST");
  const ownerEmail = required("ADMIN_EMAIL").toLowerCase();
  const brandName = required("BOOTSTRAP_BRAND_NAME");
  const siteUrl = required("NEXT_PUBLIC_SITE_URL");
  if (!emailPattern.test(ownerEmail) || ownerEmail === "admin@example.com")
    issues.push("Set ADMIN_EMAIL to the actual owner email.");
  if (
    env.BOOTSTRAP_FOUNDER_EMAIL?.trim() &&
    env.BOOTSTRAP_FOUNDER_EMAIL.trim().toLowerCase() !== ownerEmail
  )
    issues.push("BOOTSTRAP_FOUNDER_EMAIL must match ADMIN_EMAIL for installation.");
  let site, api;
  try {
    site = new URL(siteUrl);
  } catch {
    issues.push("NEXT_PUBLIC_SITE_URL must be an absolute URL.");
  }
  try {
    api = new URL(apiUrl);
  } catch {
    issues.push("NEXT_PUBLIC_SUPABASE_URL must be an absolute URL.");
  }
  const local = (host) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
  for (const [label, url] of [
    ["Site", site],
    ["Supabase", api],
  ]) {
    if (
      url &&
      (url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !["https:", "http:"].includes(url.protocol) ||
        (url.protocol === "http:" && !local(url.hostname)))
    )
      issues.push(
        `${label} URL must use HTTPS (HTTP is allowed on loopback only), without credentials, query or fragment.`,
      );
  }
  if (api && api.pathname !== "/")
    issues.push("Supabase URL must be the API origin without a path.");
  if (api && local(api.hostname) !== local(databaseHost))
    issues.push("API and database must both be local or both hosted.");
  if (api && !local(api.hostname) && api.hostname !== `${project}.supabase.co`)
    issues.push(
      "Hosted setup requires the project's canonical Supabase API URL matching SUPABASE_PROJECT_REF.",
    );
  if (!/^[a-z0-9-]{1,80}$/.test(project)) issues.push("Invalid SUPABASE_PROJECT_REF.");
  if (site && site.pathname !== "/")
    issues.push("NEXT_PUBLIC_SITE_URL must be the application origin.");
  if (issues.length) return { ready: false, issues };
  const domain = local(site.hostname) ? ownerEmail.split("@")[1] : site.hostname;
  const founderName = env.BOOTSTRAP_FOUNDER_NAME?.trim() || "Owner";
  const defaults = {
    BOOTSTRAP_BRAND_NAME: brandName,
    BOOTSTRAP_BRAND_DOMAIN: domain,
    BOOTSTRAP_BRAND_SITE_URL: site.origin,
    BOOTSTRAP_BRAND_SITE_URL_BARE: site.origin,
    BOOTSTRAP_BRAND_ACCENT_COLOR: "#2563eb",
    BOOTSTRAP_BRAND_TAGLINE: "Business workspace",
    BOOTSTRAP_BRAND_EMAIL_FOOTER: brandName,
    BOOTSTRAP_FOUNDER_NAME: founderName,
    BOOTSTRAP_FOUNDER_FULL_NAME: founderName,
    BOOTSTRAP_FOUNDER_EMAIL: ownerEmail,
    BOOTSTRAP_SYSTEM_ACTOR_EMAIL: `system@${domain}`,
    BOOTSTRAP_AI_DESCRIPTOR: `${brandName} business workspace`,
    BOOTSTRAP_AI_VOICE: "Be concise, accurate and operational. Ask for approval before changes.",
    BOOTSTRAP_AI_POSITIONING: `Help the team operate ${brandName} using verified business records.`,
    BOOTSTRAP_BOOKING_URL: site.origin,
    BOOTSTRAP_BOOKING_PATH: "/contact",
    BOOTSTRAP_SCHEDULER_URL: "",
    BOOTSTRAP_SETTINGS_FROM_EMAIL: ownerEmail,
    BOOTSTRAP_SETTINGS_ADMIN_EMAIL: ownerEmail,
  };
  const bootstrap = Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, env[key]?.trim() || value]),
  );
  bootstrap.BOOTSTRAP_FOUNDER_EMAIL = ownerEmail;
  return {
    ready: true,
    issues: [],
    apiUrl: api.origin,
    anonKey,
    serviceKey,
    project,
    databaseHost,
    ownerEmail,
    brandName,
    siteUrl: site.origin,
    bootstrap,
  };
}
export function assertSetupOwner(owner, email) {
  if (!owner || !uuidPattern.test(owner.id) || owner.email?.toLowerCase() !== email)
    throw new SetupError("The owner identity could not be verified. No membership was granted.");
  if (
    !owner.email_confirmed_at ||
    (owner.banned_until && Date.parse(owner.banned_until) > Date.now())
  )
    throw new SetupError(
      "The owner must be confirmed and active. Resolve the account in your Auth administration before retrying; setup will not bypass account restrictions.",
    );
}
export async function runWorkspaceSetup(config, host, { apply = false, project, password } = {}) {
  if (!config.ready) return { status: "configuration_required", issues: config.issues };
  if (apply && project !== config.project)
    throw new SetupError(
      "--project must exactly match SUPABASE_PROJECT_REF before setup may make changes.",
    );
  const steps = [];
  const step = async (name, action) => {
    const start = Date.now();
    try {
      const result = await action();
      steps.push({ name, status: "passed", durationMs: Date.now() - start });
      return result;
    } catch (error) {
      if (error instanceof SetupError) throw error;
      throw new SetupError(
        `Setup stopped at ${name}. No later steps ran. Check that service and rerun the same command; completed migrations and an existing owner are preserved.`,
      );
    }
  };
  const database = await step("database_preflight", () => host.inspectDatabase());
  if (database.untrackedExisting)
    throw new SetupError(
      "Existing database has no migration ledger. Use the reviewed baseline-adoption procedure; setup cannot replay historical migrations over it.",
    );
  if (
    database.workspace &&
    (database.workspace.status !== "active" ||
      database.workspace.config?.founder?.email?.toLowerCase() !== config.ownerEmail)
  )
    throw new SetupError(
      "The existing bootstrap workspace is inactive or belongs to a different configured owner. Setup will not change its identity or status.",
    );
  let owner = await step("owner_lookup", () => host.findOwner(config.ownerEmail));
  if (owner) assertSetupOwner(owner, config.ownerEmail);
  const plan = {
    project: config.project,
    databaseHost: config.databaseHost,
    ownerEmail: config.ownerEmail,
    workspaceName: config.brandName,
    pendingMigrations: database.pending,
    owner: owner ? "reuse" : "create",
    effects: [
      "Apply pending ordered migrations",
      "Establish the matching bootstrap owner's membership through the audited lifecycle RPC",
    ],
    providerActivation: "none",
  };
  if (!apply)
    return {
      status: "plan",
      plan,
      steps,
      next: owner
        ? "Run setup --apply --project with the project shown above."
        : "Set SETUP_OWNER_PASSWORD in your local secret environment, then run setup --apply --project with the project shown above.",
    };
  if (!owner) {
    if (typeof password !== "string" || password.length < 12 || password.length > 1024)
      throw new SetupError(
        "A new owner requires SETUP_OWNER_PASSWORD with 12–1024 characters. Store it locally, never in a command argument or source control.",
      );
    owner = await step("owner_creation", () => host.createOwner(config.ownerEmail, password));
    assertSetupOwner(owner, config.ownerEmail);
  }
  await step("owner_database_match", () => host.assertDatabaseOwner(owner));
  await step("migrations", () => host.migrate(config.bootstrap));
  const workspace = await step("workspace_read", () => host.readWorkspace());
  if (
    !workspace ||
    !uuidPattern.test(workspace.id) ||
    workspace.status !== "active" ||
    workspace.config?.founder?.email?.toLowerCase() !== config.ownerEmail
  )
    throw new SetupError(
      "The existing bootstrap workspace is inactive or belongs to a different configured owner. Setup will not change its identity or status.",
    );
  const membership = await step("membership_read", () =>
    host.readMembership(workspace.id, owner.id),
  );
  if (
    membership &&
    (membership.status !== "active" ||
      membership.role !== "admin" ||
      membership.invited_email?.toLowerCase() !== config.ownerEmail)
  )
    throw new SetupError(
      "Existing membership requires an explicit platform review. Setup will not reactivate a revoked/invited membership or change its identity.",
    );
  if (!membership)
    await step("membership_activation", () => host.activateMembership(workspace.id, owner));
  const verified = await step("membership_verify", () =>
    host.readMembership(workspace.id, owner.id),
  );
  if (
    !verified ||
    verified.status !== "active" ||
    verified.role !== "admin" ||
    verified.user_id !== owner.id ||
    verified.tenant_id !== workspace.id ||
    verified.invited_email?.toLowerCase() !== config.ownerEmail
  )
    throw new SetupError(
      "Membership verification failed. Do not treat this workspace as ready; rerun setup after reviewing the lifecycle receipt.",
    );
  return {
    status: "workspace_configured",
    plan,
    steps,
    workspaceId: workspace.id,
    loginUrl: `${config.siteUrl}/admin/login`,
    remaining: [
      "Verify sign-in in your browser and open Setup Center.",
      "Configure Supabase Auth site/redirect URLs for this origin.",
      "Connect optional providers and verify their capabilities before use.",
      "Remove SETUP_OWNER_PASSWORD from the environment after setup.",
    ],
  };
}
