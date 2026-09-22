import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proxy = readFileSync("src/proxy.ts", "utf8");
for (const invariant of [
  "workspaceMatch",
  'requestHeaders.set("x-tenant-id", tenantId)',
  'requestHeaders.set("x-tenant-slug", tenantSlug)',
  'supabaseResponse.cookies.set("accelerate-tenant-slug"',
  "/^(features|tenants|setup)",
])
  assert.ok(proxy.includes(invariant), `workspace proxy is missing ${invariant}`);

const link = readFileSync("src/components/admin/AdminLink.tsx", "utf8");
assert.ok(
  link.includes("resolveAdminHref") && link.includes("workspaceSlug"),
  "admin links must retain canonical workspace URLs",
);
const navigationPaths = readFileSync("src/lib/admin/navigation-paths.ts", "utf8");
assert.ok(
  navigationPaths.includes('return `/t/${workspaceSlug}/admin/${suffix || "today"}`'),
  "admin links must resolve canonical workspace URLs in one shared adapter",
);

const contract = readFileSync("docs/contracts/MULTI-TENANCY-CONTRACT.md", "utf8");
assert.ok(
  contract.includes("`/t/{tenantSlug}/admin/{route}`"),
  "the tenancy contract must name the implemented canonical workspace URL",
);
assert.ok(
  !contract.includes("/admin/workspaces/:tenantSlug"),
  "the retired workspace URL must not remain authoritative",
);

const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
for (const invariant of [
  'aria-label="Switch workspace"',
  "window.location.assign(`/t/${slug}/admin/${suffix}`)",
  '["features", "tenants", "setup"]',
  '<MotionConfig reducedMotion="user">',
])
  assert.ok(shell.includes(invariant), `workspace shell is missing ${invariant}`);

const tenantApi = readFileSync("src/app/api/admin/tenants/route.ts", "utf8");
for (const invariant of [
  "requirePlatformAdmin()",
  'action: z.literal("create")',
  'action: z.literal("invite")',
  'action: z.literal("revoke")',
  'action: z.enum(["activate", "suspend", "archive"])',
  "createTenantWorkspace",
  "inviteTenantAdmin",
  "revokeTenantAdmin",
  "setTenantLifecycleStatus",
])
  assert.ok(tenantApi.includes(invariant), `tenant lifecycle is missing ${invariant}`);

const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
for (const invariant of [
  'type === "invite" || type === "magiclink"',
  "activateInvitedTenantMembership",
  "tenantSlug: workspace",
  "copyResponseCookies",
])
  assert.ok(callback.includes(invariant), `invitation callback is missing ${invariant}`);
assert.doesNotMatch(
  callback,
  /from\("tenant_memberships"\)[\s\S]{0,200}\.update\(/,
  "invitation callback must not directly mutate memberships",
);

const directory = readFileSync("src/app/admin/tenants/page.tsx", "utf8");
for (const invariant of [
  "Workspace directory",
  "Search workspaces",
  "Archive workspace",
  "if (!created) return",
  "if (!slugEdited) setSlug(slugify(value))",
  "Invitations are disabled while this workspace is",
  "Resend invitation to",
  "requestId: crypto.randomUUID()",
])
  assert.ok(
    directory.includes(invariant),
    `tenant directory is missing the robust lifecycle behavior ${invariant}`,
  );
const styles = readFileSync("src/app/admin-components.css", "utf8");
const secondaryControl = styles.slice(
  styles.indexOf(".admin-secondary-control {"),
  styles.indexOf(".admin-action-mark"),
);
assert.ok(
  secondaryControl.includes("min-height: var(--admin-control-height)"),
  "secondary tenant controls must preserve a usable hit area",
);
assert.ok(
  secondaryControl.includes(
    "transition-property: background-color, color, box-shadow, transform, opacity",
  ),
  "secondary tenant controls must animate only intentional properties",
);
assert.ok(
  !secondaryControl.includes("transition: all"),
  "secondary tenant controls must never transition every property",
);

console.log(
  JSON.stringify({
    result: "passed",
    canonicalWorkspace: "/t/{slug}/admin/*",
    platformRoutesHidden: 3,
  }),
);
