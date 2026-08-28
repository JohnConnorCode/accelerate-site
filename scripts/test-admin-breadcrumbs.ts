import assert from "node:assert/strict";
import { getAdminBreadcrumbs } from "../src/lib/admin/breadcrumbs";

assert.deepEqual(getAdminBreadcrumbs("/admin/integrations"), [
  { label: "Integrations", href: "/admin/integrations" },
]);
assert.deepEqual(getAdminBreadcrumbs("/admin/today"), [
  { label: "Today", href: "/admin/today" },
]);
assert.deepEqual(getAdminBreadcrumbs("/admin/contacts/claire%40example.com"), [
  { label: "Contacts", href: "/admin/contacts" },
  { label: "Timeline", href: "/admin/contacts/claire%40example.com" },
]);

console.log("admin breadcrumb contract passed");
