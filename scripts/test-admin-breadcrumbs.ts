import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getAdminBreadcrumbs } from "../src/lib/admin/breadcrumbs";
import {
  adminNavSections,
  filterNavSectionsByTenant,
  searchAdminNavLinks,
} from "../src/lib/admin/navigation";
import { resolveAdminHref } from "../src/lib/admin/navigation-paths";

assert.deepEqual(getAdminBreadcrumbs("/admin/integrations"), [
  { label: "Integrations", href: "/admin/integrations" },
]);
assert.deepEqual(getAdminBreadcrumbs("/admin/today"), [{ label: "Today", href: "/admin/today" }]);
assert.deepEqual(getAdminBreadcrumbs("/admin/invoicing"), [
  { label: "Invoices", href: "/admin/invoicing" },
]);
const invoiceLinks = filterNavSectionsByTenant(adminNavSections, {
  modules: { "stripe-invoicing": true },
}).flatMap((section) => section.links);
for (const query of [
  "invoice",
  "invoices",
  "invoicing",
  "billing",
  "create invoice",
  "new invoice",
]) {
  assert.ok(
    searchAdminNavLinks(invoiceLinks, query).some((link) => link.href === "/admin/invoicing"),
    `Invoice search must recognize "${query}"`,
  );
}
const disabledInvoiceLinks = filterNavSectionsByTenant(adminNavSections, {
  modules: { "stripe-invoicing": false },
}).flatMap((section) => section.links);
assert.ok(!disabledInvoiceLinks.some((link) => link.id === "stripe-invoicing"));
assert.equal(
  resolveAdminHref("/admin/invoicing?view=create", "northline-roofing"),
  "/demo/command-center/northline-roofing/invoicing?view=create",
);
assert.equal(
  resolveAdminHref("/admin/invoicing?view=create", null, "example"),
  "/t/example/admin/invoicing?view=create",
);
assert.deepEqual(getAdminBreadcrumbs("/admin/contacts/claire%40example.com"), [
  { label: "Contacts", href: "/admin/contacts" },
  { label: "Relationship", href: "/admin/contacts/claire%40example.com" },
]);

const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
assert.match(
  shell,
  /breadcrumbs\.length > 1 &&[\s(]*<nav/,
  "Top-level pages must not repeat their PageHeader title as a one-item breadcrumb",
);

const settings = readFileSync("src/app/admin/settings/page.tsx", "utf8");
const adminSwitch = readFileSync("src/components/admin/AdminSwitch.tsx", "utf8");
assert.match(settings, /<AdminSwitch/, "Settings must use the shared semantic switch control");
assert.doesNotMatch(
  settings,
  /aria-pressed|inline-flex size-11 shrink-0 items-center rounded-full/,
  "The distorted square notification toggle must not return",
);
assert.doesNotMatch(
  settings,
  /framer-motion|<motion\./,
  "Settings must use the shared route entrance instead of stacking a second animation owner",
);
assert.match(adminSwitch, /role="switch"/, "Admin switches must expose their actual control role");
assert.match(
  adminSwitch,
  /aria-checked=\{checked\}/,
  "Admin switches must expose their checked state",
);
assert.match(
  adminSwitch,
  /h-7 w-12 rounded-full/,
  "The visible switch track must remain a 48 by 28 pill",
);
assert.match(
  adminSwitch,
  /size-5 rounded-full/,
  "The switch thumb must remain a concentric 20px circle",
);
assert.match(
  adminSwitch,
  /checked && "translate-x-5"/,
  "The checked thumb must retain equal four-pixel end insets",
);

console.log("admin breadcrumb contract passed");
